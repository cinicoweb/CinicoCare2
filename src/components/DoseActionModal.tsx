import React, { useState, useEffect } from 'react';
import { X, Check, Clock, AlertTriangle, FileText, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react';
import { ScheduledDoseItem } from '../types';

interface DoseActionModalProps {
  isOpen: boolean;
  doseItem: ScheduledDoseItem | null;
  initialStatus?: 'taken' | 'skipped' | 'pending';
  onClose: () => void;
  onConfirm: (status: 'taken' | 'skipped' | 'pending', notes: string) => Promise<void>;
}

const COMMON_SKIP_REASONS = [
  'Rifiutato dal paziente',
  'Paziente addormentato',
  'Nausea / vomito',
  'Assente / fuori casa',
  'Sospeso su indicazione medica',
  'Farmaco terminato in scorta'
];

export const DoseActionModal: React.FC<DoseActionModalProps> = ({
  isOpen,
  doseItem,
  initialStatus,
  onClose,
  onConfirm
}) => {
  const [status, setStatus] = useState<'taken' | 'skipped' | 'pending'>('taken');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (doseItem) {
      if (initialStatus) {
        setStatus(initialStatus);
      } else if (doseItem.status === 'taken' || doseItem.status === 'skipped' || doseItem.status === 'pending') {
        setStatus(doseItem.status);
      } else {
        setStatus('taken');
      }
      setNotes(doseItem.doseLog?.notes || '');
    }
  }, [doseItem, initialStatus]);

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

  const addQuickReason = (reason: string) => {
    setNotes(prev => (prev ? `${prev}. ${reason}` : reason));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className={`p-5 text-white flex items-center justify-between transition-colors ${
          status === 'taken'
            ? 'bg-gradient-to-r from-emerald-600 to-teal-700'
            : status === 'skipped'
            ? 'bg-gradient-to-r from-rose-600 to-amber-700'
            : 'bg-gradient-to-r from-sky-700 to-slate-700'
        }`}>
          <div>
            <h3 className="font-bold text-lg font-['Outfit']">
              {status === 'taken' && 'Segna come Somministrato'}
              {status === 'skipped' && 'Segna come Non Somministrato'}
              {status === 'pending' && 'Imposta In Attesa'}
            </h3>
            <p className="text-xs text-white/90 mt-0.5">
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
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-start gap-3">
          <div
            className="w-3.5 h-12 rounded-full shrink-0"
            style={{ backgroundColor: doseItem.therapy.color || '#0284c7' }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-bold text-slate-900 text-base truncate">{doseItem.therapy.medicationName}</h4>
              <span className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-md shrink-0">
                {doseItem.therapy.dosage}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
              <Clock className="w-3.5 h-3.5 text-sky-700" />
              <span>Orario previsto: <strong>{doseItem.scheduledTime}</strong></span>
            </div>
            {doseItem.therapy.instructions && (
              <div className="mt-1.5 text-xs text-sky-900 bg-sky-50 p-2 rounded-lg border border-sky-200/60">
                💡 <em>{doseItem.therapy.instructions}</em>
              </div>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* 3 Status Buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Stato della somministrazione (3 stati):
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              
              <button
                type="button"
                onClick={() => setStatus('pending')}
                className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all ${
                  status === 'pending'
                    ? 'bg-sky-700 text-white border-sky-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>In Attesa</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('taken')}
                className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all ${
                  status === 'taken'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Somministrato</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('skipped')}
                className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all ${
                  status === 'skipped'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Non Somministrato</span>
              </button>

            </div>
          </div>

          {/* Quick reason tag hints when skipped */}
          {status === 'skipped' && (
            <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3 animate-fade-in">
              <label className="block text-[11px] font-bold text-rose-900 mb-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                Motivazione rapida non somministrazione:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_SKIP_REASONS.map(reason => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => addQuickReason(reason)}
                    className="text-[11px] px-2 py-0.5 bg-white hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-md font-medium transition-colors"
                  >
                    + {reason}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Note o Dettagli (Opzionale)</span>
              <span className="text-[10px] text-slate-400 font-normal">Es. dosaggio parziale, osservazioni</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={status === 'skipped' ? 'Specifica il motivo della mancata somministrazione...' : 'Es. Assunto regolarmente con abbondante acqua.'}
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-100 outline-none transition-all"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
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
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 ${
                status === 'taken'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : status === 'skipped'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-sky-700 hover:bg-sky-800'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{submitting ? 'Salvataggio...' : 'Conferma'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
