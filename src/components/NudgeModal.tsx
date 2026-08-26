import React, { useState, useMemo } from 'react';
import { X, Send, Bell, Check, AlertCircle, Bot, ExternalLink } from 'lucide-react';
import { ScheduledDoseItem, User } from '../types';
import { api } from '../services/api';
import { showLocalNotification } from '../utils/notifications';
import { audioAlert } from '../utils/audio';
import { formatCaregiverAlertMessage } from '../utils/phone';

interface NudgeModalProps {
  isOpen: boolean;
  doseItem: ScheduledDoseItem | null;
  caregivers: User[];
  onClose: () => void;
  onSuccess: () => void;
}

export const NudgeModal: React.FC<NudgeModalProps> = ({
  isOpen,
  doseItem,
  caregivers,
  onClose,
  onSuccess
}) => {
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string>('all');
  const [channel, setChannel] = useState<'all' | 'telegram' | 'push'>('all');
  const [customText, setCustomText] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Filter caregivers assigned to this patient (or family admins)
  const patientCaregivers = useMemo(() => {
    if (!doseItem) return [];
    return caregivers.filter(c =>
      c.isFamilyAdmin ||
      !c.assignedPatientIds ||
      c.assignedPatientIds.length === 0 ||
      c.assignedPatientIds.includes(doseItem.patient.id)
    );
  }, [caregivers, doseItem]);

  React.useEffect(() => {
    if (doseItem) {
      const selectedCaregiver = patientCaregivers.find(c => c.id === selectedCaregiverId);
      const caregiverName = selectedCaregiver ? selectedCaregiver.name : (patientCaregivers[0]?.name || 'Caregiver');

      const generated = formatCaregiverAlertMessage({
        caregiverName,
        patientName: doseItem.patient.name,
        medicationName: doseItem.therapy.medicationName,
        dosage: doseItem.therapy.dosage,
        scheduledTime: doseItem.scheduledTime,
        instructions: doseItem.therapy.instructions
      });

      setCustomText(generated);
      setFeedback(null);
    }
  }, [doseItem, patientCaregivers, selectedCaregiverId]);

  if (!isOpen || !doseItem) return null;

  const handleSendNudge = async () => {
    setSending(true);
    setFeedback(null);

    const selectedCaregiver = patientCaregivers.find(c => c.id === selectedCaregiverId);
    const caregiverName = selectedCaregiver ? selectedCaregiver.name : undefined;

    try {
      const res = await api.nudgeDose({
        therapyId: doseItem.therapy.id,
        patientId: doseItem.patient.id,
        scheduledDate: doseItem.scheduledDate,
        scheduledTime: doseItem.scheduledTime,
        channel,
        caregiverName
      });

      // Sound & Push locally as well
      audioAlert.playUrgentChime();
      showLocalNotification(`🔔 Sollecito Farmaco: ${doseItem.patient.name}`, {
        body: `Somministrare ${doseItem.therapy.medicationName} ${doseItem.therapy.dosage ? `(${doseItem.therapy.dosage})` : ''} previsto per le ${doseItem.scheduledTime}.`
      });

      setFeedback(`Sollecito Telegram inviato tramite il bot @Guardian32170_bot!`);

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1400);

    } catch (err: any) {
      setFeedback(err.message || 'Errore invio sollecito');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-sky-600 to-cyan-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Bot className="w-5 h-5 text-sky-200" />
            </div>
            <div>
              <h3 className="font-bold text-lg font-['Outfit']">Invia Sollecito Farmaco</h3>
              <p className="text-xs text-sky-100 mt-0.5">Notifica Telegram automatica bot @Guardian32170_bot</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-slate-700">
          
          {feedback && (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-sky-900 font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-sky-600" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Dose summary */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Paziente & Farmaco</span>
              <div className="text-slate-900 font-bold text-sm mt-0.5">
                {doseItem.patient.name} — {doseItem.therapy.medicationName}
              </div>
              <div className="text-slate-600 font-medium mt-0.5">
                {doseItem.therapy.dosage ? `${doseItem.therapy.dosage} • ` : ''}Previsto per le ore <strong>{doseItem.scheduledTime}</strong>
              </div>
            </div>
            <div className="text-right">
              <span className="px-2 py-1 bg-amber-100 text-amber-900 rounded-md font-bold text-[10px]">
                {doseItem.doseLog?.notificationsSentCount || 0} solleciti inviati
              </span>
            </div>
          </div>

          {/* Channel selector */}
          <div>
            <label className="block font-semibold text-slate-800 mb-1.5">Canale di Notifica</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setChannel('all')}
                className={`py-2 px-2 rounded-xl border font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all ${
                  channel === 'all'
                    ? 'bg-sky-700 text-white border-sky-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                Tutti i Canali
              </button>
              <button
                type="button"
                onClick={() => setChannel('telegram')}
                className={`py-2 px-2 rounded-xl border font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all ${
                  channel === 'telegram'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                Telegram Bot
              </button>
              <button
                type="button"
                onClick={() => setChannel('push')}
                className={`py-2 px-2 rounded-xl border font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all ${
                  channel === 'push'
                    ? 'bg-indigo-700 text-white border-indigo-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                Push App
              </button>
            </div>
          </div>

          {/* Caregiver destination selector */}
          <div>
            <label className="block font-semibold text-slate-800 mb-1.5">
              Caregiver Assegnati a {doseItem.patient.name}
            </label>
            <div className="space-y-2">
              <select
                value={selectedCaregiverId}
                onChange={(e) => setSelectedCaregiverId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs"
              >
                <option value="all">Tutti i Caregiver del Paziente ({patientCaregivers.length})</option>
                {patientCaregivers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.role === 'familiare' ? 'Familiare' : 'Caregiver'}) {c.telegramChatId ? `[Telegram @${c.telegramUsername || 'Collegato'}]` : '[Telegram non collegato]'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Caregiver Telegram status list */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-700 mb-1">Stato Collegamento Telegram Bot:</div>
            {patientCaregivers.map(c => (
              <div key={c.id} className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-slate-800">{c.name}</span>
                {c.telegramChatId ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <Check className="w-3 h-3" /> Collegato {c.telegramUsername ? `(@${c.telegramUsername})` : ''}
                  </span>
                ) : (
                  <a
                    href={`https://t.me/Guardian32170_bot?start=${c.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-700 hover:text-sky-800 font-semibold flex items-center gap-1 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200"
                  >
                    <ExternalLink className="w-3 h-3" /> Invia Link Avvio Bot
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Message Preview */}
          <div>
            <label className="block font-semibold text-slate-800 mb-1.5">Anteprima Messaggio con Pulsante di Conferma</label>
            <textarea
              rows={4}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs font-mono"
            />
          </div>

          {/* Bot Notice */}
          <div className="bg-sky-50 border border-sky-200/80 rounded-xl p-3 flex items-start gap-2.5 text-sky-950">
            <Bot className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong>Bot Telegram Guardian (@Guardian32170_bot):</strong> I messaggi vengono recapitati direttamente nella chat Telegram dei caregiver incaricati con il pulsante interattivo a 1 tocco per registrare la somministrazione.
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSendNudge}
            disabled={sending}
            className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Invio in corso...' : 'Invia con Telegram Bot'}
          </button>
        </div>

      </div>
    </div>
  );
};

