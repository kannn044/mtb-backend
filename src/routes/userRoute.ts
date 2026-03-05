import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/userController';
import { checkAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/roleAuth';

const router = Router();

// GET /api/users
router.get('/', checkAuth, requireRole(['ADMIN']), getUsers);

// POST /api/users
router.post('/', checkAuth, requireRole(['ADMIN']), createUser);

// PUT /api/users/:id
router.put('/:id', checkAuth, requireRole(['ADMIN']), updateUser);

// DELETE /api/users/:id
router.delete('/:id', checkAuth, requireRole(['ADMIN']), deleteUser);

export default router;