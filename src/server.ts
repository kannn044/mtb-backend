import app from './app';

process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandledRejection', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException', err);
  // Let PM2 restart the process; exiting avoids undefined state.
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.error('[signal] SIGTERM received');
});

process.on('SIGINT', () => {
  console.error('[signal] SIGINT received');
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});