import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
    res.json({ mensaje: 'API funcionando' });
});

export default router;