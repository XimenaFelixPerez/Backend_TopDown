import { Router } from 'express';
import { requiereSesion } from '../middleware/auth.js';
import { login, verificar, logout, yo } from '../Controllers/login.Controllers.js';

const router = Router();
router.post('/login', login);
router.post('/verificar', verificar);
router.post('/logout', logout);
router.get('/yo', requiereSesion, yo);
export default router;
