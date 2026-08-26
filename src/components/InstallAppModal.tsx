import React, { useState, useEffect } from 'react';
import { X, Smartphone, Apple, Download, CheckCircle2, Share, PlusSquare, ArrowRight, ShieldCheck } from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'pc'>('android');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('Per installare l\'app su questo browser, usa l\'opzione "Installa App" o "Aggiungi a schermata Home" dal menu del browser (3 puntini o pulsante Condividi).');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-700 via-sky-800 to-teal-700 p-6 text-white rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Chiudi"
            aria-label="Chiudi finestra installazione"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
              <Smartphone className="w-7 h-7 text-sky-200" />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-['Outfit'] tracking-tight">Installa CinicoCare</h2>
              <p className="text-sky-100 text-sm mt-0.5">App mobile nativa PWA per Android, iPhone & Desktop</p>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex gap-2">
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'android'
                ? 'bg-sky-700 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Android
          </button>
          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'ios'
                ? 'bg-sky-700 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Apple className="w-4 h-4" />
            iPhone / iPad
          </button>
          <button
            onClick={() => setActiveTab('pc')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'pc'
                ? 'bg-sky-700 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            PC / Mac
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 text-sm text-slate-700">
          
          {/* Quick Install Action if available */}
          {deferredPrompt && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-emerald-900">Installazione Istantanea 1-Click</h4>
                <p className="text-xs text-emerald-700">Il tuo browser supporta l'installazione diretta.</p>
              </div>
              <button
                onClick={handleInstallClick}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-4 h-4" />
                Installa Ora
              </button>
            </div>
          )}

          {/* Android Guide */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
                <h4 className="font-semibold text-sky-950 mb-2">Come installare su Android (Chrome / Edge / Samsung Internet):</h4>
                <ol className="space-y-3 text-xs text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-sky-700 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                    <span>Tocca il menu in alto a destra nel browser Chrome (i tre puntini verticali <strong>⋮</strong>).</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-sky-700 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                    <span>Seleziona la voce <strong>"Installa app"</strong> oppure <strong>"Aggiungi a schermata Home"</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-sky-700 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                    <span>Conferma premendo <strong>"Installa"</strong>. L'icona CinicoCare apparirà tra le app del tuo telefono.</span>
                  </li>
                </ol>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0" />
                <span>Riceverai notifiche push a schermo intero e potrai aprire l'app anche offline.</span>
              </div>
            </div>
          )}

          {/* iOS / iPhone Guide */}
          {activeTab === 'ios' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="font-semibold text-slate-900 mb-2">Come installare su iPhone / iPad (Safari):</h4>
                <ol className="space-y-3 text-xs text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-sky-700 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                    <span>Apri questa pagina con il browser <strong>Safari</strong> su iPhone o iPad.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-sky-700 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                    <span className="flex items-center gap-1.5 flex-wrap">
                      Tocca in basso il pulsante <strong>Condividi</strong>
                      <span className="inline-flex p-1 bg-slate-200 rounded text-slate-800"><Share className="w-3.5 h-3.5" /></span>
                      (il quadrato con la freccia verso l'alto).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-sky-700 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                    <span className="flex items-center gap-1.5 flex-wrap">
                      Scorri verso il basso e tocca <strong>"Aggiungi alla schermata Home"</strong>
                      <span className="inline-flex p-1 bg-slate-200 rounded text-slate-800"><PlusSquare className="w-3.5 h-3.5" /></span>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-sky-700 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">4</span>
                    <span>Tocca <strong>"Aggiungi"</strong> in alto a destra. L'app CinicoCare sarà ora sulla tua Home come un'app nativa!</span>
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* PC / Mac Guide */}
          {activeTab === 'pc' && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
                <h4 className="font-semibold text-sky-950 mb-2">Installazione su Computer (Chrome / Edge / Safari):</h4>
                <p className="text-xs text-slate-700 leading-relaxed mb-3">
                  Nella barra degli indirizzi in alto a destra del browser, clicca sull'icona <strong>Installa CinicoCare</strong> (icona a forma di monitor con freccia) oppure dal menu Impostazioni seleziona <em>"Installa CinicoCare"</em>.
                </p>
                <div className="flex items-center gap-2 text-xs text-teal-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  Accesso diretto dalla barra delle applicazioni / Dock senza dover aprire il browser!
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-xl text-xs transition-colors"
          >
            Chiudi
          </button>
        </div>

      </div>
    </div>
  );
};
