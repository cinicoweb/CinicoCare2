import React, { useState, useEffect } from 'react';
import {
  Pill,
  Heart,
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  Users,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  X,
  Sparkles,
  Check,
  KeyRound,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';
import { formatPhoneNumber } from '../utils/phone';
import { validatePasswordWithConfirmation } from '../utils/security';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  onOpenInfo: () => void;
  onOpenPrivacyDisclaimer: () => void;
  invitationToken?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenInfo,
  onOpenPrivacyDisclaimer,
  invitationToken
}) => {
  // Tabs: 'login' (solo utenti registrati) | 'register' (crea nuova famiglia)
  // If arrived via invite link (?invite=TOKEN), isInviteMode is true
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [isInviteMode, setIsInviteMode] = useState<boolean>(Boolean(invitationToken));
  const [inviteToken, setInviteToken] = useState<string>(invitationToken || '');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [gdprAccepted, setGdprAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check URL search params for invite token
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = invitationToken || urlParams.get('invite');
    if (tokenFromUrl) {
      setInviteToken(tokenFromUrl);
      setIsInviteMode(true);
    } else {
      setIsInviteMode(false);
    }
  }, [invitationToken, isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await api.login(cleanEmail, password);
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Credenziali di accesso non valide. Verifica email e password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterOrAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('L\'indirizzo email è obbligatorio.');
      return;
    }

    if (!name.trim()) {
      setError('Inserisci il tuo nome e cognome.');
      return;
    }

    // Password validation: 2x input, min 8 chars, 1 uppercase, 1 number
    const passValidation = validatePasswordWithConfirmation(password, confirmPassword);
    if (!passValidation.isValid) {
      setError(passValidation.error || 'La password non rispetta i criteri minimi di sicurezza.');
      return;
    }

    if (!gdprAccepted) {
      setError('È obbligatorio accettare l\'informativa privacy e il declino di responsabilità (GDPR).');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = phone.trim() ? formatPhoneNumber(phone.trim()) : undefined;

      const res = await api.register({
        email: cleanEmail,
        password,
        name: name.trim(),
        phone: formattedPhone,
        familyName: isInviteMode ? undefined : (familyName.trim() || `Famiglia ${name.trim().split(' ')[0]}`),
        invitationToken: isInviteMode ? inviteToken.trim() : undefined,
        gdprAccepted
      });

      // Clear invite query param from URL if present
      if (window.history && window.history.replaceState) {
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
      }

      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Errore durante la registrazione. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-8 relative">
        
        {/* Header */}
        <div className="bg-gradient-to-br from-sky-700 via-sky-800 to-teal-800 p-7 text-white text-center relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Chiudi finestra"
            aria-label="Chiudi finestra"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mx-auto w-14 h-14 bg-gradient-to-tr from-sky-500 to-teal-400 backdrop-blur-md rounded-2xl flex items-center justify-center mb-2.5 shadow-lg shadow-sky-950/30 border border-white/20">
            <Pill className="w-8 h-8 text-white rotate-45" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-['Outfit'] tracking-tight">CinicoCare</h1>
          <p className="text-sky-100 text-xs sm:text-sm mt-1 max-w-sm mx-auto">
            {isInviteMode
              ? 'Invito Ricevuto: Completa la registrazione per unirti al gruppo famiglia'
              : 'Gestione coordinata somministrazione farmaci & caregiver'}
          </p>
        </div>

        {/* Tab Toggle - Solo 2 tab: Login e Registrazione (Crea Famiglia) */}
        {!isInviteMode && (
          <div className="flex border-b border-slate-100 bg-slate-50 p-1.5 gap-1">
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setError(null); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'login'
                  ? 'bg-white text-sky-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Accedi (Utenti Registrati)
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('register'); setError(null); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'register'
                  ? 'bg-white text-sky-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Registrazione (Crea Famiglia)
            </button>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 sm:p-7">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: LOGIN (SOLO UTENTI REGISTRATI) */}
          {!isInviteMode && activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email di Accesso *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@esempio.it"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-100 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="La tua password"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-100 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors mt-2"
              >
                {loading ? 'Accesso in corso...' : 'Accedi a CinicoCare'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* TAB 2 & INVITE MODE: REGISTRAZIONE UNICO FLUSSO */}
          {(isInviteMode || activeTab === 'register') && (
            <form onSubmit={handleRegisterOrAcceptInvite} className="space-y-3.5">
              
              {/* Informative Note: Se vuoi unirti a una famiglia esistente */}
              {!isInviteMode ? (
                <div className="p-3.5 bg-amber-50/90 border border-amber-300/90 rounded-2xl flex items-start gap-2.5 text-xs text-amber-950 shadow-xs">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="leading-relaxed text-[12px] font-medium">
                    <strong className="text-amber-950 font-bold">Vuoi unirti a una famiglia già esistente?</strong> Chiedi all'amministratore di quella famiglia di inviarti un link d'invito via email, WhatsApp o Telegram.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl flex items-start gap-2.5 text-xs text-teal-900">
                  <KeyRound className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-teal-950">Invito Monouso Riconosciuto</p>
                    <p className="text-[11px] text-teal-800 mt-0.5">
                      Completa la tua anagrafica e crea la tua password personale per unirti al gruppo famiglia invitante.
                    </p>
                  </div>
                </div>
              )}

              {/* Nome Gruppo Famiglia (solo se registrazione nuova) */}
              {!isInviteMode && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nome del Gruppo Famiglia</label>
                  <div className="relative">
                    <Users className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      placeholder="Es. Famiglia Rossi"
                      className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-100 outline-none transition-all"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Il gruppo è chiuso e sicuro, visibile solo ai collaboratori che inviterai.</span>
                </div>
              )}

              {/* Nome e Cognome */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome e Cognome *</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Es. Maria Rossi"
                    className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-100 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Email & Telefono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email * (Login univoca)</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nome@email.it"
                      className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-100 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cellulare (opzionale)</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+39 347 1234567"
                      className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-100 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Password 1 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password * <span className="text-[10px] text-slate-500 font-normal">(min. 8 caratteri, 1 maiuscola, 1 numero)</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Almeno 8 caratteri, 1 Maiuscola, 1 Numero"
                    className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-100 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password 2 (Conferma) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Conferma Password * <span className="text-[10px] text-slate-500 font-normal">(Digita di nuovo la password)</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ripeti la stessa password"
                    className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-100 outline-none transition-all"
                  />
                </div>
              </div>

              {/* GDPR Sensitive Data Consent Checkbox with click link */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer select-none bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <input
                    type="checkbox"
                    required
                    checked={gdprAccepted}
                    onChange={(e) => setGdprAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-sky-700 border-slate-300 focus:ring-sky-600 shrink-0"
                  />
                  <span className="text-[11px] text-slate-600 leading-relaxed">
                    Dichiaro di aver preso visione dell'
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPrivacyDisclaimer();
                      }}
                      className="text-sky-700 font-bold underline hover:text-sky-900 mx-1 inline"
                    >
                      Informativa Privacy (GDPR) e Declino di Responsabilità
                    </button>
                    ed acconsento al trattamento dei dati sanitari minimi necessari per la gestione delle terapie.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors mt-2"
              >
                {loading
                  ? 'Registrazione in corso...'
                  : isInviteMode
                  ? 'Completa Registrazione e Unisciti'
                  : 'Crea Gruppo Famiglia e Inizia'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Privacy & Legal disclaimer footer */}
          <div className="mt-5 pt-4 border-t border-slate-100 text-center flex flex-col items-center gap-1">
            <button
              onClick={onOpenPrivacyDisclaimer}
              className="text-xs text-sky-700 hover:text-sky-900 font-semibold underline inline-flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Informativa Privacy & Trasparenza GDPR
            </button>
            <button
              onClick={onOpenInfo}
              className="text-[11px] text-slate-500 hover:text-slate-700"
            >
              Ideata e realizzata da Nicola Cirillo • Copyright © 2026
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
