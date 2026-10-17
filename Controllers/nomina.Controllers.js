import { pool, sql } from '../db.js';
import { empleadoDeSesion, redondear } from '../utils/sesion.js';

// GET /api/nomina/recibos  -> lista de recibos del empleado en sesión
export const getRecibos = async (req, res) => {
  try {
    const e = await empleadoDeSesion(req);
    if (!e) return res.status(404).json({ ok: false, mensaje: 'Empleado no encontrado' });

    const r = await pool.request()
      .input('eid', sql.Int, e.Id)
      .query(`
        SELECT r.Id, r.Folio, r.Mes, r.Anio, r.FechaPago, r.Tipo,
               SUM(CASE WHEN c.Tipo = 'P' THEN c.Monto ELSE 0 END) AS Percepciones,
               SUM(CASE WHEN c.Tipo = 'D' THEN c.Monto ELSE 0 END) AS Deducciones
        FROM Recibos r
        JOIN ConceptosRecibo c ON c.ReciboId = r.Id
        WHERE r.EmpleadoId = @eid
        GROUP BY r.Id, r.Folio, r.Mes, r.Anio, r.FechaPago, r.Tipo
        ORDER BY r.Anio DESC, r.Mes DESC`);

    res.json({
      ok: true,
      recibos: r.recordset.map((x) => ({
        id: x.Id,
        folio: x.Folio,
        mes: x.Mes,
        anio: x.Anio,
        fechaPago: x.FechaPago,
        tipo: x.Tipo,
        percepciones: redondear(x.Percepciones),
        deducciones: redondear(x.Deducciones),
        neto: redondear(x.Percepciones - x.Deducciones),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: 'Error al cargar los recibos' });
  }
};

// GET /api/nomina/recibos/:id  -> detalle completo de un recibo
export const getRecibo = async (req, res) => {
  try {
    const e = await empleadoDeSesion(req);
    if (!e) return res.status(404).json({ ok: false, mensaje: 'Empleado no encontrado' });

    const rec = await pool.request()
      .input('id', sql.Int, Number(req.params.id))
      .input('eid', sql.Int, e.Id)
      .query('SELECT * FROM Recibos WHERE Id = @id AND EmpleadoId = @eid');

    const recibo = rec.recordset[0];
    if (!recibo) return res.status(404).json({ ok: false, mensaje: 'Recibo no encontrado' });

    const con = await pool.request()
      .input('rid', sql.Int, recibo.Id)
      .query(`SELECT Concepto, Tipo, Monto FROM ConceptosRecibo
              WHERE ReciboId = @rid ORDER BY Tipo DESC, Id`);

    const conceptos = con.recordset.map((c) => ({ ...c, Monto: redondear(c.Monto) }));
    const suma = (t) => redondear(conceptos.filter((c) => c.Tipo === t).reduce((s, c) => s + c.Monto, 0));
    const percepciones = suma('P');
    const deducciones = suma('D');

    res.json({
      ok: true,
      empresa: {
        nombre: e.EmpresaNombre,
        domicilio: e.EmpresaDomicilio,
        rfc: e.EmpresaRFC,
        regPatronal: e.RegistroPatronal,
      },
      empleado: {
        numero: e.NumeroEmpleado,
        nombre: e.Nombre,
        curp: e.CURP,
        rfc: e.RFC,
        nss: e.NSS,
        puesto: e.Puesto,
        departamento: e.Departamento,
        ingreso: e.FechaIngreso,
        regimen: e.Regimen,
        banco: e.Banco,
        cuenta: e.Cuenta,
      },
      recibo: {
        id: recibo.Id,
        folio: recibo.Folio,
        mes: recibo.Mes,
        anio: recibo.Anio,
        fechaPago: recibo.FechaPago,
        tipo: recibo.Tipo,
      },
      conceptos,
      totales: { percepciones, deducciones, neto: redondear(percepciones - deducciones) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: 'Error al cargar el recibo' });
  }
};

// GET /api/nomina/deducciones  -> deducciones del último recibo + acumulado del año
export const getDeducciones = async (req, res) => {
  try {
    const e = await empleadoDeSesion(req);
    if (!e) return res.status(404).json({ ok: false, mensaje: 'Empleado no encontrado' });

    const ult = await pool.request()
      .input('eid', sql.Int, e.Id)
      .query('SELECT TOP 1 Id, Mes, Anio FROM Recibos WHERE EmpleadoId = @eid ORDER BY Anio DESC, Mes DESC');

    const u = ult.recordset[0];
    if (!u) return res.json({ ok: true, actual: null, acumulado: null });

    const actual = await pool.request()
      .input('rid', sql.Int, u.Id)
      .query(`SELECT Concepto, Monto FROM ConceptosRecibo
              WHERE ReciboId = @rid AND Tipo = 'D' ORDER BY Id`);

    const acumulado = await pool.request()
      .input('eid', sql.Int, e.Id)
      .input('anio', sql.SmallInt, u.Anio)
      .query(`SELECT c.Concepto, SUM(c.Monto) AS Monto
              FROM ConceptosRecibo c JOIN Recibos r ON r.Id = c.ReciboId
              WHERE r.EmpleadoId = @eid AND r.Anio = @anio AND c.Tipo = 'D'
              GROUP BY c.Concepto
              ORDER BY SUM(c.Monto) DESC`);

    const armar = (filas) => {
      const conceptos = filas.map((c) => ({ Concepto: c.Concepto, Monto: redondear(c.Monto) }));
      return { conceptos, total: redondear(conceptos.reduce((s, c) => s + c.Monto, 0)) };
    };

    res.json({
      ok: true,
      actual: { mes: u.Mes, anio: u.Anio, ...armar(actual.recordset) },
      acumulado: { anio: u.Anio, ...armar(acumulado.recordset) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: 'Error al cargar las deducciones' });
  }
};
