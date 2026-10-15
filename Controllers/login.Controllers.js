import crypto from 'crypto';
import { pool, sql } from '../db.js';
import { enviarCodigo } from '../mail.js';

const enmascarar = (correo) => {
  const [usuario, dominio] = (correo || '').split('@');
  if (!usuario || !dominio) return correo;
  return `${usuario[0]}***@${dominio}`;
};

export const login = async (req, res) => {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) {
    return res.status(400).json({ ok: false, mensaje: 'Por favor ingresa tu correo y contraseña.' });
  }

  const correoLimpio = correo.trim();
  const contrasenaLimpia = contrasena.trim();

  try {
    const r = await pool.request()
      .input('correo', sql.NVarChar, correoLimpio)
      .input('contrasena', sql.NVarChar, contrasenaLimpia)
      .query('SELECT Id, Nombre, Correo FROM dbo.Usuarios WHERE LOWER(LTRIM(RTRIM(Correo))) = LOWER(@correo) AND Contrasena = @contrasena');

    if (r.recordset.length === 0) {
      return res.status(401).json({ ok: false, mensaje: 'Correo de empleado o contraseña incorrectos.' });
    }

    const u = r.recordset[0];
    const codigo = crypto.randomInt(100000, 1000000).toString();

    req.session.pendiente = {
      id: u.Id,
      nombre: u.Nombre,
      correo: u.Correo,
      codigo,
      intentos: 0,
      expira: Date.now() + 5 * 60 * 1000
    };

    // Imprimir código en la terminal y enviar por mail si está configurado
    await enviarCodigo(u.Correo, codigo);

    // Guardar explícitamente la sesión antes de responder
    req.session.save((err) => {
      if (err) {
        console.error('Error al guardar sesión:', err);
        return res.status(500).json({ ok: false, mensaje: 'Error al iniciar sesión' });
      }
      console.log(`[LOGIN] Sesión guardada con ID: ${req.sessionID} para usuario: ${u.Correo}`);
      // No devolvemos el código en la respuesta, solo a la terminal
      res.json({
        ok: true,
        correo: enmascarar(u.Correo)
      });
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

export const verificar = (req, res) => {
  const p = req.session.pendiente;
  const codigoRecibido = String(req.body.codigo || '').trim();

  console.log(`[VERIFICAR] Código recibido: "${codigoRecibido}" | Sesión ID: ${req.sessionID} | ¿Pendiente existe?: ${p ? 'SÍ' : 'NO'}`);

  if (!p) {
    return res.status(401).json({ ok: false, mensaje: 'Sesión no encontrada o expirada. Por favor inicia sesión de nuevo.' });
  }

  if (Date.now() > p.expira || p.intentos >= 3) {
    delete req.session.pendiente;
    req.session.save(() => {
      res.status(401).json({ ok: false, mensaje: 'Código expirado o límite de intentos alcanzado. Inicia sesión de nuevo.' });
    });
    return;
  }

  if (codigoRecibido !== String(p.codigo).trim()) {
    p.intentos++;
    console.log(`[VERIFICAR] Código incorrecto. Recibido: "${codigoRecibido}", Esperado: "${p.codigo}". Intento ${p.intentos}/3`);
    req.session.save(() => {
      res.status(401).json({ ok: false, mensaje: 'Código incorrecto.' });
    });
    return;
  }

  // Código correcto
  req.session.usuario = { id: p.id, nombre: p.nombre, correo: p.correo };
  delete req.session.pendiente;

  req.session.save((err) => {
    if (err) {
      console.error('Error al guardar sesión de usuario:', err);
      return res.status(500).json({ ok: false, mensaje: 'Error al autenticar' });
    }
    console.log(`[VERIFICAR] Autenticación exitosa para: ${req.session.usuario.correo}`);
    res.json({ ok: true, redirect: 'Dashboard.html' });
  });
};

export const sesion = (req, res) => {
  res.json({ ok: true, usuario: req.session.usuario });
};

export const logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
};