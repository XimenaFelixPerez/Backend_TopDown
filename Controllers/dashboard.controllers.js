import { pool, sql } from '../db.js';
import { empleadoDeSesion, redondear } from '../utils/sesion.js';

// GET /api/dashboard
export const getDashboard = async (req, res) => {
  try {
    const e = await empleadoDeSesion(req);
    if (!e) return res.status(404).json({ ok: false, mensaje: 'Empleado no encontrado' });

    const ult = await pool.request()
      .input('eid', sql.Int, e.Id)
      .query(`
        SELECT TOP 1 r.Id, r.Mes, r.Anio, r.FechaPago,
               SUM(CASE WHEN c.Tipo = 'P' THEN c.Monto ELSE 0 END) AS Bruto,
               SUM(CASE WHEN c.Tipo = 'D' THEN c.Monto ELSE 0 END) AS Deducciones
        FROM Recibos r
        JOIN ConceptosRecibo c ON c.ReciboId = r.Id
        WHERE r.EmpleadoId = @eid
        GROUP BY r.Id, r.Mes, r.Anio, r.FechaPago
        ORDER BY r.Anio DESC, r.Mes DESC`);

    const eventos = await pool.request().query(`
      SELECT TOP 5 Fecha, Descripcion
      FROM Eventos
      WHERE Fecha >= CAST(GETDATE() AS DATE)
      ORDER BY Fecha`);

    const u = ult.recordset[0];
    res.json({
      ok: true,
      empleado: {
        nombre: e.Nombre,
        numero: e.NumeroEmpleado,
        puesto: e.Puesto,
        departamento: e.Departamento,
        ingreso: e.FechaIngreso,
      },
      ultimoRecibo: u ? {
        id: u.Id,
        mes: u.Mes,
        anio: u.Anio,
        fechaPago: u.FechaPago,
        bruto: redondear(u.Bruto),
        neto: redondear(u.Bruto - u.Deducciones),
      } : null,
      eventos: eventos.recordset,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: 'Error al cargar el inicio' });
  }
};
