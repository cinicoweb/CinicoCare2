import React, { useState } from 'react';
import { X, User as UserIcon, Mail, Phone, Lock, Check, AlertCircle, ShieldCheck, Key } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
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
            <label className="block font-semibold text-slate-700 mb-1">Numero Cellulare (per notifiche WhatsApp)</label>
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

