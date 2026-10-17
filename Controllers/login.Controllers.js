import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { pool, sql } from '../db.js';

const MIN_CODIGO = 3;        // el código vence en 3 minutos
const MAX_INTENTOS = 3;      // 3 códigos malos = bloqueo
const MIN_BLOQUEO = 5;       // minutos de bloqueo

// "2026-10-16 02:34:00" en hora de México, sin depender de la zona del servidor
const ahoraMexico = () =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date());

const ipDe = (req) => {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress || '';
  if (ip === '::1') return '127.0.0.1';
  return ip.replace('::ffff:', '') || 'desconocida';
};

// POST /api/login  { correo, contrasena }
export const login = async (req, res) => {
  try {
    const correo = String(req.body?.correo || '').trim().toLowerCase();
    const contrasena = String(req.body?.contrasena || '');
    if (!correo || !contrasena) {
      return res.status(400).json({ ok: false, mensaje: 'Escribe tu correo y contraseña.' });
    }

    const r = await pool.request()
      .input('correo', sql.NVarChar(150), correo)
      .query(`
        SELECT TOP 1 Id, Nombre, Correo, Contrasena, ContrasenaHash, Rol, Activo,
               CASE WHEN BloqueadoHasta > GETDATE()
                    THEN DATEDIFF(SECOND, GETDATE(), BloqueadoHasta) ELSE 0 END AS SegBloqueo
        FROM Usuarios WHERE LOWER(Correo) = @correo ORDER BY Id`);
    const u = r.recordset[0];

    if (!u) return res.status(401).json({ ok: false, mensaje: 'Correo de empleado o contraseña incorrectos.' });
    if (!u.Activo) return res.status(403).json({ ok: false, mensaje: 'Tu cuenta está dada de baja. Contacta a Recursos Humanos.' });
    if (u.SegBloqueo > 0) {
      const min = Math.ceil(u.SegBloqueo / 60);
      return res.status(423).json({ ok: false, mensaje: `Cuenta bloqueada por intentos fallidos. Intenta en ${min} min.` });
    }

    let valida = false;
    if (u.ContrasenaHash) {
      valida = await bcrypt.compare(contrasena, u.ContrasenaHash);
    } else if (u.Contrasena && u.Contrasena === contrasena) {
      // Usuario viejo con texto plano: se valida y se convierte a hash en ese momento
      valida = true;
      const hash = await bcrypt.hash(contrasena, 10);
      await pool.request().input('id', sql.Int, u.Id).input('hash', sql.NVarChar(100), hash)
        .query('UPDATE Usuarios SET ContrasenaHash = @hash, Contrasena = NULL WHERE Id = @id');
    }
    if (!valida) return res.status(401).json({ ok: false, mensaje: 'Correo de empleado o contraseña incorrectos.' });

    // Paso 2: código de 6 dígitos (todavía NO hay sesión iniciada)
    const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    delete req.session.usuario;
    req.session.pendiente = {
      id: u.Id, correo: u.Correo, nombre: u.Nombre,
      codigo, expira: Date.now() + MIN_CODIGO * 60 * 1000, intentos: 0,
    };

    console.log('\n==============================================');
    console.log(`  Código de verificación para ${u.Correo}: ${codigo}`);
    console.log(`  Vence en ${MIN_CODIGO} minutos`);
    console.log('==============================================\n');

    res.json({ ok: true, correo: u.Correo, mensaje: 'Código generado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: 'Error del servidor' });
  }
};

// POST /api/verificar  { codigo }
export const verificar = async (req, res) => {
  try {
    const p = req.session.pendiente;
    if (!p) return res.status(401).json({ ok: false, mensaje: 'Inicia sesión de nuevo.' });

    if (Date.now() > p.expira) {
      delete req.session.pendiente;
      return res.status(401).json({ ok: false, mensaje: 'El código expiró. Inicia sesión de nuevo.' });
    }

    const codigo = String(req.body?.codigo || '').trim();
    if (codigo !== p.codigo) {
      p.intentos += 1;
      if (p.intentos >= MAX_INTENTOS) {
        await pool.request().input('id', sql.Int, p.id).input('min', sql.Int, MIN_BLOQUEO)
          .query('UPDATE Usuarios SET BloqueadoHasta = DATEADD(MINUTE, @min, GETDATE()) WHERE Id = @id');
        delete req.session.pendiente;
        return res.status(423).json({ ok: false, mensaje: `3 intentos fallidos. Cuenta bloqueada ${MIN_BLOQUEO} minutos.` });
      }
      const quedan = MAX_INTENTOS - p.intentos;
      return res.status(401).json({ ok: false, mensaje: `Código incorrecto. Te queda${quedan === 1 ? '' : 'n'} ${quedan} intento${quedan === 1 ? '' : 's'}.` });
    }

    // Código correcto: sesión nueva (evita reutilizar el id de sesión anterior)
    const datos = { id: p.id, correo: p.correo, nombre: p.nombre };
    await new Promise((ok, mal) => req.session.regenerate((e) => (e ? mal(e) : ok())));
    req.session.usuario = datos;

    // Registro del acceso: quién, fecha/hora de México e IP
    await pool.request()
      .input('uid', sql.Int, datos.id)
      .input('fecha', sql.NVarChar(19), ahoraMexico())
      .input('ip', sql.NVarChar(45), ipDe(req))
      .query(`INSERT INTO AccesosLog (UsuarioId, FechaHora, IP) VALUES (@uid, CAST(@fecha AS DATETIME2(0)), @ip);
              UPDATE Usuarios SET BloqueadoHasta = NULL WHERE Id = @uid;`);

    res.json({ ok: true, redirect: 'Dashboard.html' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: 'Error del servidor' });
  }
};

// POST /api/logout  -> destruye la sesión en el servidor
export const logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
};

// GET /api/yo  -> quién soy (lo usa guard.js en cada página)
export const yo = async (req, res) => {
  try {
    const r = await pool.request()
      .input('id', sql.Int, req.session.usuario.id)
      .query(`SELECT u.Id, u.Nombre, u.Correo, u.Rol, e.NumeroEmpleado, e.Nombre AS NombreEmpleado
              FROM Usuarios u LEFT JOIN Empleados e ON e.UsuarioId = u.Id WHERE u.Id = @id`);
    const u = r.recordset[0];
    res.json({
      ok: true,
      id: u.Id,
      nombre: u.NombreEmpleado || u.Nombre,
      correo: u.Correo,
      numero: u.NumeroEmpleado || '',
      rol: u.Rol,
      esAdmin: u.Rol === 'admin',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: 'Error del servidor' });
  }
};
