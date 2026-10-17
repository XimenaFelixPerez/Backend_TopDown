import { pool, sql } from '../db.js';

// Saca id/correo del usuario guardado en sesión, sin importar cómo se llamen las propiedades
const datosSesion = (req) => {
  const u = req.session?.usuario || {};
  return {
    id: u.Id ?? u.id ?? u.IdUsuario ?? u.idUsuario ?? null,
    correo: u.Correo ?? u.correo ?? null,
  };
};

export async function usuarioDeSesion(req) {
  const { id, correo } = datosSesion(req);
  const r = await pool.request()
    .input('id', sql.Int, id)
    .input('correo', sql.NVarChar(150), correo)
    .query(`
      SELECT TOP 1 Id, Nombre, Correo, Rol
      FROM Usuarios
      WHERE Id = @id OR Correo = @correo
      ORDER BY CASE WHEN Id = @id THEN 0 ELSE 1 END`);
  return r.recordset[0] || null;
}

export async function empleadoDeSesion(req) {
  const usuario = await usuarioDeSesion(req);
  if (!usuario) return null;
  const r = await pool.request()
    .input('uid', sql.Int, usuario.Id)
    .query(`
      SELECT e.*, em.Nombre AS EmpresaNombre, em.Domicilio AS EmpresaDomicilio,
             em.RFC AS EmpresaRFC, em.RegistroPatronal
      FROM Empleados e
      JOIN Empresas em ON em.Id = e.EmpresaId
      WHERE e.UsuarioId = @uid`);
  return r.recordset[0] || null;
}

export const redondear = (n) => Math.round(Number(n || 0) * 100) / 100;
