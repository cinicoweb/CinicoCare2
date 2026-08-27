import nodemailer from 'nodemailer';
import { JsonDatabase } from './db';
import { SmtpConfig } from '../src/types';

/**
 * Retrieves the current SMTP configuration from database or env.
 */
export function getSmtpConfig(): SmtpConfig {
  const db = JsonDatabase.getInstance().getData();
  if (db.smtpConfig && db.smtpConfig.host) {
    return db.smtpConfig;
  }

  return {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromEmail: process.env.SMTP_FROM || 'notifiche@cinicocare.it',
    fromName: process.env.SMTP_FROM_NAME || 'CinicoCare Assistenza',
    isConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER)
  };
}

/**
 * Creates a Nodemailer transport instance if configured.
 */
export function createTransporter(customConfig?: SmtpConfig) {
  const config = customConfig || getSmtpConfig();

  if (!config.host || !config.user) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure, // true for 465, false for other ports
    auth: {
      user: config.user,
      pass: config.pass
    },
    tls: {
      rejectUnauthorized: false // Helps avoid self-signed cert rejections in custom mail servers
    }
  });
}

/**
 * Verifies SMTP connection.
 */
export async function verifySmtpConnection(customConfig?: SmtpConfig): Promise<{ success: boolean; message: string }> {
  const config = customConfig || getSmtpConfig();
  if (!config.host || !config.user) {
    return {
      success: false,
      message: 'Parametri SMTP incompleti (Host e Utente sono obbligatori)'
    };
  }

  try {
    const transporter = createTransporter(config);
    if (!transporter) {
      return { success: false, message: 'Impossibile inizializzare il client SMTP' };
    }

    await transporter.verify();
    return {
      success: true,
      message: `Connessione al server SMTP (${config.host}:${config.port}) verificata con successo!`
    };
  } catch (err: any) {
    console.error('SMTP verification failed:', err);
    return {
      success: false,
      message: `Errore verifica SMTP: ${err.message || err}`
    };
  }
}

/**
 * Sends an email using Nodemailer.
 * If SMTP is not yet configured, returns simulated result without throwing fatal error.
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string; isSimulated?: boolean }> {
  const config = getSmtpConfig();
  const transporter = createTransporter(config);

  if (!transporter) {
    console.log(`[SMTP Not Configured] Email to ${options.to} was simulated: "${options.subject}"`);
    return {
      success: true,
      isSimulated: true,
      error: 'Server SMTP non configurato nel pannello Admin. L\'email è stata simulata in anteprima.'
    };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: options.to,
      subject: options.subject,
      text: options.text || options.subject,
      html: options.html
    });

    console.log(`[SMTP Sent] Message sent to ${options.to}: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      isSimulated: false
    };
  } catch (err: any) {
    console.error(`[SMTP Error] Failed sending email to ${options.to}:`, err);
    return {
      success: false,
      error: err.message || 'Errore durante l\'invio dell\'email via SMTP',
      isSimulated: false
    };
  }
}
