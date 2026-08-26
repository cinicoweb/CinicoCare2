import React from 'react';
import { X, ShieldCheck, AlertTriangle, Lock, FileText, CheckCircle2, UserCheck, HeartHandshake, Eye } from 'lucide-react';

interface PrivacyDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyDisclaimerModal: React.FC<PrivacyDisclaimerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-700 via-sky-800 to-teal-800 p-6 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Chiudi"
            aria-label="Chiudi finestra informativa"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
              <ShieldCheck className="w-7 h-7 text-sky-200" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-['Outfit'] tracking-tight">Informativa Privacy & Declino di Responsabilità</h2>
              <p className="text-sky-100 text-xs sm:text-sm mt-0.5">Conformità GDPR (Reg. UE 2016/679) e Termini d'Uso CinicoCare</p>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-xs sm:text-sm leading-relaxed">
          
          {/* SEZIONE 1: DECLINO DI RESPONSABILITÀ (DISCLAIMER MEDICO-ORGANIZZATIVO) */}
          <div className="bg-amber-50/90 border-2 border-amber-300/80 rounded-2xl p-4.5 space-y-2">
            <div className="flex items-center gap-2.5 text-amber-900 font-bold text-sm sm:text-base font-['Outfit']">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
              1. Declino di Responsabilità & Natura dell'Applicazione
            </div>
            <p className="text-amber-950/90 leading-relaxed text-xs">
              <strong>CinicoCare è unicamente uno strumento di ausilio digitale e promemoria organizzativo</strong> per supportare la coordinazione tra familiari e caregiver.
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-xs text-amber-900">
              <li><strong>Nessun valore medico-diagnostico:</strong> L'applicazione <u>NON è un dispositivo medico</u> né certificato ai fini sanitari. Non fornisce pareri medici, dosaggi automatici né diagnosi.</li>
              <li><strong>Responsabilità esclusiva dell'utilizzatore:</strong> La somministrazione dei farmaci, la verifica dei dosaggi, gli orari e la conformità al piano terapeutico prescritto restano <u>esclusiva e inderogabile responsabilità del paziente, del caregiver e del medico curante</u>.</li>
              <li><strong>Assenza di garanzia e malfunzionamenti:</strong> L'autore (Nicola Cirillo) non assume alcuna responsabilità civile, penale o patrimoniale per omissioni, ritardi nella somministrazione, mancata ricezione di messaggi/notifiche WhatsApp/Push, interruzioni di connettività, errori di inserimento dati o disservizi tecnici.</li>
            </ul>
          </div>

          {/* SEZIONE 2: INFORMATIVA PRIVACY GDPR */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm sm:text-base font-['Outfit']">
              <Lock className="w-5 h-5 text-sky-700" />
              2. Informativa sul Trattamento dei Dati Personali (GDPR)
            </div>
            <p className="text-slate-600 text-xs">
              Ai sensi degli artt. 13 e 14 del <strong>Regolamento Generale sulla Protezione dei Dati (Regolamento UE 2016/679 - GDPR)</strong>, ti informiamo su come vengono gestiti i dati:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <strong className="block text-slate-800 mb-1">Titolare e Autore</strong>
                <span>Progettata e sviluppata da <strong>Nicola Cirillo</strong>. Tutti i diritti riservati.</span>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <strong className="block text-slate-800 mb-1">Dati Trattati</strong>
                <span>Nome, email, recapito telefonico, anagrafica pazienti e schede farmaci minime indispensabili.</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <p>
                <strong>Trattamento di Dati Sanitari (Art. 9 GDPR):</strong> I dati relativi alle terapie farmacologiche dei pazienti sono trattati <em>esclusivamente sulla base del consenso esplicito</em> manifestato dall'amministratore familiare e dai caregiver autorizzati in fase di registrazione.
              </p>
              <p>
                <strong>Isolamento dei Gruppi Famiglia:</strong> Ciascun gruppo famiglia è rigorosamente isolato e protetto. Nessun altro utente o gruppo esterno può accedere ai dati clinici o alle anagrafiche della tua famiglia.
              </p>
              <p>
                <strong>Nessuna Cessione o Profilazione:</strong> I dati NON vengono in alcun caso venduti, ceduti a terze parti né utilizzati per fini pubblicitari o commerciali.
              </p>
            </div>
          </div>

          {/* SEZIONE 3: DIRITTI DELL'INTERESSATO */}
          <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-sky-900">
              <UserCheck className="w-4 h-4 text-sky-700" />
              3. Diritti dell'Interessato (Accesso, Modifica, Cancellazione)
            </div>
            <p className="text-slate-700">
              In qualsiasi momento puoi esercitare i tuoi diritti previsti dal GDPR:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li><strong>Diritto di accesso e modifica:</strong> Visualizzare e modificare le schede terapeutiche, i profili e le anagrafiche direttamente dall'applicazione.</li>
              <li><strong>Diritto alla cancellazione (Oblio):</strong> Eliminare singoli pazienti, terapie o l'intero gruppo familiare tramite il pannello di controllo.</li>
              <li><strong>Portabilità dei dati:</strong> Esportare in qualunque momento un backup completo in formato JSON tramite l'apposito pulsante.</li>
            </ul>
          </div>

          {/* SEZIONE 4: PROPRIETÀ E UTILIZZO */}
          <div className="border-t border-slate-200 pt-4 text-xs text-slate-500">
            <strong>Diritti di Proprietà Intellettuale:</strong> CinicoCare è un'opera d'ingegno ideata, progettata e realizzata da Nicola Cirillo. Tutti i diritti riservati. Il software è fornito ad uso diretto da parte degli utenti autorizzati e ne è vietata la ridistribuzione o la rivendita non autorizzata.
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            Ho compreso e accetto
          </button>
        </div>

      </div>
    </div>
  );
};
