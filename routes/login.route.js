import { Router } from 'express';
import { login, verificar, sesion, logout } from '../Controllers/login.Controllers.js';
import { requiereSesion } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.post('/verificar', verificar);
router.get('/sesion', requiereSesion, sesion);
router.post('/logout', logout);

export default router;