import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/userController';
import { checkAuth } from '../middlewares/auth';

const router = Router();

// GET /api/users
router.get('/', checkAuth, getUsers);

// POST /api/users
router.post('/', checkAuth, createUser);

// PUT /api/users/:id
router.put('/:id', checkAuth, updateUser);

// DELETE /api/users/:id
router.delete('/:id', checkAuth, deleteUser);

export default router;