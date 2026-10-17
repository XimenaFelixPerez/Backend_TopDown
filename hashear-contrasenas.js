// Ejecútalo UNA vez:  node hashear-contrasenas.js
// Convierte las contraseñas en texto plano a hash (bcrypt) y borra el texto plano.
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const r = await pool.request().query(`
  SELECT Id, Correo, Contrasena FROM Usuarios
  WHERE ContrasenaHash IS NULL AND Contrasena IS NOT NULL AND Contrasena <> ''`);

for (const u of r.recordset) {
  const hash = await bcrypt.hash(u.Contrasena, 10);
  await pool.request()
    .input('id', u.Id)
    .input('hash', hash)
    .query('UPDATE Usuarios SET ContrasenaHash = @hash, Contrasena = NULL WHERE Id = @id');
  console.log('Hash listo para', u.Correo);
}

console.log(`Terminado: ${r.recordset.length} usuario(s) actualizados.`);
process.exit(0);
