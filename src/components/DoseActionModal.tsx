import React, { useState } from 'react';
import { X, Check, Clock, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { ScheduledDoseItem } from '../types';

interface DoseActionModalProps {
  isOpen: boolean;
  doseItem: ScheduledDoseItem | null;
  onClose: () => void;
  onConfirm: (status: 'taken' | 'skipped' | 'pending', notes: string) => Promise<void>;
}

export const DoseActionModal: React.FC<DoseActionModalProps> = ({
  isOpen,
  doseItem,
  onClose,
  onConfirm
}) => {
  const [status, setStatus] = useState<'taken' | 'skipped' | 'pending'>('taken');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (doseItem) {
      setStatus(doseItem.status === 'taken' ? 'taken' : 'taken');
      setNotes(doseItem.doseLog?.notes || '');
    }
  }, [doseItem]);

  if (!isOpen || !doseItem) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onConfirm(status, notes);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-sky-700 to-teal-700 text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg font-['Outfit']">Conferma Somministrazione</h3>
            <p className="text-xs text-sky-100 mt-0.5">
              Paziente: <span className="font-semibold text-white">{doseItem.patient.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Therapy Info Box */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex items-start gap-3">
          <div
            className="w-3.5 h-12 rounded-full shrink-0"
            style={{ backgroundColor: doseItem.therapy.color || '#0284c7' }}
          />
          <div>
            <h4 className="font-bold text-slate-900 text-base">{doseItem.therapy.medicationName}</h4>
            <div className="text-xs text-slate-600 mt-0.5 font-medium">Dosaggio: {doseItem.therapy.dosage}</div>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
              <span className="flex items-center gap-1 font-semibold text-slate-700">
                <Clock className="w-3.5 h-3.5 text-sky-700" />
                Orario previsto: {doseItem.scheduledTime}
              </span>
            </div>
            {doseItem.therapy.instructions && (
              <div className="mt-2 text-xs text-sky-900 bg-sky-50 p-2 rounded-lg border border-sky-200/60">
                💡 <em>{doseItem.therapy.instructions}</em>
              </div>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Esito Somministrazione</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('taken')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  status === 'taken'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                Somministrato
              </button>

              <button
                type="button"
                onClick={() => setStatus('skipped')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  status === 'skipped'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                Non Somministrato / Saltato
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Note del Caregiver (Opzionale)</span>
              <span className="text-[10px] text-slate-400 font-normal">Es. reazioni, difficoltà, parametri</span>
            </label>
            <div className="relative">
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Es. Assunto regolarmente con yogurt dopo colazione. Nessun disturbo."
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-100 outline-none transition-all"
              />
            </div>
          </div>

          {doseItem.status === 'taken' && (
            <div className="pt-1">
              <button
                type="button"
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await onConfirm('pending', '');
                    onClose();
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Annulla spunta precedente (riporta a da somministrare)
              </button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {submitting ? 'Registrazione...' : 'Salva Somministrazione'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
