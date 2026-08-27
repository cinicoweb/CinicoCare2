import React, { useState } from 'react';
import { X, ShieldCheck, Heart, Copyright, Lock, Sparkles, AlertTriangle, FileText, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { DEFAULT_PRIVACY_DISCLAIMER_MARKDOWN } from '../utils/privacyDefault';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPrivacyDisclaimer?: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, onOpenPrivacyDisclaimer }) => {
  const [copied, setCopied] = useState(false);
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState(true);

  if (!isOpen) return null;

  const handleCopyPrivacy = () => {
    navigator.clipboard.writeText(DEFAULT_PRIVACY_DISCLAIMER_MARKDOWN);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-700 to-teal-700 p-6 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Chiudi"
            aria-label="Chiudi finestra informazioni"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
              <Heart className="w-7 h-7 text-sky-200" />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-['Outfit'] tracking-tight">CinicoCare</h2>
              <p className="text-sky-100 text-sm mt-0.5">Gestione Coordinata Somministrazione Farmaci</p>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 text-slate-700 text-sm leading-relaxed overflow-y-auto flex-1">
          
          {/* Autore e Copyright */}
          <div className="bg-sky-50/80 border border-sky-200/80 rounded-2xl p-4 flex items-start gap-3.5">
            <Copyright className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-slate-900 text-base font-['Outfit']">Ideazione, Progettazione e Realizzazione</h3>
              <p className="mt-1 text-slate-700 text-xs sm:text-sm">
                Progettata e realizzata da <strong>Nicola Cirillo</strong>.
              </p>
              <p className="text-xs text-sky-900 font-semibold mt-1">
                Copyright © 2026 Nicola Cirillo — Tutti i diritti riservati.
              </p>
            </div>
          </div>

          {/* Scopo dell'Applicazione */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3.5">
            <Sparkles className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-slate-900 text-base font-['Outfit']">Finalità e Supporto ai Caregiver</h3>
              <p className="mt-1 text-slate-700 text-xs sm:text-sm">
                CinicoCare nasce per semplificare e rendere sicura la routine quotidiana delle terapie per pazienti e anziani:
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600 list-disc list-inside">
                <li>Piano terapeutico giornaliero con spunta in tempo reale sincronizzata tra tutti i familiari.</li>
                <li>Solleciti e promemoria con link rapido Telegram, Email e notifiche Push sul cellulare.</li>
                <li>Isolamento rigoroso dei gruppi famiglia con gestione permessi differenziata per familiari e assistenti.</li>
                <li>Nessun cookie di terze parti o tracciamento pubblicitario.</li>
              </ul>
            </div>
          </div>

          {/* Declino di Responsabilità Sintetico */}
          <div className="bg-amber-50/80 border border-amber-300/80 rounded-2xl p-4 flex items-start gap-3.5">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-amber-900">
              <h3 className="font-semibold text-slate-900 text-sm font-['Outfit']">Declino di Responsabilità & Ausilio Digitale</h3>
              <p>
                L'applicazione è esclusivamente un promemoria e ausilio organizzativo e non sostituisce in alcun modo le indicazioni del medico curante, la supervisione diretta dei caregiver o le prescrizioni sanitarie ufficiali.
              </p>
            </div>
          </div>

          {/* INFORMATIVA COMPLETA PRIVACY & GDPR TEXTBOX */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
            <div className="p-3.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
                <span>Informativa Privacy & Termini GDPR (Regolamento UE 2016/679)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPrivacy}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1 transition-colors"
                  title="Copia testo dell'informativa"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600">Copiato!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copia</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivacyExpanded(!isPrivacyExpanded)}
                  className="p-1 text-slate-500 hover:text-slate-800 rounded-lg"
                  title={isPrivacyExpanded ? 'Comprimi' : 'Espandi'}
                >
                  {isPrivacyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isPrivacyExpanded && (
              <div className="p-4 max-h-64 overflow-y-auto text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-line bg-white/70">
                {DEFAULT_PRIVACY_DISCLAIMER_MARKDOWN}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-xl transition-colors"
          >
            Chiudi
          </button>
        </div>

      </div>
    </div>
  );
};

