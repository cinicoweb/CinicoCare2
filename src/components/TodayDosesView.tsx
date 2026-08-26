import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Plus,
  User as UserIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Sparkles,
  MessageSquare,
  Volume2,
  FileEdit,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Patient, Therapy, DoseLog, ScheduledDoseItem, User, Family } from '../types';
import { audioAlert } from '../utils/audio';

interface TodayDosesViewProps {
  currentDate: string;
  setCurrentDate: (date: string) => void;
  patients: Patient[];
  therapies: Therapy[];
  doseLogs: DoseLog[];
  currentUser: User;
  currentFamily: Family | null;
  caregivers: User[];
  onToggleDose: (payload: {
    therapyId: string;
    patientId: string;
    scheduledDate: string;
    scheduledTime: string;
    status: 'taken' | 'skipped' | 'pending';
    notes?: string;
  }) => Promise<void>;
  onOpenDoseModal: (item: ScheduledDoseItem) => void;
  onOpenNudgeModal: (item: ScheduledDoseItem) => void;
  onNavigateToTherapies: () => void;
}

export const TodayDosesView: React.FC<TodayDosesViewProps> = ({
  currentDate,
  setCurrentDate,
  patients,
  therapies,
  doseLogs,
  currentUser,
  currentFamily,
  caregivers,
  onToggleDose,
  onOpenDoseModal,
  onOpenNudgeModal,
  onNavigateToTherapies
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');

  // Parse today and current date object
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const isViewingToday = currentDate === todayStr;

  // Compute scheduled items for currentDate
  const scheduledItems = useMemo<ScheduledDoseItem[]>(() => {
    const items: ScheduledDoseItem[] = [];
    const dateObj = new Date(currentDate + 'T00:00:00');
    const dayOfWeek = dateObj.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    const now = new Date();
    const currentHoursMinutes = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    therapies.forEach(therapy => {
      if (!therapy.isActive) return;
      if (therapy.daysOfWeek && !therapy.daysOfWeek.includes(dayOfWeek)) return;
      if (therapy.startDate && currentDate < therapy.startDate) return;
      if (therapy.endDate && currentDate > therapy.endDate) return;

      const patient = patients.find(p => p.id === therapy.patientId);
      if (!patient) return;

      // Filter for caregivers who are assigned to specific patients
      if (
        currentUser.role === 'caregiver' &&
        currentUser.assignedPatientIds &&
        currentUser.assignedPatientIds.length > 0 &&
        !currentUser.assignedPatientIds.includes(patient.id)
      ) {
        // Caregiver is only assigned to other patients
        return;
      }

      therapy.timeSlots.forEach(slotTime => {
        const doseLogId = `${therapy.id}_${currentDate}_${slotTime}`;
        const log = doseLogs.find(d => d.id === doseLogId);

        let status: 'pending' | 'taken' | 'skipped' | 'late' = 'pending';
        if (log) {
          status = log.status;
        } else if (isViewingToday && slotTime < currentHoursMinutes) {
          status = 'late';
        } else if (currentDate < todayStr) {
          status = 'late';
        }

        const isOverdue = status === 'late' || (status === 'pending' && isViewingToday && slotTime < currentHoursMinutes);
        const isDueNow = isViewingToday && Math.abs(
          (parseInt(slotTime.split(':')[0]) * 60 + parseInt(slotTime.split(':')[1])) -
          (now.getHours() * 60 + now.getMinutes())
        ) <= 30;

        items.push({
          id: doseLogId,
          doseLogId,
          therapy,
          patient,
          scheduledDate: currentDate,
          scheduledTime: slotTime,
          scheduledDateTime: new Date(`${currentDate}T${slotTime}:00`),
          status: log?.status || (isOverdue ? 'late' : 'pending'),
          isDueNow,
          isUpcoming: isViewingToday && slotTime > currentHoursMinutes,
          isOverdue,
          doseLog: log
        });
      });
    });

    // Sort chronologically by scheduled time
    return items.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  }, [currentDate, therapies, patients, doseLogs, currentUser, isViewingToday, todayStr]);

  // Filtered by patient and time of day
  const filteredItems = useMemo(() => {
    return scheduledItems.filter(item => {
      if (selectedPatientId !== 'all' && item.patient.id !== selectedPatientId) {
        return false;
      }

      const hour = parseInt(item.scheduledTime.split(':')[0]);
      if (timeFilter === 'morning' && (hour < 6 || hour >= 12)) return false;
      if (timeFilter === 'afternoon' && (hour < 12 || hour >= 18)) return false;
      if (timeFilter === 'evening' && hour < 18) return false;

      return true;
    });
  }, [scheduledItems, selectedPatientId, timeFilter]);

  // Statistics
  const totalCount = scheduledItems.length;
  const takenCount = scheduledItems.filter(i => i.status === 'taken').length;
  const lateCount = scheduledItems.filter(i => i.isOverdue && i.status !== 'taken' && i.status !== 'skipped').length;
  const pendingCount = scheduledItems.filter(i => (i.status === 'pending' || i.status === 'late') && !i.isOverdue).length;
  const percentCompleted = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  // Trigger sound effect and celebration confetti when user clicks spunta
  const handleQuickCheck = async (item: ScheduledDoseItem) => {
    if (item.status === 'taken') {
      // Toggle back to pending
      await onToggleDose({
        therapyId: item.therapy.id,
        patientId: item.patient.id,
        scheduledDate: item.scheduledDate,
        scheduledTime: item.scheduledTime,
        status: 'pending'
      });
    } else {
      audioAlert.playReminderChime();
      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#0284c7', '#0d9488', '#10b981', '#38bdf8']
        });
      } catch (e) {
        // ignore
      }

      await onToggleDose({
        therapyId: item.therapy.id,
        patientId: item.patient.id,
        scheduledDate: item.scheduledDate,
        scheduledTime: item.scheduledTime,
        status: 'taken'
      });
    }
  };

  const changeDateByDays = (days: number) => {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    const newStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setCurrentDate(newStr);
  };

  const formatDateDisplay = (dateString: string) => {
    const d = new Date(dateString + 'T00:00:00');
    return d.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner: Date Navigation & Fast Status */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Date Navigator */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
          <button
            onClick={() => changeDateByDays(-1)}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
            title="Giorno precedente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
            <Calendar className="w-4 h-4 text-sky-700" />
            <span className="font-bold text-slate-800 text-xs capitalize">
              {formatDateDisplay(currentDate)}
            </span>
            {isViewingToday && (
              <span className="px-2 py-0.5 bg-sky-100 text-sky-800 text-[10px] font-bold rounded-md">
                Oggi
              </span>
            )}
          </div>

          <button
            onClick={() => changeDateByDays(1)}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
            title="Giorno successivo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!isViewingToday && (
            <button
              onClick={() => setCurrentDate(todayStr)}
              className="text-xs text-sky-700 hover:text-sky-900 font-semibold px-2 py-1 underline"
            >
              Torna a Oggi
            </button>
          )}
        </div>

        {/* Real-time Nudge Loop Status Banner */}
        {currentFamily?.notificationSettings?.autoRepeatNudges && (
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-sky-50/60 px-3.5 py-2 rounded-xl border border-sky-100">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              Solleciti continui <strong>attivi</strong> (ogni {currentFamily.notificationSettings.repeatIntervalMinutes} min finché non spuntato)
            </span>
          </div>
        )}

      </div>

      {/* Overdue Warning Alert Bar (if any doses are late) */}
      {lateCount > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl shrink-0 animate-bounce">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-rose-950 text-sm sm:text-base">
                Attenzione: {lateCount} {lateCount === 1 ? 'dose risulta in ritardo' : 'dosi risultano in ritardo'}!
              </h4>
              <p className="text-xs text-rose-800 mt-0.5">
                Le notifiche WhatsApp e Push continuano a sollecitare i caregiver finché la somministrazione non viene registrata.
              </p>
            </div>
          </div>
          <button
            onClick={() => audioAlert.playUrgentChime()}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
          >
            <Volume2 className="w-4 h-4" />
            Suona Avviso
          </button>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Terapie Previste</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 font-['Outfit']">{totalCount}</div>
          <div className="text-xs text-slate-500 mt-1">Dosi programmate per la giornata</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-xs bg-gradient-to-br from-white to-emerald-50/30">
          <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Somministrate</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-1 font-['Outfit']">{takenCount}</div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 mt-1 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{percentCompleted}% completamento</span>
          </div>
        </div>

        <div className={`p-4 sm:p-5 rounded-2xl border shadow-xs transition-colors ${
          lateCount > 0
            ? 'bg-rose-50 border-rose-300 text-rose-950'
            : 'bg-white border-slate-200/80'
        }`}>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">In Ritardo</span>
          <div className={`text-2xl sm:text-3xl font-extrabold mt-1 font-['Outfit'] ${lateCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            {lateCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {lateCount > 0 ? 'Richiede attenzione immediata' : 'Nessun ritardo'}
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pazienti Coinvolti</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 font-['Outfit']">
            {patients.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {caregivers.length} caregiver coordinati
          </div>
        </div>

      </div>

      {/* Patient & Time Slot Filter Controls */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        
        {/* Patient selector pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Paziente:
          </span>
          <button
            onClick={() => setSelectedPatientId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              selectedPatientId === 'all'
                ? 'bg-sky-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tutti i Pazienti ({scheduledItems.length})
          </button>
          {patients.map(p => {
            const countForP = scheduledItems.filter(i => i.patient.id === p.id).length;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPatientId(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedPatientId === p.id
                    ? 'bg-sky-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.name} ({countForP})
              </button>
            );
          })}
        </div>

        {/* Time of day filters */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setTimeFilter('all')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
              timeFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Tutto il Giorno
          </button>
          <button
            onClick={() => setTimeFilter('morning')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
              timeFilter === 'morning' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Mattina
          </button>
          <button
            onClick={() => setTimeFilter('afternoon')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
              timeFilter === 'afternoon' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Pomeriggio
          </button>
          <button
            onClick={() => setTimeFilter('evening')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
              timeFilter === 'evening' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Sera/Notte
          </button>
        </div>

      </div>

      {/* Main Dose Cards List */}
      <div className="space-y-3">
        
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/80 shadow-xs">
            <div className="w-16 h-16 bg-sky-50 text-sky-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Nessuna dose prevista con i filtri selezionati</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
              Non ci sono farmaci programmati per questo orario o paziente, oppure la terapia deve essere ancora configurata.
            </p>
            {currentUser.isFamilyAdmin && (
              <button
                onClick={onNavigateToTherapies}
                className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white font-semibold text-xs rounded-xl shadow-xs inline-flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Aggiungi Terapia Farmacologica
              </button>
            )}
          </div>
        ) : (
          filteredItems.map(item => {
            const isTaken = item.status === 'taken';
            const isSkipped = item.status === 'skipped';
            const isLate = item.isOverdue && !isTaken && !isSkipped;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition-all shadow-xs overflow-hidden ${
                  isTaken
                    ? 'border-emerald-200/90 bg-emerald-50/15'
                    : isLate
                    ? 'border-rose-300 ring-2 ring-rose-100 bg-rose-50/20'
                    : 'border-slate-200/90 hover:border-sky-300'
                }`}
              >
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  
                  {/* Left Pill color & Drug Information */}
                  <div className="flex items-start gap-3.5">
                    {/* Vertical Color Indicator */}
                    <div
                      className="w-3.5 self-stretch rounded-full shrink-0 min-h-[48px]"
                      style={{ backgroundColor: item.therapy.color || '#0284c7' }}
                      title="Codice colore farmaco"
                    />

                    <div>
                      {/* Patient Name & Scheduled Time */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-base font-['Outfit']">
                          {item.therapy.medicationName}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-md">
                          {item.therapy.dosage}
                        </span>
                        <span className="px-2 py-0.5 bg-sky-50 text-sky-800 text-[11px] font-bold rounded-md border border-sky-200">
                          {item.patient.name}
                        </span>
                      </div>

                      {/* Instructions */}
                      {item.therapy.instructions && (
                        <div className="text-xs text-slate-600 mt-1">
                          💡 <em>{item.therapy.instructions}</em>
                        </div>
                      )}

                      {/* Status / Log Info details */}
                      <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                        
                        {/* Time Badge */}
                        <span className={`inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-lg text-xs ${
                          isTaken
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isLate
                            ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          <Clock className="w-3.5 h-3.5" />
                          Ore {item.scheduledTime}
                          {isLate && ' • IN RITARDO'}
                        </span>

                        {/* If Taken: Who took it and exact timestamp */}
                        {isTaken && item.doseLog?.takenByUserName && (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Somministrato da <strong>{item.doseLog.takenByUserName}</strong>
                            {item.doseLog.takenAt && (
                              <span className="text-[11px] text-emerald-600 font-normal">
                                ({new Date(item.doseLog.takenAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            )}
                          </span>
                        )}

                        {/* If Skipped */}
                        {isSkipped && (
                          <span className="text-rose-700 font-semibold">
                            Saltato / Non somministrato da {item.doseLog?.takenByUserName || 'Caregiver'}
                          </span>
                        )}

                        {/* Notes snippet if present */}
                        {item.doseLog?.notes && (
                          <span className="text-slate-600 italic bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                            "{item.doseLog.notes}"
                          </span>
                        )}

                        {/* Solleciti sent count */}
                        {item.doseLog && item.doseLog.notificationsSentCount > 0 && !isTaken && (
                          <span className="text-amber-800 font-medium text-[11px]">
                            {item.doseLog.notificationsSentCount} {item.doseLog.notificationsSentCount === 1 ? 'sollecito inviato' : 'solleciti inviati'}
                          </span>
                        )}

                      </div>
                    </div>
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    
                    {/* Send WhatsApp / Push Nudge */}
                    {!isTaken && (
                      <button
                        onClick={() => onOpenNudgeModal(item)}
                        className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                        title="Invia sollecito WhatsApp o Push al caregiver"
                      >
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                        <span className="hidden sm:inline">Sollecita WhatsApp</span>
                      </button>
                    )}

                    {/* Open Detailed Note Modal */}
                    <button
                      onClick={() => onOpenDoseModal(item)}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                      title="Aggiungi note o cambia stato"
                    >
                      <FileEdit className="w-4 h-4" />
                    </button>

                    {/* Primary Fast 1-Click Spunta Button */}
                    <button
                      onClick={() => handleQuickCheck(item)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all ${
                        isTaken
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : isLate
                          ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                          : 'bg-sky-700 hover:bg-sky-800 text-white'
                      }`}
                    >
                      {isTaken ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Spuntato ✓</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Segna Somministrato</span>
                        </>
                      )}
                    </button>

                  </div>

                </div>
              </div>
            );
          })
        )}

      </div>

      {/* Encouraging completion banner if all taken */}
      {totalCount > 0 && takenCount === totalCount && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-6 text-white text-center shadow-lg animate-fade-in">
          <Sparkles className="w-10 h-10 text-emerald-200 mx-auto mb-2" />
          <h3 className="text-xl font-bold font-['Outfit']">Tutte le terapie di oggi sono state somministrate!</h3>
          <p className="text-emerald-100 text-xs mt-1 max-w-md mx-auto">
            Ottimo lavoro di squadra tra familiari e caregiver per la cura e la sicurezza del paziente.
          </p>
        </div>
      )}

    </div>
  );
};
