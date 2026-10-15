import { pool, sql } from '../db.js';

export const listar = async (req, res) => {
  try {
    const r = await pool.request()
      .input('usuarioId', sql.Int, req.session.usuario.id)
      .query('SELECT Id, Texto, Leida, Fecha FROM dbo.Notificaciones WHERE UsuarioId = @usuarioId ORDER BY Fecha DESC');
    res.json({ ok: true, notificaciones: r.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: 'Error del servidor' });
  }
};

export const marcarLeida = async (req, res) => {
  try {
    const r = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('usuarioId', sql.Int, req.session.usuario.id)
      .query('UPDATE dbo.Notificaciones SET Leida = 1 WHERE Id = @id AND UsuarioId = @usuarioId');
    if (r.rowsAffected[0] === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Notificación no encontrada' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: 'Error del servidor' });
  }
};