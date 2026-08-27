import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Database,
  Users,
  Heart,
  Activity,
  Trash2,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Building,
  Key,
  Download,
  Upload,
  Check,
  Send,
  Mail,
  Bot,
  ExternalLink,
  Sparkles,
  Eye,
  EyeOff,
  CheckCheck,
  Server,
  Lock,
  Settings2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

interface AdminPanelViewProps {
  onRefreshData: () => Promise<void>;
  onOpenProfileModal: () => void;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({ onRefreshData, onOpenProfileModal }) => {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Backup & Restore
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DB Reset double-confirmation state
  const [isResetStep1Open, setIsResetStep1Open] = useState(false);
  const [isResetStep2Open, setIsResetStep2Open] = useState(false);
  const [resetCodeInput, setResetCodeInput] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Telegram Config State
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgBotUsername, setTgBotUsername] = useState('Guardian32170_bot');
  const [tgPollingEnabled, setTgPollingEnabled] = useState(true);
  const [tgStatus, setTgStatus] = useState<any>(null);
  const [tgSaving, setTgSaving] = useState(false);
  const [tgSaveMsg, setTgSaveMsg] = useState<string | null>(null);
  const [tgErrorMsg, setTgErrorMsg] = useState<string | null>(null);
  const [showTgToken, setShowTgToken] = useState(false);

  // SMTP Config State
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState<number>(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFromEmail, setSmtpFromEmail] = useState('notifiche@cinicocare.it');
  const [smtpFromName, setSmtpFromName] = useState('CinicoCare Notifiche');
  const [smtpIsConfigured, setSmtpIsConfigured] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpSaveMsg, setSmtpSaveMsg] = useState<string | null>(null);
  const [smtpErrorMsg, setSmtpErrorMsg] = useState<string | null>(null);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  // SMTP Test State
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);
  const [testEmailError, setTestEmailError] = useState<string | null>(null);

  // Notification Simulator state
  const [simTargetUserId, setSimTargetUserId] = useState<string>('');
  const [simType, setSimType] = useState<'registration_email' | 'therapy_reminder' | 'custom_telegram'>('registration_email');
  const [simCustomMessage, setSimCustomMessage] = useState<string>('');
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [simFeedback, setSimFeedback] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminOverview();
      setOverview(data);
      if (data?.allUsers?.length && !simTargetUserId) {
        const firstCaregiver = data.allUsers.find((u: any) => u.role === 'caregiver') || data.allUsers[0];
        if (firstCaregiver) setSimTargetUserId(firstCaregiver.id);
      }
    } catch (err: any) {
      setError(err.message || 'Errore caricamento pannello amministratore');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigs = async () => {
    try {
      const [tgRes, smtpRes] = await Promise.allSettled([
        api.getAdminTelegramConfig(),
        api.getAdminSmtpConfig()
      ]);

      if (tgRes.status === 'fulfilled') {
        const tgData = tgRes.value;
        if (tgData?.config) {
          setTgBotUsername(tgData.config.botUsername || 'Guardian32170_bot');
          setTgPollingEnabled(tgData.config.pollingEnabled !== false);
        }
        if (tgData?.status) {
          setTgStatus(tgData.status);
        }
      }

      if (smtpRes.status === 'fulfilled') {
        const smtpData = smtpRes.value;
        if (smtpData?.config) {
          setSmtpHost(smtpData.config.host || '');
          setSmtpPort(smtpData.config.port || 587);
          setSmtpSecure(Boolean(smtpData.config.secure));
          setSmtpUser(smtpData.config.user || '');
          setSmtpFromEmail(smtpData.config.fromEmail || 'notifiche@cinicocare.it');
          setSmtpFromName(smtpData.config.fromName || 'CinicoCare Notifiche');
          setSmtpIsConfigured(Boolean(smtpData.config.isConfigured));
        }
      }
    } catch (e) {
      console.warn('Could not load remote telegram/smtp configs:', e);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchConfigs();
  }, []);

  // Save Telegram Bot Config
  const handleSaveTelegramConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setTgSaving(true);
    setTgSaveMsg(null);
    setTgErrorMsg(null);

    try {
      const res = await api.updateAdminTelegramConfig({
        botToken: tgBotToken.trim() || undefined,
        botUsername: tgBotUsername.trim(),
        pollingEnabled: tgPollingEnabled
      });

      setTgSaveMsg(res.message || 'Configurazione Bot Telegram aggiornata con successo!');
      if (res.status) setTgStatus(res.status);
      setTgBotToken(''); // clear token input for security
      setTimeout(() => setTgSaveMsg(null), 5000);
    } catch (err: any) {
      setTgErrorMsg(err.message || 'Errore durante il salvataggio della configurazione Telegram');
    } finally {
      setTgSaving(false);
    }
  };

  // Save SMTP Config
  const handleSaveSmtpConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpSaving(true);
    setSmtpSaveMsg(null);
    setSmtpErrorMsg(null);

    try {
      const res = await api.updateAdminSmtpConfig({
        host: smtpHost.trim(),
        port: Number(smtpPort) || 587,
        secure: smtpSecure,
        user: smtpUser.trim(),
        pass: smtpPass.trim() || undefined,
        fromEmail: smtpFromEmail.trim(),
        fromName: smtpFromName.trim()
      });

      setSmtpSaveMsg(res.message || 'Configurazione SMTP salvata con successo!');
      setSmtpIsConfigured(true);
      setSmtpPass(''); // clear password for security
      setTimeout(() => setSmtpSaveMsg(null), 5000);
    } catch (err: any) {
      setSmtpErrorMsg(err.message || 'Errore durante il salvataggio dei parametri SMTP');
    } finally {
      setSmtpSaving(false);
    }
  };

  // Send Test Email
  const handleSendTestEmail = async () => {
    setTestEmailSending(true);
    setTestEmailResult(null);
    setTestEmailError(null);

    try {
      const res = await api.testAdminSmtp(testEmailRecipient.trim() || undefined);
      setTestEmailResult(res.message || 'Email di test inviata con successo!');
      setTimeout(() => setTestEmailResult(null), 6000);
    } catch (err: any) {
      setTestEmailError(err.message || 'Errore durante il test del server SMTP');
    } finally {
      setTestEmailSending(false);
    }
  };

  const handleStep1Confirm = () => {
    setIsResetStep1Open(false);
    setResetCodeInput('');
    setIsResetStep2Open(true);
  };

  const handleFinalResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetCodeInput.trim().toUpperCase() !== 'CANCELLA') {
      alert('Digita esattamente CANCELLA per confermare');
      return;
    }

    setResetting(true);
    try {
      await api.resetDatabase(resetCodeInput.trim().toUpperCase());
      setIsResetStep2Open(false);
      setResetSuccessMsg('Database resettato con successo alle impostazioni iniziali predefinite.');
      await fetchOverview();
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Errore durante il reset del database');
    } finally {
      setResetting(false);
    }
  };

  const handleExportBackup = () => {
    try {
      const json = api.exportBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cinicocare_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupSuccess('File di backup esportato e scaricato con successo!');
      setTimeout(() => setBackupSuccess(null), 4000);
    } catch (e: any) {
      alert('Errore durante l\'esportazione del backup: ' + e.message);
    }
  };

  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        api.importBackup(text);
        setBackupSuccess('Backup ripristinato con successo nel database!');
        await fetchOverview();
        await onRefreshData();
        setTimeout(() => setBackupSuccess(null), 4000);
      } catch (err: any) {
        alert('Errore durante il ripristino: ' + err.message);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Run Simulation
  const handleRunSimulation = async () => {
    if (!simTargetUserId) {
      alert('Seleziona un utente destinatario');
      return;
    }
    setSimRunning(true);
    setSimFeedback(null);
    try {
      const result = await api.simulateAdminNotification({
        targetUserId: simTargetUserId,
        type: simType,
        customMessage: simCustomMessage.trim() || undefined
      });
      setSimResult(result);
      setSimFeedback('Simulazione completata con successo! Visualizza i dettagli e le anteprime sottostanti.');
    } catch (err: any) {
      alert(err.message || 'Errore durante la simulazione');
    } finally {
      setSimRunning(false);
    }
  };

  // Send Direct Telegram Test Message
  const handleSendLiveTelegramTest = async () => {
    if (!simTargetUserId) return;
    const targetUser = overview?.allUsers?.find((u: any) => u.id === simTargetUserId);
    if (!targetUser?.telegramChatId) {
      alert(`Questo utente non ha ancora collegato il bot Telegram (@${tgBotUsername || 'Guardian32170_bot'}). Può collegarlo aprendo il suo link univoco: ${api.getTelegramDeepLink(simTargetUserId)}`);
      return;
    }

    setSimRunning(true);
    try {
      const text = simCustomMessage.trim() || `🔔 <b>Test Notifica CinicoCare</b>\n\nCiao ${targetUser.name}, questo è un messaggio di test inviato dal Pannello Amministratore tramite @${tgBotUsername || 'Guardian32170_bot'}.`;
      const res = await api.sendTelegramTest({
        userId: simTargetUserId,
        text
      });
      alert(res.message || 'Messaggio inviato su Telegram con successo!');
    } catch (e: any) {
      alert('Errore invio Telegram: ' + e.message);
    } finally {
      setSimRunning(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-black uppercase tracking-wider">
              Riservato SuperAdmin
            </span>
            <h2 className="text-xl font-bold font-['Outfit']">Pannello Amministratore Generale</h2>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Supervisione globale della piattaforma CinicoCare, configurazione dinamica Bot Telegram & Server SMTP, simulatore notifiche e backup database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenProfileModal}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
            title="Modifica profilo e password amministratore"
          >
            <Key className="w-3.5 h-3.5" />
            Modifica Profilo / Password
          </button>

          <button
            onClick={() => { fetchOverview(); fetchConfigs(); }}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Aggiorna Dati
          </button>
        </div>
      </div>

      {resetSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{resetSuccessMsg}</span>
        </div>
      )}

      {backupSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{backupSuccess}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200">
          Caricamento dati aggregati di sistema in corso...
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 text-rose-800 text-xs rounded-2xl border border-rose-200">
          {error}
        </div>
      ) : (
        <>
          {/* Key Global Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 font-['Outfit']">{overview?.totalFamilies || 0}</div>
                  <div className="text-xs text-slate-500 font-semibold">Gruppi Famiglia</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 font-['Outfit']">{overview?.totalPatients || 0}</div>
                  <div className="text-xs text-slate-500 font-semibold">Pazienti Assistiti</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 font-['Outfit']">{overview?.totalTherapies || 0}</div>
                  <div className="text-xs text-slate-500 font-semibold">Terapie Attive</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 font-['Outfit']">{overview?.totalUsers || 0}</div>
                  <div className="text-xs text-slate-500 font-semibold">Utenti Registrati</div>
                </div>
              </div>
            </div>
          </div>

          {/* DYNAMIC CONFIGURATION: TELEGRAM BOT & SMTP SERVER */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1. TELEGRAM BOT CONFIGURATION CARD */}
            <div className="bg-white rounded-2xl p-6 border border-sky-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base font-['Outfit']">
                      Configurazione Bot Telegram
                    </h3>
                    <p className="text-xs text-slate-500">
                      Modifica il bot Telegram (@username e Bot Token) utilizzato per inviare le notifiche.
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200">
                  @{tgBotUsername || 'Guardian32170_bot'}
                </span>
              </div>

              {/* Bot Live Status */}
              {tgStatus && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${tgStatus.pollingRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    <span className="text-slate-700 font-medium">
                      Stato Polling: <strong>{tgStatus.pollingRunning ? 'Attivo & In Ascolto' : 'Disattivato'}</strong>
                    </span>
                  </div>
                  {tgStatus.botInfo && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      Nome Bot: {tgStatus.botInfo.first_name}
                    </span>
                  )}
                </div>
              )}

              {tgSaveMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{tgSaveMsg}</span>
                </div>
              )}

              {tgErrorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{tgErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveTelegramConfig} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Username del Bot Telegram
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono font-bold">@</span>
                    <input
                      type="text"
                      required
                      value={tgBotUsername}
                      onChange={(e) => setTgBotUsername(e.target.value.replace(/^@/, ''))}
                      placeholder="es. Guardian32170_bot"
                      className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    I caregiver riceveranno i link tipo <code>https://t.me/{tgBotUsername || 'NomeBot'}?start=...</code>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Bot Token Telegram (da @BotFather)
                  </label>
                  <div className="relative">
                    <input
                      type={showTgToken ? 'text' : 'password'}
                      value={tgBotToken}
                      onChange={(e) => setTgBotToken(e.target.value)}
                      placeholder="Incolla nuovo token bot per cambiarlo (es. 123456:ABC-DEF...)"
                      className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTgToken(!showTgToken)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showTgToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Lascia vuoto per mantenere il token attualmente attivo in memoria/ambiente.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="tgPolling"
                    checked={tgPollingEnabled}
                    onChange={(e) => setTgPollingEnabled(e.target.checked)}
                    className="w-4 h-4 text-sky-600 rounded"
                  />
                  <label htmlFor="tgPolling" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Abilita sincronizzazione automatica dei messaggi /start in tempo reale (Polling)
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={tgSaving}
                    className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <Bot className="w-4 h-4" />
                    {tgSaving ? 'Salvataggio & Verifica in corso...' : 'Salva & Verifica Bot Telegram'}
                  </button>
                </div>
              </form>
            </div>

            {/* 2. SMTP / EMAIL SERVER CONFIGURATION CARD */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base font-['Outfit']">
                      Server Email / SMTP
                    </h3>
                    <p className="text-xs text-slate-500">
                      Configura il server SMTP (Sendmail, Postfix, Gmail, Brevo, AWS SES) per l'invio reale delle email di benvenuto e promemoria.
                    </p>
                  </div>
                </div>

                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${smtpIsConfigured ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                  {smtpIsConfigured ? 'SMTP Configurato' : 'Predefinito (Log)'}
                </span>
              </div>

              {smtpSaveMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{smtpSaveMsg}</span>
                </div>
              )}

              {smtpErrorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{smtpErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveSmtpConfig} className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Host SMTP (Server)
                    </label>
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="es. smtp.gmail.com o mail.tuoserver.it"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Porta
                    </label>
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(Number(e.target.value))}
                      placeholder="587 o 465"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Nome Utente / Email SMTP
                    </label>
                    <input
                      type="text"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="user@tuodominio.it"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Password / App Password
                    </label>
                    <div className="relative">
                      <input
                        type={showSmtpPass ? 'text' : 'password'}
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmtpPass(!showSmtpPass)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showSmtpPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Indirizzo Mittente (From)
                    </label>
                    <input
                      type="email"
                      value={smtpFromEmail}
                      onChange={(e) => setSmtpFromEmail(e.target.value)}
                      placeholder="notifiche@cinicocare.it"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Nome Mittente
                    </label>
                    <input
                      type="text"
                      value={smtpFromName}
                      onChange={(e) => setSmtpFromName(e.target.value)}
                      placeholder="CinicoCare Assistenza"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="smtpSecure"
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <label htmlFor="smtpSecure" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Usa SSL/TLS Diretto (Attiva per porta 465, disattiva per porta 587 STARTTLS)
                  </label>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={smtpSaving}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <Server className="w-4 h-4" />
                    {smtpSaving ? 'Salvataggio...' : 'Salva Parametri SMTP'}
                  </button>
                </div>
              </form>

              {/* Send Test Email Block */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Invia Email di Test
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={testEmailRecipient}
                    onChange={(e) => setTestEmailRecipient(e.target.value)}
                    placeholder="Tua email per ricevere il test (es. admin@example.com)"
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:border-purple-600 outline-none text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={testEmailSending}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {testEmailSending ? 'Invio...' : 'Invia Test'}
                  </button>
                </div>
                {testEmailResult && (
                  <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    {testEmailResult}
                  </p>
                )}
                {testEmailError && (
                  <p className="text-[11px] font-semibold text-rose-700 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {testEmailError}
                  </p>
                )}
              </div>

            </div>

          </div>

          {/* NOTIFICATION & TELEGRAM SIMULATOR */}
          <div className="bg-white rounded-2xl p-6 border border-sky-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-sky-100 text-sky-700 rounded-lg">
                    <Bot className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base font-['Outfit']">
                    Simulatore Notifiche Mail & Telegram Caregiver
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Testa e simula l'invio delle email di benvenuto con link Telegram univoco o delle notifiche push del bot @{tgBotUsername || 'Guardian32170_bot'} per qualsiasi caregiver.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] bg-sky-50 text-sky-800 border border-sky-200 font-bold px-2.5 py-1 rounded-lg">
                  Bot: @{tgBotUsername || 'Guardian32170_bot'}
                </span>
              </div>
            </div>

            {simFeedback && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{simFeedback}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Target Caregiver selection */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Seleziona Caregiver / Utente Destinatario
                </label>
                <select
                  value={simTargetUserId}
                  onChange={(e) => setSimTargetUserId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs"
                >
                  {overview?.allUsers?.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}) - {u.email} {u.telegramChatId ? '[Telegram ✅]' : '[Telegram ❌]'}
                    </option>
                  ))}
                </select>
                {simTargetUserId && (
                  <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                    <span>Link Deep Link:</span>
                    <a
                      href={api.getTelegramDeepLink(simTargetUserId)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-600 hover:underline font-mono font-bold truncate"
                    >
                      {api.getTelegramDeepLink(simTargetUserId)}
                    </a>
                  </div>
                )}
              </div>

              {/* Simulation Type */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Tipologia Notifica da Simulare
                </label>
                <select
                  value={simType}
                  onChange={(e: any) => setSimType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs"
                >
                  <option value="registration_email">
                    ✉️ Email Registrazione + Link Collegamento Telegram
                  </option>
                  <option value="therapy_reminder">
                    🔔 Promemoria Terapia / Sollecito Caregiver Telegram
                  </option>
                  <option value="custom_telegram">
                    💬 Messaggio Test Telegram Libero (@{tgBotUsername || 'Guardian32170_bot'})
                  </option>
                </select>
              </div>

              {/* Optional Custom message */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Messaggio Personalizzato (Opzionale)
                </label>
                <input
                  type="text"
                  value={simCustomMessage}
                  onChange={(e) => setSimCustomMessage(e.target.value)}
                  placeholder="Es. Attenzione: aggiornamento terapia..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={simRunning || !simTargetUserId}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                {simRunning ? 'Elaborazione...' : 'Esegui Simulazione Notifica'}
              </button>

              <button
                type="button"
                onClick={handleSendLiveTelegramTest}
                disabled={simRunning || !simTargetUserId}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-colors"
              >
                <Send className="w-4 h-4" />
                Invia Test Reale su Telegram Bot
              </button>
            </div>

            {/* Simulation Preview & Result Container */}
            {simResult && (
              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-sky-700" />
                    Risultato Simulazione per: {simResult.recipient?.name} ({simResult.recipient?.email})
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    simResult.recipient?.telegramConnected
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {simResult.recipient?.telegramConnected ? 'Telegram Connesso' : 'Telegram Non Connesso'}
                  </span>
                </div>

                {simResult.email && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-sky-600" />
                      Oggetto Email: <span className="font-semibold text-slate-900">{simResult.email.subject}</span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 max-h-60 overflow-y-auto">
                      <div dangerouslySetInnerHTML={{ __html: simResult.email.html }} />
                    </div>
                  </div>
                )}

                {simResult.telegramMessage && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-sky-600" />
                      Testo Notifica Bot Telegram:
                    </div>
                    <div
                      className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 font-mono whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: simResult.telegramMessage }}
                    />
                  </div>
                )}

                {simResult.telegramDelivery && (
                  <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                    <strong>Esito Consegna Telegram Bot:</strong> {simResult.telegramDelivery.success ? '✅ Consegnato' : `⚠️ Non recapitato (${simResult.telegramDelivery.reason || 'Chat ID non configurato'})`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Backup & Persistence Section */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 font-['Outfit']">
                  <Database className="w-5 h-5 text-sky-700" />
                  Salvataggio Dati & Backup di Sicurezza (JSON)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  I tuoi dati rimangono sempre salvati e intatti ad ogni aggiornamento dell'app. Puoi comunque esportare o importare un backup completo in qualsiasi momento.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Esporta Backup JSON
                </button>

                <label className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-sky-700" />
                  Ripristina Backup
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    onChange={handleImportBackupFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Families List Table */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-base font-['Outfit']">Gruppi Famiglia Attivi</h3>
            
            {overview?.families?.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">Nessun gruppo famiglia registrato</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="pb-3 font-bold">Gruppo Famiglia</th>
                      <th className="pb-3 font-bold">Codice</th>
                      <th className="pb-3 font-bold">Pazienti</th>
                      <th className="pb-3 font-bold">Membri / Caregiver</th>
                      <th className="pb-3 font-bold">Terapie</th>
                      <th className="pb-3 font-bold">Data Creazione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overview?.families?.map((f: any) => (
                      <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 font-bold text-slate-900">{f.name}</td>
                        <td className="py-3 font-mono font-bold text-sky-700">{f.code}</td>
                        <td className="py-3 font-semibold text-slate-700">{f.patientsCount || 0}</td>
                        <td className="py-3 font-semibold text-slate-700">{f.membersCount || 0}</td>
                        <td className="py-3 font-semibold text-slate-700">{f.therapiesCount || 0}</td>
                        <td className="py-3 text-slate-500">
                          {f.createdAt ? new Date(f.createdAt).toLocaleDateString('it-IT') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* All Registered Users Table */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-base font-['Outfit']">Tutti gli Account Utente</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="pb-3 font-bold">Nome</th>
                    <th className="pb-3 font-bold">Email</th>
                    <th className="pb-3 font-bold">Telegram Bot</th>
                    <th className="pb-3 font-bold">Ruolo</th>
                    <th className="pb-3 font-bold">Famiglia di Appartenenza</th>
                    <th className="pb-3 font-bold">Link Univoco Bot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overview?.allUsers?.map((u: any) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 font-bold text-slate-900">{u.name}</td>
                      <td className="py-3 text-slate-600">{u.email}</td>
                      <td className="py-3">
                        {u.telegramChatId ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-max">
                            <Check className="w-3 h-3" /> Collegato {u.telegramUsername ? `(@${u.telegramUsername})` : ''}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500">
                            Non Collegato
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          u.role === 'superadmin'
                            ? 'bg-purple-100 text-purple-800'
                            : u.role === 'familiare'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-teal-100 text-teal-800'
                        }`}>
                          {u.role === 'superadmin' ? 'SuperAdmin' : u.role === 'familiare' ? 'Familiare' : 'Caregiver'}
                        </span>
                      </td>
                      <td className="py-3 text-slate-700 font-medium">{u.familyName}</td>
                      <td className="py-3 font-mono text-[10px]">
                        <a
                          href={api.getTelegramDeepLink(u.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-600 hover:text-sky-800 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> t.me/{tgBotUsername || 'Guardian32170_bot'}?start={u.id}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Danger Zone: Full DB Reset */}
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-700" />
                  <h3 className="font-bold text-rose-950 text-base">Area Riservata: Reset Totale Database</h3>
                </div>
                <p className="text-xs text-rose-800 mt-1 max-w-xl">
                  Cancella tutti i dati registrati e ripristina la configurazione iniziale. <strong>Richiede 2 conferme esplicite di sicurezza.</strong>
                </p>
              </div>

              <button
                onClick={() => setIsResetStep1Open(true)}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                Reset Completo Database
              </button>
            </div>
          </div>
        </>
      )}

      {/* CONFIRMATION STEP 1 MODAL */}
      {isResetStep1Open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-rose-200 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg text-slate-900 font-['Outfit']">Conferma Reset Step 1 di 2</h3>
              <p className="text-xs text-slate-600 mt-2">
                Stai per cancellare definitivamente tutti i dati dell'applicazione CinicoCare. Sei sicuro di voler proseguire al passaggio finale di sicurezza?
              </p>
            </div>
            <div className="flex gap-2 pt-3">
              <button
                type="button"
                onClick={() => setIsResetStep1Open(false)}
                className="flex-1 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleStep1Confirm}
                className="flex-1 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs"
              >
                Continua (Step 2) →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION STEP 2 MODAL */}
      {isResetStep2Open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border-2 border-rose-600 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg text-rose-950 font-['Outfit']">CONFERMA FINALE (Step 2 di 2)</h3>
              <p className="text-xs text-slate-600 mt-2">
                Questa azione è <strong>IRREVERSIBILE</strong>. Per confermare, digita la parola <strong>CANCELLA</strong> nel campo sottostante:
              </p>
            </div>

            <form onSubmit={handleFinalResetSubmit} className="space-y-4">
              <input
                type="text"
                required
                value={resetCodeInput}
                onChange={(e) => setResetCodeInput(e.target.value)}
                placeholder="Scrivi CANCELLA"
                className="w-full p-2.5 text-center font-mono font-bold tracking-widest text-rose-700 bg-rose-50 border-2 border-rose-300 rounded-xl outline-none text-sm focus:border-rose-600"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetStep2Open(false)}
                  className="flex-1 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={resetting || resetCodeInput.trim().toUpperCase() !== 'CANCELLA'}
                  className="flex-1 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl shadow-xs"
                >
                  {resetting ? 'Reset in corso...' : 'Conferma ed Elimina Dati'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
