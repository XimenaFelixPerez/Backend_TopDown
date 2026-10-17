import { Router } from 'express';
import { requiereSesion } from '../middleware/auth.js';
import { getRecibos, getRecibo, getDeducciones } from '../Controllers/nomina.Controllers.js';

const router = Router();
router.get('/nomina/recibos', requiereSesion, getRecibos);
router.get('/nomina/recibos/:id', requiereSesion, getRecibo);
router.get('/nomina/deducciones', requiereSesion, getDeducciones);
export default router;
