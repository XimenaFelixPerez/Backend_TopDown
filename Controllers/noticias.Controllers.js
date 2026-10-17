import { pool } from '../db.js';

// GET /api/noticias  -> solo las publicadas (comunidad.js espera un arreglo directo)
export const getNoticias = async (req, res) => {
  try {
    const r = await pool.request().query(`
      SELECT Id AS id, Titulo AS titulo, Resumen AS resumen, Contenido AS contenido, Fecha AS fecha
      FROM Noticias
      WHERE Publicada = 1
      ORDER BY Fecha DESC, Id DESC`);
    res.json(r.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: 'Error al cargar noticias' });
  }
};
