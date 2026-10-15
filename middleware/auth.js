export const requiereSesion = (req, res, next) => {
  if (req.session.usuario) return next();
  return res.status(401).json({ ok: false, mensaje: 'Sesión no válida' });
};