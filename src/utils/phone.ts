// Utility for International phone number formatting, password security validation, and notification messaging

export function getDefaultCountryCallingCode(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('it')) return '+39';
    if (lang.startsWith('en-gb')) return '+44';
    if (lang.startsWith('en-us') || lang.startsWith('en-ca')) return '+1';
    if (lang.startsWith('fr')) return '+33';
    if (lang.startsWith('de')) return '+49';
    if (lang.startsWith('es')) return '+34';
    if (lang.startsWith('pt')) return '+351';
    if (lang.startsWith('ch')) return '+41';
  }
  return '+39';
}

/**
 * Format phone number ensuring it has an international country code (+39 default).
 */
export function formatPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (!trimmed) return '';

  // Remove any whitespace or special characters except '+'
  let cleaned = trimmed.replace(/[\s\-().]/g, '');

  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }

  // If already starts with '+'
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Otherwise, attach the default country code (+39)
  const defaultPrefix = getDefaultCountryCallingCode();
  return `${defaultPrefix}${cleaned}`;
}

/**
 * Password policy validation:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 number
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: 'La password deve contenere almeno 8 caratteri.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'La password deve contenere almeno una lettera maiuscola (A-Z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'La password deve contenere almeno un numero (0-9).' };
  }
  return { valid: true };
}

/**
 * Generates WhatsApp share/direct messaging link.
 */
export function buildWhatsAppShareUrl(phone: string | undefined, text: string): string {
  const formatted = formatPhoneNumber(phone);
  const cleanDigits = formatted ? formatted.replace(/[^0-9]/g, '') : '';
  const encodedText = encodeURIComponent(text);
  if (cleanDigits) {
    return `https://api.whatsapp.com/send?phone=${cleanDigits}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Generates Telegram share/direct link.
 */
export function buildTelegramShareUrl(text: string, phoneOrUsername?: string): string {
  const encodedText = encodeURIComponent(text);
  if (phoneOrUsername) {
    const trimmed = phoneOrUsername.trim();
    if (trimmed.startsWith('@')) {
      return `https://t.me/${trimmed.substring(1)}?text=${encodedText}`;
    }
  }
  return `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodedText}`;
}

export interface CaregiverMessageParams {
  caregiverName: string;
  patientName: string;
  medicationName: string;
  dosage?: string | null;
  scheduledTime: string;
  instructions?: string | null;
  confirmUrl?: string;
  template?: string;
}

/**
 * Builds the customized alert message for WhatsApp & Telegram.
 */
export function formatCaregiverAlertMessage(params: CaregiverMessageParams): string {
  const {
    caregiverName,
    patientName,
    medicationName,
    dosage,
    scheduledTime,
    instructions,
    confirmUrl
  } = params;

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const finalConfirmUrl = confirmUrl || appOrigin;
  const dosageText = dosage && dosage.trim() ? ` (${dosage.trim()})` : '';
  const instrText = instructions && instructions.trim() ? `\n📝 Istruzioni: ${instructions.trim()}` : '';

  if (params.template && params.template.trim()) {
    return params.template
      .replace(/{caregiver}/g, caregiverName)
      .replace(/{paziente}/g, patientName)
      .replace(/{farmaco}/g, medicationName)
      .replace(/{dosaggio}/g, dosageText)
      .replace(/{orario}/g, scheduledTime)
      .replace(/{istruzioni}/g, instructions || 'Nessuna istruzione particolare')
      .replace(/{link_conferma}/g, finalConfirmUrl);
  }

  return `🔔 *CinicoCare Promemoria Terapia*
Ciao *${caregiverName}*, è ora del farmaco per *${patientName}*!

💊 Farmaco: *${medicationName}*${dosageText}
⏰ Orario previsto: *${scheduledTime}*${instrText}

👉 *Conferma somministrazione con 1 tocco nell'App:*
${finalConfirmUrl}`;
}
