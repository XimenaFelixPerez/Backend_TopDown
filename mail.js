import 'dotenv/config';
import nodemailer from 'nodemailer';

const transporter = process.env.SMTP_USER
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
  : null;

export const enviarCodigo = async (destino, codigo) => {
  console.log(`\n==================================================`);
  console.log(`   >>> CÓDIGO DE VERIFICACIÓN 2FA: [ ${codigo} ] <<<`);
  console.log(`   Destinatario: ${destino}`);
  console.log(`   Válido por: 5 minutos`);
  console.log(`==================================================\n`);

  if (!transporter) return;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: destino,
      subject: 'Tu código de verificación',
      text: `Tu código es ${codigo}. Expira en 5 minutos.`
    });
  } catch (err) {
    console.error('Error al enviar correo SMTP:', err.message);
  }
};