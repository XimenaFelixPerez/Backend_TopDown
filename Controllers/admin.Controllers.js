import bcrypt from 'bcryptjs';
import { pool, sql } from '../db.js';

const error = (res, err, msg) => { console.error(err); res.status(500).json({ ok: false, mensaje: msg }); };
const texto = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// GET /api/admin/yo  (si no eres admin, el middleware ya respondió 403)
export const adminYo = (req, res) => res.json({ ok: true, rol: req.rol });

/* ============================ EMPLEADOS ============================ */

// GET /api/admin/empleados
export const listarEmpleados = async (req, res) => {
  try {
    const r = await pool.request().query(`
      SELECT u.Id AS UsuarioId, u.Correo, u.Rol, u.Activo, u.FechaRegistro,
             COALESCE(e.Nombre, u.Nombre) AS Nombre,
             e.NumeroEmpleado, e.Puesto, e.Departamento, e.FechaIngreso,
             e.CURP, e.RFC, e.NSS, e.Banco, e.Cuenta, e.SalarioMensual,
             (SELECT MAX(a.FechaHora) FROM AccesosLog a WHERE a.UsuarioId = u.Id) AS UltimoAcceso
      FROM Usuarios u
      LEFT JOIN Empleados e ON e.UsuarioId = u.Id
      ORDER BY u.Activo DESC, e.NumeroEmpleado`);
    res.json({ ok: true, empleados: r.recordset, yo: req.session.usuario.id });
  } catch (err) { error(res, err, 'Error al cargar empleados'); }
};

// POST /api/admin/empleados
export const crearEmpleado = async (req, res) => {
  const b = req.body || {};
  const d = {
    nombre: texto(b.nombre, 150),
    correo: texto(b.correo, 150).toLowerCase(),
    contrasena: String(b.contrasena || ''),
    rol: b.rol === 'admin' ? 'admin' : 'empleado',
    numero: texto(b.numero, 10),
    puesto: texto(b.puesto, 100),
    departamento: texto(b.departamento, 100),
    fechaIngreso: texto(b.fechaIngreso, 10),
    curp: texto(b.curp, 18).toUpperCase(),
    rfc: texto(b.rfc, 13).toUpperCase(),
    nss: texto(b.nss, 11),
    banco: texto(b.banco, 60),
    cuenta: texto(b.cuenta, 30),
    salario: Number(b.salario),
  };

  const faltan = ['nombre', 'correo', 'numero', 'puesto', 'departamento', 'fechaIngreso', 'curp', 'rfc', 'nss', 'banco', 'cuenta']
    .filter((k) => !d[k]);
  if (faltan.length) return res.status(400).json({ ok: false, mensaje: 'Completa todos los campos.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo)) return res.status(400).json({ ok: false, mensaje: 'Correo no válido.' });
  if (d.contrasena.length < 8) return res.status(400).json({ ok: false, mensaje: 'La contraseña debe tener al menos 8 caracteres.' });
  if (!(d.salario > 0)) return res.status(400).json({ ok: false, mensaje: 'Salario no válido.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fechaIngreso)) return res.status(400).json({ ok: false, mensaje: 'Fecha de ingreso no válida.' });

  const tx = new sql.Transaction(pool);
  try {
    const dup = await pool.request()
      .input('correo', sql.NVarChar(150), d.correo)
      .input('num', sql.NVarChar(10), d.numero)
      .query(`SELECT
                (SELECT COUNT(*) FROM Usuarios WHERE LOWER(Correo) = @correo) AS Correos,
                (SELECT COUNT(*) FROM Empleados WHERE NumeroEmpleado = @num) AS Numeros`);
    if (dup.recordset[0].Correos) return res.status(409).json({ ok: false, mensaje: 'Ya existe un usuario con ese correo.' });
    if (dup.recordset[0].Numeros) return res.status(409).json({ ok: false, mensaje: 'Ese número de empleado ya existe.' });

    const hash = await bcrypt.hash(d.contrasena, 10);
    await tx.begin();

    const u = await new sql.Request(tx)
      .input('nombre', sql.NVarChar(150), d.nombre)
      .input('correo', sql.NVarChar(150), d.correo)
      .input('hash', sql.NVarChar(100), hash)
      .input('rol', sql.NVarChar(20), d.rol)
      .query(`INSERT INTO Usuarios (Nombre, Correo, Contrasena, ContrasenaHash, Rol, Activo, FechaRegistro)
              OUTPUT INSERTED.Id
              VALUES (@nombre, @correo, NULL, @hash, @rol, 1, GETDATE())`);
    const usuarioId = u.recordset[0].Id;

    await new sql.Request(tx)
      .input('uid', sql.Int, usuarioId)
      .input('num', sql.NVarChar(10), d.numero)
      .input('nombre', sql.NVarChar(150), d.nombre)
      .input('puesto', sql.NVarChar(100), d.puesto)
      .input('depto', sql.NVarChar(100), d.departamento)
      .input('ingreso', sql.Date, d.fechaIngreso)
      .input('curp', sql.NVarChar(18), d.curp)
      .input('rfc', sql.NVarChar(13), d.rfc)
      .input('nss', sql.NVarChar(11), d.nss)
      .input('banco', sql.NVarChar(60), d.banco)
      .input('cuenta', sql.NVarChar(30), d.cuenta)
      .input('salario', sql.Decimal(12, 2), d.salario)
      .query(`INSERT INTO Empleados (UsuarioId, EmpresaId, NumeroEmpleado, Nombre, Puesto, Departamento, FechaIngreso,
                                     CURP, RFC, NSS, Banco, Cuenta, SalarioMensual)
              VALUES (@uid, (SELECT TOP 1 Id FROM Empresas ORDER BY Id), @num, @nombre, @puesto, @depto, @ingreso,
                      @curp, @rfc, @nss, @banco, @cuenta, @salario);
              INSERT INTO Notificaciones (UsuarioId, Texto) VALUES (@uid, N'¡Bienvenido al Kiosco del empleado!');`);

    await tx.commit();
    res.status(201).json({ ok: true, usuarioId });
  } catch (err) {
    try { await tx.rollback(); } catch (_) {}
    error(res, err, 'No se pudo crear el empleado');
  }
};

// PATCH /api/admin/empleados/:id/estado  { activo: true|false }  -> dar de baja / reactivar
export const cambiarEstado = async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.session.usuario.id) return res.status(400).json({ ok: false, mensaje: 'No puedes darte de baja a ti mismo.' });
  try {
    const r = await pool.request()
      .input('id', sql.Int, id)
      .input('activo', sql.Bit, req.body?.activo ? 1 : 0)
      .query('UPDATE Usuarios SET Activo = @activo WHERE Id = @id');
    if (!r.rowsAffected[0]) return res.status(404).json({ ok: false, mensaje: 'Empleado no encontrado' });
    res.json({ ok: true });
  } catch (err) { error(res, err, 'No se pudo cambiar el estado'); }
};

// DELETE /api/admin/empleados/:id  -> eliminar definitivamente (borra también su historial)
export const eliminarEmpleado = async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.session.usuario.id) return res.status(400).json({ ok: false, mensaje: 'No puedes eliminarte a ti mismo.' });

  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();
    const r = await new sql.Request(tx).input('id', sql.Int, id).query(`
      DELETE FROM Recibos WHERE EmpleadoId IN (SELECT Id FROM Empleados WHERE UsuarioId = @id); -- sus conceptos se borran en cascada
      DELETE FROM Empleados      WHERE UsuarioId = @id;
      DELETE FROM Notificaciones WHERE UsuarioId = @id;
      DELETE FROM AccesosLog     WHERE UsuarioId = @id;
      DELETE FROM Usuarios       WHERE Id = @id;`);
    const borrados = r.rowsAffected[r.rowsAffected.length - 1];
    if (!borrados) { await tx.rollback(); return res.status(404).json({ ok: false, mensaje: 'Empleado no encontrado' }); }
    await tx.commit();
    res.json({ ok: true });
  } catch (err) {
    try { await tx.rollback(); } catch (_) {}
    error(res, err, 'No se pudo eliminar el empleado');
  }
};

/* ============================ NOTICIAS ============================ */

// GET /api/admin/noticias  (incluye borradores)
export const listarNoticias = async (req, res) => {
  try {
    const r = await pool.request().query(
      'SELECT Id, Titulo, Resumen, Contenido, Fecha, Publicada FROM Noticias ORDER BY Fecha DESC, Id DESC');
    res.json({ ok: true, noticias: r.recordset });
  } catch (err) { error(res, err, 'Error al cargar noticias'); }
};

const datosNoticia = (b) => ({
  titulo: texto(b?.titulo, 200),
  resumen: texto(b?.resumen, 300) || null,
  contenido: String(b?.contenido ?? '').trim() || null,
  fecha: /^\d{4}-\d{2}-\d{2}$/.test(b?.fecha || '') ? b.fecha : null,
  publicada: b?.publicada === false ? 0 : 1,
});

const reqNoticia = (n) => pool.request()
  .input('titulo', sql.NVarChar(200), n.titulo)
  .input('resumen', sql.NVarChar(300), n.resumen)
  .input('contenido', sql.NVarChar(sql.MAX), n.contenido)
  .input('fecha', sql.Date, n.fecha)
  .input('publicada', sql.Bit, n.publicada);

// POST /api/admin/noticias
export const crearNoticia = async (req, res) => {
  const n = datosNoticia(req.body);
  if (!n.titulo || !n.fecha) return res.status(400).json({ ok: false, mensaje: 'Título y fecha son obligatorios.' });
  try {
    const r = await reqNoticia(n).query(`
      INSERT INTO Noticias (Titulo, Resumen, Contenido, Fecha, Publicada)
      OUTPUT INSERTED.Id VALUES (@titulo, @resumen, @contenido, @fecha, @publicada)`);
    res.status(201).json({ ok: true, id: r.recordset[0].Id });
  } catch (err) { error(res, err, 'No se pudo publicar la noticia'); }
};

// PUT /api/admin/noticias/:id
export const editarNoticia = async (req, res) => {
  const n = datosNoticia(req.body);
  if (!n.titulo || !n.fecha) return res.status(400).json({ ok: false, mensaje: 'Título y fecha son obligatorios.' });
  try {
    const r = await reqNoticia(n).input('id', sql.Int, Number(req.params.id)).query(`
      UPDATE Noticias SET Titulo = @titulo, Resumen = @resumen, Contenido = @contenido,
                          Fecha = @fecha, Publicada = @publicada
      WHERE Id = @id`);
    if (!r.rowsAffected[0]) return res.status(404).json({ ok: false, mensaje: 'Noticia no encontrada' });
    res.json({ ok: true });
  } catch (err) { error(res, err, 'No se pudo editar la noticia'); }
};

// DELETE /api/admin/noticias/:id
export const eliminarNoticia = async (req, res) => {
  try {
    const r = await pool.request().input('id', sql.Int, Number(req.params.id))
      .query('DELETE FROM Noticias WHERE Id = @id');
    if (!r.rowsAffected[0]) return res.status(404).json({ ok: false, mensaje: 'Noticia no encontrada' });
    res.json({ ok: true });
  } catch (err) { error(res, err, 'No se pudo eliminar la noticia'); }
};

/* ============================ ACCESOS ============================ */

// GET /api/admin/accesos  -> últimos 100 inicios de sesión
export const listarAccesos = async (req, res) => {
  try {
    const r = await pool.request().query(`
      SELECT TOP 100 a.Id, a.FechaHora, a.IP, u.Correo, COALESCE(e.Nombre, u.Nombre) AS Nombre
      FROM AccesosLog a
      JOIN Usuarios u ON u.Id = a.UsuarioId
      LEFT JOIN Empleados e ON e.UsuarioId = u.Id
      ORDER BY a.FechaHora DESC, a.Id DESC`);
    res.json({ ok: true, accesos: r.recordset });
  } catch (err) { error(res, err, 'Error al cargar accesos'); }
};
