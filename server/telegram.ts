import { JsonDatabase } from './db';
import { TelegramBotConfig, User } from '../src/types';

export function getTelegramConfig(): TelegramBotConfig {
  const db = JsonDatabase.getInstance().getData();
  if (db.telegramConfig && db.telegramConfig.botToken) {
    return db.telegramConfig;
  }

  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '8765733787:AAHubCXTDstfLVvktRU62SFKJM1LksTra2E',
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'Guardian32170_bot',
    isActive: true
  };
}

export function getTelegramApiBase(token?: string): string {
  const t = token || getTelegramConfig().botToken;
  return `https://api.telegram.org/bot${t}`;
}

export function getTelegramDeepLink(userId: string): string {
  const username = getTelegramConfig().botUsername || 'Guardian32170_bot';
  if (!userId) return `https://t.me/${username}`;
  return `https://t.me/${username}?start=${userId.trim()}`;
}

export interface SendTelegramResult {
  success: boolean;
  messageId?: number;
  error?: string;
  response?: any;
}

/**
 * Test Telegram bot connection and get bot metadata via /getMe
 */
export async function testTelegramBot(token?: string): Promise<{
  success: boolean;
  bot?: any;
  error?: string;
}> {
  const botToken = token || getTelegramConfig().botToken;
  if (!botToken) {
    return { success: false, error: 'Token Bot Telegram non configurato' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await res.json();
    if (data.ok && data.result) {
      return {
        success: true,
        bot: data.result
      };
    } else {
      return {
        success: false,
        error: data.description || 'Token bot non valido o non autorizzato da Telegram'
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: `Errore connessione a Telegram API: ${err.message || err}`
    };
  }
}

/**
 * Delete any active webhook on Telegram so getUpdates polling works cleanly
 */
export async function deleteTelegramWebhook(token?: string): Promise<{ success: boolean; message: string }> {
  const botToken = token || getTelegramConfig().botToken;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=false`);
    const data = await res.json();
    if (data.ok) {
      return { success: true, message: 'Webhook Telegram rimosso con successo (polling attivo)' };
    }
    return { success: false, message: data.description || 'Errore rimozione webhook' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Errore di rete' };
  }
}

/**
 * Send a message via Telegram Bot.
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

  const config = getTelegramConfig();
  if (!config.botToken) {
    return { success: false, error: 'Bot Telegram non configurato nel sistema' };
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
    const res = await fetch(`${getTelegramApiBase()}/sendMessage`, {
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

let lastUpdateOffset = 0;

/**
 * Polling and processing Telegram updates to auto-link users via `/start <userId>` or email
 */
export async function processTelegramUpdates(): Promise<{
  processedCount: number;
  linkedUsers: string[];
  lastOffset: number;
}> {
  const config = getTelegramConfig();
  if (!config.botToken) {
    return { processedCount: 0, linkedUsers: [], lastOffset: 0 };
  }

  try {
    const apiBase = getTelegramApiBase(config.botToken);
    const url = lastUpdateOffset > 0
      ? `${apiBase}/getUpdates?offset=${lastUpdateOffset}&limit=50&timeout=1`
      : `${apiBase}/getUpdates?limit=50&timeout=1`;

    let res = await fetch(url);
    let data: any;
    try {
      data = await res.json();
    } catch {
      return { processedCount: 0, linkedUsers: [], lastOffset: lastUpdateOffset };
    }

    // If webhook conflict error (409), clear webhook first and retry
    if (!data.ok && data.error_code === 409) {
      await fetch(`${apiBase}/deleteWebhook?drop_pending_updates=false`);
      res = await fetch(url);
      data = await res.json();
    }

    if (!data.ok || !Array.isArray(data.result)) {
      return { processedCount: 0, linkedUsers: [], lastOffset: lastUpdateOffset };
    }

    const db = JsonDatabase.getInstance().getData();
    const linkedUsers: string[] = [];
    let processedCount = 0;

    for (const update of data.result) {
      if (update.update_id && update.update_id >= lastUpdateOffset) {
        lastUpdateOffset = update.update_id + 1;
      }

      const msg = update.message || update.edited_message;
      if (!msg) continue;

      const text = (msg.text || '').trim();
      const chatId = String(msg.chat.id);
      const username = msg.from?.username || msg.from?.first_name || '';

      if (!text) continue;

      processedCount++;

      // Check for /start or start command
      const match = text.match(/^\/?start(?:=|\s+)?(.+)?$/i);
      let candidateId = match ? match[1]?.trim() : null;

      // If user typed an email address directly
      const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const directEmail = emailMatch ? emailMatch[1].toLowerCase() : null;

      let targetUser: User | undefined;

      if (candidateId) {
        // Strip out leading query chars if any
        candidateId = candidateId.replace(/^start=/, '').trim();
        targetUser = db.users.find(
          u => u.id === candidateId ||
               u.id.toLowerCase() === candidateId!.toLowerCase() ||
               u.email.toLowerCase() === candidateId!.toLowerCase()
        );
      }

      if (!targetUser && directEmail) {
        targetUser = db.users.find(u => u.email.toLowerCase() === directEmail);
      }

      if (targetUser) {
        const alreadyLinked = targetUser.telegramChatId === chatId;
        targetUser.telegramChatId = chatId;
        targetUser.telegramUsername = username;
        targetUser.telegramConnectedAt = new Date().toISOString();

        linkedUsers.push(`${targetUser.name} (${targetUser.email})`);

        if (!alreadyLinked) {
          // Send confirmation response to user on Telegram
          await sendTelegramMessage(
            chatId,
            `👋 <b>Ciao ${targetUser.name}!</b>\n\n` +
            `✅ Il tuo account <b>CinicoCare</b> (<code>${targetUser.email}</code>) è stato collegato con successo al bot Guardian (<code>@${config.botUsername}</code>).\n\n` +
            `D'ora in poi riceverai direttamente qui su Telegram i promemoria e gli avvisi di somministrazione dei farmaci per i tuoi assistiti, con pulsanti di conferma rapida a 1 tocco.`,
            { parseMode: 'HTML' }
          );
        }
      } else if (match && !candidateId) {
        // User sent just /start without ID
        await sendTelegramMessage(
          chatId,
          `👋 <b>Benvenuto nel Bot Guardian di CinicoCare!</b>\n\n` +
          `Per collegare il tuo account e ricevere i promemoria dei farmaci sul tuo telefono:\n` +
          `1️⃣ Rispondi a questo messaggio scrivendo la tua <b>email di registrazione</b> a CinicoCare.\n` +
          `2️⃣ Oppure apri l'app CinicoCare, vai nel tuo Profilo e tocca <b>"Collega il tuo account Telegram"</b>.`,
          { parseMode: 'HTML' }
        );
      }
    }

    if (linkedUsers.length > 0) {
      JsonDatabase.getInstance().persist();
    }

    return { processedCount, linkedUsers, lastOffset: lastUpdateOffset };
  } catch (err) {
    console.error('Error fetching Telegram updates:', err);
    return { processedCount: 0, linkedUsers: [], lastOffset: lastUpdateOffset };
  }
}

/**
 * Background auto-polling scheduler for Telegram
 */
let pollingInterval: NodeJS.Timeout | null = null;

export function startTelegramPolling() {
  if (pollingInterval) return;
  // Poll Telegram every 8 seconds
  pollingInterval = setInterval(async () => {
    try {
      await processTelegramUpdates();
    } catch (e) {
      // Quiet background catch
    }
  }, 8000);
}

export function stopTelegramPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

export function getTelegramStatus() {
  const config = getTelegramConfig();
  return {
    pollingRunning: Boolean(pollingInterval),
    botUsername: config.botUsername,
    hasToken: Boolean(config.botToken),
    botInfo: config.botInfo || null
  };
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
  const config = getTelegramConfig();
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
          Per ricevere i promemoria delle terapie e gli avvisi urgenti dei tuoi assistiti, collega il bot Telegram <strong>@${config.botUsername}</strong> con un solo tocco:
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
2. Premi "AVVIA" (/start) nella chat con il bot @${config.botUsername}
Il tuo profilo verrà collegato istantaneamente.
  `.trim();

  return { subject, html, text };
}
