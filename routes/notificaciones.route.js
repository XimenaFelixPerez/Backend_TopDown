import { Router } from 'express';
import { requiereSesion } from '../middleware/auth.js';
import { getNotificaciones, marcarLeida } from '../Controllers/notificaciones.Controllers.js';

const router = Router();
router.get('/notificaciones', requiereSesion, getNotificaciones);
router.patch('/notificaciones/:id/leida', requiereSesion, marcarLeida);
export default router;
