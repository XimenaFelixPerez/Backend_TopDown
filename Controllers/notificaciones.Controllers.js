import { pool, sql } from '../db.js';
import { usuarioDeSesion } from '../utils/sesion.js';

// GET /api/notificaciones
export const getNotificaciones = async (req, res) => {
  try {
    const u = await usuarioDeSesion(req);
    if (!u) return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });

    const r = await pool.request()
      .input('uid', sql.Int, u.Id)
      .query(`SELECT Id, Texto, Leida, Fecha FROM Notificaciones
              WHERE UsuarioId = @uid ORDER BY Fecha DESC`);

    res.json({ ok: true, notificaciones: r.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: 'Error al cargar notificaciones' });
  }
};

// PATCH /api/notificaciones/:id/leida
export const marcarLeida = async (req, res) => {
  try {
    const u = await usuarioDeSesion(req);
    if (!u) return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });

    await pool.request()
      .input('id', sql.Int, Number(req.params.id))
      .input('uid', sql.Int, u.Id)
      .query('UPDATE Notificaciones SET Leida = 1 WHERE Id = @id AND UsuarioId = @uid');

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: 'Error al actualizar la notificación' });
  }
};
