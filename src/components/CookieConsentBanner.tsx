import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cookie, X, Check, Eye } from 'lucide-react';

interface CookieConsentBannerProps {
  onOpenPrivacyModal?: () => void;
}

const COOKIE_CONSENT_KEY = 'cinicocare_cookie_consent';

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({ onOpenPrivacyModal }) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!saved) {
      // Show on first connection
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ choice: 'accepted', date: new Date().toISOString() }));
    setIsVisible(false);
  };

  const handleRefuse = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ choice: 'refused', date: new Date().toISOString() }));
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-6 sm:right-auto sm:max-w-md z-50 animate-fade-in">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl border border-slate-200/90 text-slate-800 text-xs space-y-3">
        
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0">
              <Cookie className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm font-['Outfit']">
                Informativa Cookie & Riservatezza
              </h4>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                100% Senza Tracciamento
              </span>
            </div>
          </div>
          <button
            onClick={handleRefuse}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
            title="Chiudi banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Text */}
        <p className="text-slate-600 leading-relaxed text-xs">
          <strong>CinicoCare non fa uso di cookie di profilazione, marketing o tracciamento pubblicitario di terze parti.</strong>{' '}
          Nessun dato viene venduto o monitorato. L'applicazione utilizza esclusivamente la memoria tecnica locale del browser (LocalStorage) per conservare in modo sicuro la tua sessione e le impostazioni delle terapie familiari.
        </p>

        {isDetailsOpen && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[11px] text-slate-600 animate-fade-in">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Dettaglio Tecnico Trasparente:</span>
            </div>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Cookie di profilazione:</strong> ASSENTI (0%).</li>
              <li><strong>Cookie di terze parti:</strong> ASSENTI (0%).</li>
              <li><strong>Strumenti tecnici essenziali:</strong> Solo LocalStorage locale per il token di autenticazione crittografato e la cache offline delle dosi.</li>
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsDetailsOpen(!isDetailsOpen)}
            className="text-[11px] font-semibold text-sky-700 hover:text-sky-800 hover:underline flex items-center gap-1"
          >
            <Eye className="w-3 h-3" />
            {isDetailsOpen ? 'Nascondi dettagli' : 'Maggiori informazioni'}
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleRefuse}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
            >
              Rifiuta
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="px-3.5 py-1.5 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              Accetta e Continua
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
