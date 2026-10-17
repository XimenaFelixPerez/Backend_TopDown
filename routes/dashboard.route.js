import { Router } from 'express';
import { requiereSesion } from '../middleware/auth.js';
import { getDashboard } from '../Controllers/dashboard.controllers.js';

const router = Router();
router.get('/dashboard', requiereSesion, getDashboard);
export default router;
