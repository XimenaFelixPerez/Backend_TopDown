import { Router } from 'express';
import { requiereSesion } from '../middleware/auth.js';
import { getNoticias } from '../Controllers/noticias.Controllers.js';

const router = Router();
router.get('/noticias', requiereSesion, getNoticias);
export default router;
