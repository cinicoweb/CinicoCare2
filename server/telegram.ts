import { JsonDatabase } from './db';
import { User } from '../src/types';

export const TELEGRAM_BOT_TOKEN = '8765733787:AAHubCXTDstfLVvktRU62SFKJM1LksTra2E';
export const TELEGRAM_BOT_USERNAME = 'Guardian32170_bot';
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export function getTelegramDeepLink(userId: string): string {
  if (!userId) return `https://t.me/${TELEGRAM_BOT_USERNAME}`;
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${userId.trim()}`;
}

export interface SendTelegramResult {
  success: boolean;
  messageId?: number;
  error?: string;
  response?: any;
}

/**
 * Send a message via the Guardian Telegram Bot.
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: {
    inlineKeyboard?: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
    parseMode?: 'HTML' | 'Markdown';
  }
): Promise<SendTelegramResult> {
  if (!chatId) {
    return { success: false, error: 'Chat ID Telegram non specificato' };
  }

  const payload: any = {
    chat_id: chatId,
    text,
    parse_mode: options?.parseMode || 'HTML'
  };

  if (options?.inlineKeyboard && options.inlineKeyboard.length > 0) {
    payload.reply_markup = {
      inline_keyboard: options.inlineKeyboard
    };
  }

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.ok) {
      return {
        success: true,
        messageId: data.result?.message_id,
        response: data.result
      };
    } else {
      return {
        success: false,
        error: data.description || 'Errore risposta API Telegram',
        response: data
      };
    }
  } catch (err: any) {
    console.error('Error sending Telegram message:', err);
    return {
      success: false,
      error: err.message || 'Errore di connessione a Telegram API'
    };
  }
}

/**
 * Polling and processing Telegram updates to auto-link users via `/start <userId>`
 */
export async function processTelegramUpdates(): Promise<{
  processedCount: number;
  linkedUsers: string[];
}> {
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/getUpdates?limit=50&timeout=2`);
    const data = await res.json();

    if (!data.ok || !Array.isArray(data.result)) {
      return { processedCount: 0, linkedUsers: [] };
    }

    const db = JsonDatabase.getInstance().getData();
    const linkedUsers: string[] = [];
    let processedCount = 0;

    for (const update of data.result) {
      const msg = update.message || update.edited_message;
      if (!msg || !msg.text) continue;

      const text = msg.text.trim();
      const chatId = String(msg.chat.id);
      const username = msg.from?.username || msg.from?.first_name || '';

      // Check if message is a /start command with user ID
      // Formats supported: "/start <userId>", "/start=<userId>", or "start <userId>"
      const match = text.match(/^\/start(?:=|\s+)?(.+)?$/i);
      if (match) {
        processedCount++;
        const candidateId = match[1]?.trim();

        if (candidateId) {
          // Look up user by ID (or email if supplied)
          const targetUser = db.users.find(
            u => u.id === candidateId || u.id.toLowerCase() === candidateId.toLowerCase() || u.email.toLowerCase() === candidateId.toLowerCase()
          );

          if (targetUser) {
            const alreadyLinked = targetUser.telegramChatId === chatId;
            targetUser.telegramChatId = chatId;
            targetUser.telegramUsername = username;
            targetUser.telegramConnectedAt = new Date().toISOString();

            if (!alreadyLinked) {
              linkedUsers.push(`${targetUser.name} (${targetUser.email})`);
              // Send confirmation response to user on Telegram
              await sendTelegramMessage(
                chatId,
                `👋 <b>Ciao ${targetUser.name}!</b>\n\n` +
                `✅ Il tuo account <b>CinicoCare</b> è stato collegato con successo al bot Guardian (<code>@${TELEGRAM_BOT_USERNAME}</code>).\n\n` +
                `D'ora in poi riceverai direttamente qui su Telegram i promemoria e gli avvisi di somministrazione dei farmaci per i tuoi assistiti.`,
                { parseMode: 'HTML' }
              );
            }
          }
        }
      }
    }

    if (linkedUsers.length > 0) {
      JsonDatabase.getInstance().persist();
    }

    return { processedCount, linkedUsers };
  } catch (err) {
    console.error('Error fetching Telegram updates:', err);
    return { processedCount: 0, linkedUsers: [] };
  }
}

/**
 * Generates formatted HTML email content for registration & welcome.
 */
export function generateRegistrationEmailHtml(params: {
  name: string;
  email: string;
  password?: string;
  familyName?: string;
  userId: string;
  role?: string;
  appUrl?: string;
}): { subject: string; html: string; text: string } {
  const { name, email, password, familyName, userId, role, appUrl } = params;
  const appOrigin = appUrl || 'https://cinicocare.vercel.app';
  const telegramLink = getTelegramDeepLink(userId);
  const roleDisplay = role === 'caregiver' ? 'Caregiver Incaricato' : 'Familiare (Amministratore)';

  const subject = `Benvenuto su CinicoCare - Accesso e Collegamento Telegram`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #0369a1, #0d9488); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
    .content { padding: 28px 24px; line-height: 1.6; font-size: 14px; }
    .credentials-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .telegram-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center; }
    .btn-telegram { display: inline-block; background-color: #0284c7; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-weight: 700; font-size: 14px; margin-top: 12px; }
    .btn-login { display: inline-block; background-color: #0f172a; color: #ffffff !important; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-weight: 600; font-size: 13px; }
    .footer { padding: 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #f1f5f9; background: #fafafa; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>CinicoCare</h1>
      <p>Piattaforma di Assistenza e Gestione Terapie Farmaceutiche</p>
    </div>
    <div class="content">
      <p>Gentile <strong>${name}</strong>,</p>
      <p>È stato creato il tuo account su <strong>CinicoCare</strong> ${familyName ? `per il gruppo <em>${familyName}</em>` : ''} con il ruolo di <strong>${roleDisplay}</strong>.</p>
      
      <div class="credentials-box">
        <h3 style="margin-top: 0; color: #166534; font-size: 14px;">🔑 Le tue Credenziali di Accesso</h3>
        <p style="margin: 4px 0;"><strong>Email:</strong> ${email}</p>
        ${password ? `<p style="margin: 4px 0;"><strong>Password provvisoria:</strong> <code>${password}</code></p>` : ''}
        <div style="margin-top: 12px;">
          <a href="${appOrigin}" class="btn-login" target="_blank">Accedi all'Applicazione</a>
        </div>
      </div>

      <div class="telegram-box">
        <h3 style="margin-top: 0; color: #0369a1; font-size: 15px;">🤖 Collega il tuo account Telegram</h3>
        <p style="margin: 8px 0; font-size: 13px; color: #334155;">
          Per ricevere i promemoria delle terapie e gli avvisi urgenti dei tuoi assistiti, collega il bot Telegram <strong>@${TELEGRAM_BOT_USERNAME}</strong> con un solo tocco:
        </p>
        <a href="${telegramLink}" class="btn-telegram" target="_blank">📲 Collega il tuo account Telegram</a>
        <p style="margin-top: 10px; font-size: 11px; color: #64748b;">
          Dopo aver cliccato, premi <strong>AVVIA (/start)</strong> in Telegram. L'associazione con il tuo profilo sarà istantanea e automatica.
        </p>
      </div>

      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
        <em>Nota di riservatezza:</em> CinicoCare è uno strumento di supporto per famiglie e caregiver e non sostituisce il parere medico.
      </p>
    </div>
    <div class="footer">
      CinicoCare &copy; ${new Date().getFullYear()} - Creato da Nicola Cirillo
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Benvenuto su CinicoCare, ${name}!

Il tuo account è pronto ${familyName ? `per il gruppo ${familyName}` : ''} come ${roleDisplay}.

--- CREDENZIALI DI ACCESSO ---
Email: ${email}
${password ? `Password: ${password}` : ''}
Link applicazione: ${appOrigin}

--- COLLEGAMENTO TELEGRAM BOT ---
Per ricevere le notifiche e i promemoria delle terapie sul tuo telefono:
1. Apri questo link diretto: ${telegramLink}
2. Premi "AVVIA" (/start) nella chat con il bot @${TELEGRAM_BOT_USERNAME}
Il tuo profilo verrà collegato istantaneamente.
  `.trim();

  return { subject, html, text };
}
