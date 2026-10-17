import { Router } from 'express';
import { requiereAdmin } from '../middleware/auth.js';
import {
  adminYo,
  listarEmpleados, crearEmpleado, cambiarEstado, eliminarEmpleado,
  listarNoticias, crearNoticia, editarNoticia, eliminarNoticia,
  listarAccesos,
} from '../Controllers/admin.Controllers.js';

const router = Router();

// TODAS las rutas /api/admin/* pasan por requiereAdmin (rol leído de la BD en cada petición)
router.use('/admin', requiereAdmin);

router.get('/admin/yo', adminYo);

router.get('/admin/empleados', listarEmpleados);
router.post('/admin/empleados', crearEmpleado);
router.patch('/admin/empleados/:id/estado', cambiarEstado);
router.delete('/admin/empleados/:id', eliminarEmpleado);

router.get('/admin/noticias', listarNoticias);
router.post('/admin/noticias', crearNoticia);
router.put('/admin/noticias/:id', editarNoticia);
router.delete('/admin/noticias/:id', eliminarNoticia);

router.get('/admin/accesos', listarAccesos);

export default router;
