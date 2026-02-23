import { Knex } from 'knex';
import path from 'path';
import dbInstance from '../config/db';
import { sendPipelineFinishedEmail } from './pipelineMailer';

export type PipelineRunStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface PipelineRunRecord {
  id: number;
  user_id: string;
  run_id: string;
  status: PipelineRunStatus;
  requested_at: Date;
  started_at?: Date | null;
  finished_at?: Date | null;
  engine_root: string;
  dest_run_dir: string;
  user_email?: string | null;
  user_label?: string | null;
  requested_ip?: string | null;
  exit_code?: number | null;
  exit_signal?: string | null;
  error_message?: string | null;
}

const PIPELINE_RUNS_TABLE = 'pipeline_runs';
let workerTimer: NodeJS.Timeout | null = null;
let workerRunning = false;

export const ensurePipelineQueueSchema = async (): Promise<void> => {
  const exists = await dbInstance.schema.hasTable(PIPELINE_RUNS_TABLE);
  if (exists) return;

  await dbInstance.schema.createTable(PIPELINE_RUNS_TABLE, (table) => {
    table.bigIncrements('id').primary();
    table.string('user_id', 64).notNullable();
    table.string('run_id', 128).notNullable().unique();
    table.string('status', 16).notNullable().index();
    table.timestamp('requested_at').notNullable().defaultTo(dbInstance.fn.now());
    table.timestamp('started_at').nullable();
    table.timestamp('finished_at').nullable();
    table.string('engine_root', 1024).notNullable();
    table.string('dest_run_dir', 1024).notNullable();
    table.string('user_email', 255).nullable();
    table.string('user_label', 255).nullable();
    table.string('requested_ip', 64).nullable();
    table.integer('exit_code').nullable();
    table.string('exit_signal', 32).nullable();
    table.text('error_message').nullable();
    table.index(['status', 'requested_at']);
  });
};

export const enqueuePipelineRun = async (opts: {
  db?: Knex;
  userId: string;
  runId: string;
  engineRoot: string;
  destRunDir: string;
  userEmail?: string | null;
  userLabel?: string | null;
  requestedIp?: string | null;
}): Promise<{ queuePosition: number; recordId: number }> => {
  const db = opts.db ?? dbInstance;
  const requestedAt = new Date();

  const insertPayload = {
    user_id: opts.userId,
    run_id: opts.runId,
    status: 'QUEUED' as PipelineRunStatus,
    requested_at: requestedAt,
    engine_root: opts.engineRoot,
    dest_run_dir: opts.destRunDir,
    user_email: opts.userEmail ?? null,
    user_label: opts.userLabel ?? null,
    requested_ip: opts.requestedIp ?? null,
  };

  const [recordId] = await db(PIPELINE_RUNS_TABLE).insert(insertPayload);

  const positionRow = await db(PIPELINE_RUNS_TABLE)
    .whereIn('status', ['QUEUED', 'RUNNING'])
    .andWhere('id', '<=', recordId)
    .count<{ position: number }[]>({ position: '*' })
    .first();

  const queuePosition = Number(positionRow?.position ?? 1);

  return { queuePosition, recordId };
};

export const startPipelineQueueWorker = (): void => {
  if (workerTimer) return;
  const pollMs = Number(process.env.PIPELINE_QUEUE_POLL_MS) || 5000;
  workerTimer = setInterval(() => {
    void tryStartNextRun();
  }, pollMs);
  void tryStartNextRun();
};

export const stopPipelineQueueWorker = (): void => {
  if (!workerTimer) return;
  clearInterval(workerTimer);
  workerTimer = null;
};

export const kickPipelineQueue = (): void => {
  void tryStartNextRun();
};

const tryStartNextRun = async (): Promise<void> => {
  if (workerRunning) return;
  workerRunning = true;
  let nextRun: PipelineRunRecord | null = null;

  try {
    await dbInstance.transaction(async (trx) => {
      const running = await trx(PIPELINE_RUNS_TABLE)
        .where({ status: 'RUNNING' })
        .first('id');

      if (running) return;

      const candidate = await trx(PIPELINE_RUNS_TABLE)
        .where({ status: 'QUEUED' })
        .orderBy('requested_at', 'asc')
        .forUpdate()
        .first();

      if (!candidate) return;

      await trx(PIPELINE_RUNS_TABLE)
        .where({ id: candidate.id })
        .update({
          status: 'RUNNING',
          started_at: new Date(),
        });

      nextRun = candidate as PipelineRunRecord;
    });
  } catch (error) {
    console.error('[Queue] Failed to acquire next run', error);
  } finally {
    workerRunning = false;
  }

  if (nextRun) {
    await runPipeline(nextRun);
  }
};

const runPipeline = async (run: PipelineRunRecord): Promise<void> => {
  const { spawn } = require('child_process');
  const userIdRun = `user_${run.user_id}`;
  const runProcessId = run.run_id;

  const pipelineCmd =
    `unset JAVA_HOME JAVA_CMD NXF_JAVA_HOME; ` +
    `ENV_NAME=MTB_WGS_cluster_analysis; ` +
    `NF_CMD=\"unset JAVA_HOME JAVA_CMD NXF_JAVA_HOME; nextflow run src_user_data_analysis/main.nf --user_acc \\\"${userIdRun}\\\" --run_id \\\"${runProcessId}\\\"\"; ` +
    `if command -v mamba >/dev/null 2>&1; then ` +
    `  mamba run -n \"$ENV_NAME\" bash -c \"$NF_CMD\"; ` +
    `elif command -v conda >/dev/null 2>&1; then ` +
    `  conda run -n \"$ENV_NAME\" bash -c \"$NF_CMD\"; ` +
    `else ` +
    `  echo \"Neither mamba nor conda found in PATH\" 1>&2; exit 127; ` +
    `fi`;

  console.log('[Queue] Triggering pipeline', {
    cwd: run.engine_root,
    user: userIdRun,
    run: runProcessId,
    cmd: pipelineCmd,
  });

  const childEnv: Record<string, string> = { ...process.env } as any;
  delete (childEnv as any).JAVA_HOME;
  delete (childEnv as any).JAVA_CMD;
  delete (childEnv as any).NXF_JAVA_HOME;

  const pipelineCondaBinDir = (process.env.PIPELINE_CONDA_BIN_DIR || '').trim();
  if (pipelineCondaBinDir) {
    childEnv.PATH = `${pipelineCondaBinDir}:${childEnv.PATH || ''}`;
  }

  const pipelineJavaHome = (process.env.PIPELINE_JAVA_HOME || '').trim();
  if (pipelineJavaHome) {
    childEnv.JAVA_HOME = pipelineJavaHome;
    childEnv.NXF_JAVA_HOME = pipelineJavaHome;
    childEnv.PATH = `${path.join(pipelineJavaHome, 'bin')}:${childEnv.PATH || ''}`;
  }

  await new Promise<void>((resolve) => {
    const child = spawn('bash', ['-c', pipelineCmd], {
      cwd: run.engine_root,
      env: childEnv,
    });

    child.stdout?.on('data', (d: Buffer) => {
      const s = d.toString('utf8');
      if (s.trim()) console.log(`[Pipeline:${runProcessId}:stdout] ${s}`);
    });

    child.stderr?.on('data', (d: Buffer) => {
      const s = d.toString('utf8');
      if (s.trim()) console.error(`[Pipeline:${runProcessId}:stderr] ${s}`);
    });

    child.on('error', async (e: Error) => {
      console.error(`[Pipeline:${runProcessId}] spawn error`, e);
      await dbInstance(PIPELINE_RUNS_TABLE)
        .where({ id: run.id })
        .update({
          status: 'FAILED',
          finished_at: new Date(),
          error_message: String(e),
        });
      resolve();
    });

    child.on('close', async (code: number | null, signal: string | null) => {
      console.log(`[Pipeline:${runProcessId}] exited`, { code, signal });

      const success = code === 0;
      await dbInstance(PIPELINE_RUNS_TABLE)
        .where({ id: run.id })
        .update({
          status: success ? 'SUCCESS' : 'FAILED',
          finished_at: new Date(),
          exit_code: code ?? null,
          exit_signal: signal ?? null,
        });

      if (run.user_email) {
        try {
          await sendPipelineFinishedEmail({
            to: run.user_email,
            userLabel: run.user_label || `user_${run.user_id}`,
            runId: runProcessId,
            success,
          });
          console.log(`[Pipeline:${runProcessId}] notification email sent`, { to: run.user_email });
        } catch (e) {
          console.error(`[Pipeline:${runProcessId}] notification email failed`, e);
        }
      } else {
        console.log(`[Pipeline:${runProcessId}] no user email; skip notify`, { userId: run.user_id });
      }

      resolve();
    });
  });

  kickPipelineQueue();
};
