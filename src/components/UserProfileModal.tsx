import React, { useState } from 'react';
import { X, User as UserIcon, Mail, Phone, Lock, Check, AlertCircle, Key, Bot, ExternalLink, RefreshCw, Unlink } from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';
import { validatePasswordWithConfirmation } from '../utils/security';
import { formatPhoneNumber } from '../utils/phone';

interface UserProfileModalProps {
  isOpen: boolean;
  user: User;
  onClose: () => void;
  onUserUpdated: (updatedUser: User) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  user,
  onClose,
  onUserUpdated
}) => {
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordMode, setChangePasswordMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingTg, setSyncingTg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const telegramLink = api.getTelegramDeepLink(user.id);

  const handleSyncTelegram = async () => {
    setSyncingTg(true);
    setError(null);
    try {
      await api.syncTelegramUpdates();
      const status = await api.checkTelegramStatus();
      if (status.connected) {
        const updated = {
          ...user,
          telegramChatId: status.chatId || user.telegramChatId,
          telegramUsername: status.username || user.telegramUsername,
          telegramConnectedAt: status.connectedAt || user.telegramConnectedAt
        };
        onUserUpdated(updated);
        setSuccessMsg('Account Telegram collegato e sincronizzato!');
      } else {
        setSuccessMsg('Nessun nuovo messaggio di avvio rilevato. Clicca su "Collega il tuo account Telegram" e premi "Avvia" nel bot @Guardian32170_bot.');
      }
    } catch (e: any) {
      setError(e.message || 'Errore sincronizzazione Telegram');
    } finally {
      setSyncingTg(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!confirm('Sei sicuro di voler scollegare Telegram? Non riceverai più notifiche su @Guardian32170_bot.')) return;
    setSaving(true);
    try {
      await api.unlinkTelegram(user.id);
      const updated = {
        ...user,
        telegramChatId: undefined,
        telegramUsername: undefined,
        telegramConnectedAt: undefined
      };
      onUserUpdated(updated);
      setSuccessMsg('Account Telegram scollegato.');
    } catch (e: any) {
      setError(e.message || 'Errore durante la disconnessione');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) {
      setError('L\'indirizzo email è obbligatorio.');
      return;
    }

    if (changePasswordMode) {
      if (!currentPassword) {
        setError('Inserisci la tua password attuale per autorizzare la modifica.');
        return;
      }
      const val = validatePasswordWithConfirmation(newPassword, confirmPassword);
      if (!val.isValid) {
        setError(val.error || 'La nuova password non rispetta i criteri di sicurezza richiesti.');
        return;
      }
    }

    setSaving(true);
    try {
      const formattedPhone = phone ? formatPhoneNumber(phone) : '';
      const res = await api.updateProfile({
        name: name.trim(),
        email: cleanEmail,
        phone: formattedPhone,
        currentPassword: changePasswordMode ? currentPassword : undefined,
        newPassword: changePasswordMode ? newPassword : undefined
      });
      onUserUpdated(res.user);
      setSuccessMsg('Profilo e credenziali aggiornati con successo!');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'aggiornamento del profilo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-700 via-sky-800 to-teal-800 p-6 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
              <UserIcon className="w-6 h-6 text-sky-200" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-['Outfit'] tracking-tight">Il Mio Profilo & Accesso</h2>
              <p className="text-sky-100 text-xs mt-0.5">
                {user.role === 'superadmin' ? 'Amministratore Generale Sistema' : 'Impostazioni Account Personale'}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2 font-semibold">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TELEGRAM BOT CONNECTION CARD */}
          <div className="p-4 bg-gradient-to-br from-sky-50 to-cyan-50/70 rounded-2xl border border-sky-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-sky-600 text-white rounded-xl">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs font-['Outfit']">Notifiche Telegram Bot</h4>
                  <p className="text-[10px] text-sky-800">Bot ufficiale @Guardian32170_bot</p>
                </div>
              </div>

              {user.telegramChatId ? (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Collegato
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold">
                  Non Collegato
                </span>
              )}
            </div>

            {user.telegramChatId ? (
              <div className="space-y-2 pt-1 text-[11px] text-slate-700">
                <p>
                  ✅ Il tuo account è collegato a Telegram {user.telegramUsername ? `(@${user.telegramUsername})` : ''}. Riceverai i solleciti dei farmaci in tempo reale con tasto di conferma rapido.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSyncTelegram}
                    disabled={syncingTg}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncingTg ? 'animate-spin' : ''}`} />
                    Verifica Stato
                  </button>
                  <button
                    type="button"
                    onClick={handleUnlinkTelegram}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition-colors"
                  >
                    <Unlink className="w-3 h-3" />
                    Scollega
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 pt-1 text-[11px] text-slate-700">
                <p className="leading-relaxed">
                  Collega il bot Telegram per ricevere allarmi, promemoria dei farmaci e confermare le somministrazioni a 1 tocco:
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <a
                    href={telegramLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors text-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Collega il tuo account Telegram
                  </a>
                  <button
                    type="button"
                    onClick={handleSyncTelegram}
                    disabled={syncingTg}
                    className="py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold rounded-xl flex items-center justify-center gap-1 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingTg ? 'animate-spin' : ''}`} />
                    Verifica
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nome e Cognome *</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-slate-800 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email di Accesso * (Login univoca)</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-slate-800 font-medium"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Puoi modificare la tua email; verrà verificata l'univocità nel sistema.</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Numero Cellulare (opzionale per reperibilità)</label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+39 347 1234567"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-slate-800"
              />
            </div>
          </div>

          {/* Password change accordion */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-sky-700" />
                Sicurezza & Password
              </span>
              <button
                type="button"
                onClick={() => setChangePasswordMode(!changePasswordMode)}
                className="text-sky-700 hover:text-sky-900 font-bold text-[11px] underline"
              >
                {changePasswordMode ? 'Annulla cambio password' : 'Modifica Password'}
              </button>
            </div>

            {changePasswordMode && (
              <div className="mt-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-fade-in">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Password Attuale *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Inserisci la password attuale"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-sky-600 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nuova Password * (min. 8 caratteri, 1 maiuscola, 1 numero)</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Almeno 8 caratteri, Maiuscola, Numero"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-sky-600 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Conferma Nuova Password * (Digita di nuovo)</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ripeti la nuova password identica"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-sky-600 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-xl shadow-xs transition-colors"
            >
              {saving ? 'Salvataggio...' : 'Salva Modifiche'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};


