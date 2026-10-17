import { pool, sql } from '../db.js';

// Hay sesión y el usuario sigue activo en la BD. Deja el rol REAL (de la BD) en req.rol.
export const requiereSesion = async (req, res, next) => {
  const id = req.session?.usuario?.id;
  if (!id) return res.status(401).json({ ok: false, mensaje: 'Sesión no válida' });

  try {
    const r = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT Rol, Activo FROM Usuarios WHERE Id = @id');
    const u = r.recordset[0];

    if (!u || !u.Activo) {
      req.session.destroy(() => {});
      return res.status(401).json({ ok: false, mensaje: 'Sesión no válida' });
    }
    req.rol = u.Rol;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: 'Error del servidor' });
  }
};

// Solo administradores. El rol se consulta en la BD en CADA petición, nunca se toma del navegador.
export const requiereAdmin = (req, res, next) =>
  requiereSesion(req, res, () => {
    if (req.rol !== 'admin') {
      return res.status(403).json({ ok: false, mensaje: 'Solo administradores' });
    }
    next();
  });
