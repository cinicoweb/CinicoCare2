import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Heart,
  Plus,
  Bell,
  RefreshCw,
  Sparkles,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { TodayDosesView } from './components/TodayDosesView';
import { TherapiesView } from './components/TherapiesView';
import { HistoryView } from './components/HistoryView';
import { GroupSettingsView } from './components/GroupSettingsView';
import { AdminPanelView } from './components/AdminPanelView';
import { AuthModal } from './components/AuthModal';
import { InfoModal } from './components/InfoModal';
import { InstallAppModal } from './components/InstallAppModal';
import { DoseActionModal } from './components/DoseActionModal';
import { NudgeModal } from './components/NudgeModal';
import { UserProfileModal } from './components/UserProfileModal';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { InAppNotificationBanner } from './components/InAppNotificationBanner';
import { api } from './services/api';
import {
  User,
  Family,
  Patient,
  Therapy,
  DoseLog,
  Invitation,
  ScheduledDoseItem,
  NotificationSettings
} from './types';
import { audioAlert } from './utils/audio';
import { showLocalNotification, requestPushPermission } from './utils/notifications';

export const App: React.FC = () => {
  // Navigation & UI State
  const [activeTab, setActiveTab] = useState<'today' | 'therapies' | 'history' | 'settings' | 'admin'>('today');
  const [currentDate, setCurrentDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // App Data State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentFamily, setCurrentFamily] = useState<Family | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [therapies, setTherapies] = useState<Therapy[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);
  const [activeDoseModalState, setActiveDoseModalState] = useState<{
    item: ScheduledDoseItem;
    initialStatus?: 'taken' | 'skipped' | 'pending';
  } | null>(null);
  const [activeNudgeModalItem, setActiveNudgeModalItem] = useState<ScheduledDoseItem | null>(null);

  // Load app data
  const loadData = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    try {
      if (api.getToken()) {
        const data = await api.getBootstrap();
        setCurrentUser(data.user);
        setCurrentFamily(data.family);
        setPatients(data.patients || []);
        setTherapies(data.therapies || []);
        setDoseLogs(data.doseLogs || []);
        setMembers(data.members || []);
        setInvitations(data.invitations || []);
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.warn('Session check note:', err);
      if (api.getToken()) {
        api.clearToken();
        setCurrentUser(null);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Request push notification permissions on initial load if supported
    requestPushPermission();

    // Check if user came from an invite link
    const params = new URLSearchParams(window.location.search);
    if (params.get('invite') && !api.getToken()) {
      setIsAuthModalOpen(true);
    }

    // Real-time Firestore listener for live updates across family browsers
    let unsubSnapshot: (() => void) | null = null;
    if (currentUser?.familyId) {
      unsubSnapshot = api.subscribeFamilyUpdates(currentUser.familyId, (updates) => {
        if (updates.doseLogs) setDoseLogs(updates.doseLogs);
        if (updates.patients) setPatients(updates.patients);
        if (updates.therapies) setTherapies(updates.therapies);
      });
    }

    // Instant sync when tab gains focus or becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && api.getToken()) {
        loadData(false);
      }
    };
    const handleFocus = () => {
      if (api.getToken()) {
        loadData(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (unsubSnapshot) unsubSnapshot();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadData, currentUser?.familyId]);

  // Auth Handlers
  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    loadData();
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setCurrentFamily(null);
    setPatients([]);
    setTherapies([]);
    setDoseLogs([]);
    setMembers([]);
    setIsAuthModalOpen(true);
  };

  // State for quick confirmation toast
  const [confirmToastMessage, setConfirmToastMessage] = useState<string | null>(null);

  // Auto-Confirmation handler from WhatsApp/Telegram direct link
  useEffect(() => {
    if (!currentUser || therapies.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const confirmDoseParam = params.get('confirmDose');

    if (confirmDoseParam) {
      // Format: `${therapyId}_${scheduledDate}_${scheduledTime}`
      const parts = confirmDoseParam.split('_');
      if (parts.length >= 3) {
        const therapyId = parts[0];
        const scheduledDate = parts[1];
        const scheduledTime = parts[2];
        const therapy = therapies.find(t => t.id === therapyId);
        const patient = therapy ? patients.find(p => p.id === therapy.patientId) : null;

        if (therapy && patient) {
          handleToggleDose({
            therapyId,
            patientId: patient.id,
            scheduledDate,
            scheduledTime,
            status: 'taken',
            notes: 'Confermato tramite link diretto di notifica'
          });

          setConfirmToastMessage(
            `✅ Somministrazione registrata: ${therapy.medicationName} per ${patient.name} (${scheduledTime})`
          );
          setTimeout(() => setConfirmToastMessage(null), 5000);

          // Clean URL query param without refreshing
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }
      }
    }
  }, [currentUser, therapies, patients]);

  // Automated Notification Engine: runs automatically to alert caregivers without human intervention
  useEffect(() => {
    if (!currentUser || therapies.length === 0) return;

    const notifiedKeys = new Set<string>();

    const checkAndDispatchAutomaticNotifications = () => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const dayOfWeek = now.getDay();
      const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const preAlert = currentFamily?.notificationSettings?.preAlertMinutes ?? 15;
      const soundEnabled = currentFamily?.notificationSettings?.soundAlarmEnabled ?? true;
      const pushEnabled = currentFamily?.notificationSettings?.pushEnabled ?? true;

      therapies.forEach(therapy => {
        if (!therapy.isActive) return;
        if (!therapy.daysOfWeek.includes(dayOfWeek)) return;
        if (therapy.startDate && therapy.startDate > todayDateStr) return;
        if (therapy.endDate && therapy.endDate < todayDateStr) return;

        const patient = patients.find(p => p.id === therapy.patientId);
        if (!patient) return;

        // Identify ALL AND ONLY the caregivers for this patient
        const patientCaregivers = members.filter(m =>
          (m.assignedPatientIds && m.assignedPatientIds.includes(patient.id)) ||
          (m.role === 'caregiver' && (!m.assignedPatientIds || m.assignedPatientIds.length === 0)) ||
          m.isFamilyAdmin
        );

        // Check if current logged-in user is one of these caregivers
        const isCurrentCaregiver = patientCaregivers.some(c => c.id === currentUser.id) || currentUser.isFamilyAdmin;

        therapy.timeSlots.forEach(slot => {
          const [slotH, slotM] = slot.split(':').map(Number);
          const slotMinutes = slotH * 60 + slotM;
          const diffMinutes = nowMinutes - slotMinutes;

          // Check if dose is pending in today's doseLogs
          const doseId = `${therapy.id}_${todayDateStr}_${slot}`;
          const existingLog = doseLogs.find(d => d.id === doseId);
          const isTaken = existingLog?.status === 'taken' || existingLog?.status === 'skipped';

          if (isTaken) return;

          // Trigger window: between -preAlertMinutes and +60 minutes
          const isDueOrUpcoming = diffMinutes >= -preAlert && diffMinutes <= 60;
          const notificationKey = `${doseId}_${todayDateStr}_${Math.floor(diffMinutes / 10)}`;

          if (isDueOrUpcoming && !notifiedKeys.has(notificationKey)) {
            notifiedKeys.add(notificationKey);

            if (isCurrentCaregiver) {
              if (soundEnabled) {
                audioAlert.playReminderChime();
              }
              if (pushEnabled) {
                showLocalNotification(`🔔 Ora del farmaco: ${patient.name}`, {
                  body: `È il momento di assumere ${therapy.medicationName}${therapy.dosage ? ` (${therapy.dosage})` : ''} - Orario: ${slot}.`,
                  tag: doseId,
                  therapyId: therapy.id,
                  patientId: patient.id,
                  scheduledDate: todayDateStr,
                  scheduledTime: slot,
                  medicationName: therapy.medicationName,
                  patientName: patient.name
                });
              }
            }
          }
        });
      });
    };

    // Run immediately and every 30 seconds
    checkAndDispatchAutomaticNotifications();
    const interval = setInterval(checkAndDispatchAutomaticNotifications, 30000);

    return () => clearInterval(interval);
  }, [currentUser, therapies, patients, doseLogs, members, currentFamily]);
  const handleToggleDose = async (payload: {
    therapyId: string;
    patientId: string;
    scheduledDate: string;
    scheduledTime: string;
    status: 'taken' | 'skipped' | 'pending';
    notes?: string;
  }) => {
    const doseId = `${payload.therapyId}_${payload.scheduledDate}_${payload.scheduledTime}`;
    const optimisticDoseLog: DoseLog = {
      id: doseId,
      familyId: currentUser?.familyId || 'family_default',
      therapyId: payload.therapyId,
      patientId: payload.patientId,
      scheduledDate: payload.scheduledDate,
      scheduledTime: payload.scheduledTime,
      status: payload.status,
      takenAt: payload.status === 'taken' ? new Date().toISOString() : null,
      takenByUserId: payload.status === 'taken' ? (currentUser?.id || null) : null,
      takenByUserName: payload.status === 'taken' ? (currentUser?.name || 'Utente') : null,
      notes: payload.notes || null,
      notificationsSentCount: 0,
      lastNotifiedAt: null
    };

    // Instant UI update
    setDoseLogs(prev => {
      const filtered = prev.filter(l => l.id !== doseId);
      return [...filtered, optimisticDoseLog];
    });

    try {
      const res = await api.toggleDose(payload);
      if (res?.doseLog) {
        setDoseLogs(prev => {
          const filtered = prev.filter(l => l.id !== res.doseLog.id);
          return [...filtered, res.doseLog];
        });
      }
    } catch (err: any) {
      console.error('Dose toggle error:', err);
    }
  };

  // Therapy operations
  const handleSaveTherapy = async (therapyData: Partial<Therapy>) => {
    try {
      const res = await api.saveTherapy(therapyData);
      setTherapies(prev => {
        const filtered = prev.filter(t => t.id !== res.therapy.id);
        return [...filtered, res.therapy];
      });
    } catch (err: any) {
      throw err;
    }
  };

  const handleDeleteTherapy = async (id: string) => {
    try {
      await api.deleteTherapy(id);
      setTherapies(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      alert(err.message || 'Errore durante l\'eliminazione della terapia');
    }
  };

  // Patient operations
  const handleSavePatient = async (patientData: Partial<Patient>) => {
    try {
      const res = await api.savePatient(patientData);
      setPatients(prev => {
        const filtered = prev.filter(p => p.id !== res.patient.id);
        return [...filtered, res.patient];
      });
    } catch (err: any) {
      throw err;
    }
  };

  const handleDeletePatient = async (id: string) => {
    try {
      await api.deletePatient(id);
      setPatients(prev => prev.filter(p => p.id !== id));
      setTherapies(prev => prev.filter(t => t.patientId !== id));
    } catch (err: any) {
      alert(err.message || 'Errore durante l\'eliminazione del paziente');
    }
  };

  // Member operations
  const handleCreateMember = async (payload: {
    name: string;
    email: string;
    phone?: string;
    role: 'familiare' | 'caregiver';
    password?: string;
    assignedPatientIds?: string[];
  }) => {
    try {
      const res = await api.createMember(payload);
      setMembers(prev => [...prev, res.member]);
    } catch (err: any) {
      throw err;
    }
  };

  const handleUpdateMember = async (id: string, payload: {
    name?: string;
    phone?: string;
    role?: 'familiare' | 'caregiver';
    password?: string;
    assignedPatientIds?: string[];
    isFamilyAdmin?: boolean;
  }) => {
    try {
      const res = await api.updateMember(id, payload);
      setMembers(prev => prev.map(m => m.id === id ? res.member : m));
    } catch (err: any) {
      throw err;
    }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      await api.deleteMember(id);
      setMembers(prev => prev.filter(m => m.id !== id));
    } catch (err: any) {
      alert(err.message || 'Errore durante la rimozione del membro');
    }
  };

  // Family settings update
  const handleSaveFamilySettings = async (name?: string, settings?: Partial<NotificationSettings>) => {
    try {
      const res = await api.updateFamilySettings(name, settings);
      setCurrentFamily(res.family);
    } catch (err: any) {
      throw err;
    }
  };

  // Count pending or overdue doses for badge
  const pendingOrOverdueDoseCount = useMemo(() => {
    const now = new Date();
    const currentHoursMinutes = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    let count = 0;
    therapies.forEach(t => {
      if (!t.isActive) return;
      t.timeSlots.forEach(slot => {
        const id = `${t.id}_${todayStr}_${slot}`;
        const log = doseLogs.find(d => d.id === id);
        if (!log || log.status === 'pending') {
          count++;
        }
      });
    });
    return count;
  }, [therapies, doseLogs]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 bg-gradient-to-br from-sky-700 to-teal-700 rounded-3xl flex items-center justify-center mx-auto shadow-lg animate-pulse">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 font-['Outfit']">CinicoCare</h2>
          <p className="text-xs text-slate-500">Avvio gestione somministrazione farmaci...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col selection:bg-sky-200 selection:text-sky-900">
      
      {/* Top Navigation */}
      <Navbar
        currentUser={currentUser}
        currentFamily={currentFamily}
        activeTab={activeTab}
        setActiveTab={(tab: string) => setActiveTab(tab as any)}
        pendingDoseCount={pendingOrOverdueDoseCount}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onOpenInfoModal={() => setIsInfoModalOpen(true)}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* If user is logged in, show active tab view */}
        {currentUser ? (
          <>
            {activeTab === 'today' && (
              <TodayDosesView
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                patients={patients}
                therapies={therapies}
                doseLogs={doseLogs}
                currentUser={currentUser}
                currentFamily={currentFamily}
                caregivers={members}
                onToggleDose={handleToggleDose}
                onOpenDoseModal={(item, initialStatus) => setActiveDoseModalState({ item, initialStatus })}
                onOpenNudgeModal={(item) => setActiveNudgeModalItem(item)}
                onNavigateToTherapies={() => setActiveTab('therapies')}
              />
            )}

            {activeTab === 'therapies' && (
              <TherapiesView
                patients={patients}
                therapies={therapies}
                currentUser={currentUser}
                onSaveTherapy={handleSaveTherapy}
                onDeleteTherapy={handleDeleteTherapy}
                onNavigateToGroupSettings={() => setActiveTab('settings')}
              />
            )}

            {activeTab === 'history' && (
              <HistoryView
                doseLogs={doseLogs}
                patients={patients}
                therapies={therapies}
                members={members}
              />
            )}

            {activeTab === 'settings' && (
              <GroupSettingsView
                currentFamily={currentFamily}
                currentUser={currentUser}
                patients={patients}
                members={members}
                invitations={invitations}
                onSaveFamilySettings={handleSaveFamilySettings}
                onSavePatient={handleSavePatient}
                onDeletePatient={handleDeletePatient}
                onCreateMember={handleCreateMember}
                onUpdateMember={handleUpdateMember}
                onDeleteMember={handleDeleteMember}
                onRefreshData={loadData}
              />
            )}

            {activeTab === 'admin' && currentUser.role === 'superadmin' && (
              <AdminPanelView
                onRefreshData={loadData}
                onOpenProfileModal={() => setIsProfileModalOpen(true)}
              />
            )}
          </>
        ) : (
          /* Guest Landing / Access Prompt */
          <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-slate-200/80 text-center max-w-2xl mx-auto my-8 animate-fade-in">
            <div className="w-16 h-16 bg-gradient-to-br from-sky-700 to-teal-700 rounded-3xl flex items-center justify-center mx-auto shadow-md mb-5">
              <Heart className="w-9 h-9 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-['Outfit'] tracking-tight">
              CinicoCare
            </h2>
            <p className="text-slate-600 text-sm mt-2 max-w-md mx-auto leading-relaxed">
              Piattaforma indipendente per la gestione coordinata della somministrazione farmaci per familiari e caregiver, con solleciti continui WhatsApp e Push in tempo reale.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full sm:w-auto px-6 py-3 bg-sky-700 hover:bg-sky-800 text-white text-sm font-bold rounded-2xl shadow-sm transition-all"
              >
                Accedi o Registrati Gratis
              </button>
              <button
                onClick={() => setIsInfoModalOpen(true)}
                className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-2xl transition-all"
              >
                Informazioni & Licenza
              </button>
            </div>

            <div className="mt-10 pt-6 border-t border-slate-100 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="font-bold text-slate-900 text-base">Illimitato</div>
                <div className="text-[11px] text-slate-500">Familiari e caregiver</div>
              </div>
              <div>
                <div className="font-bold text-emerald-700 text-base">WhatsApp</div>
                <div className="text-[11px] text-slate-500">Solleciti continui</div>
              </div>
              <div>
                <div className="font-bold text-sky-700 text-base">100% Gratuito</div>
                <div className="text-[11px] text-slate-500">Nessuna pubblicità</div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Floating Fast Refresh / Sync Indicator */}
      <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2">
        <button
          onClick={() => loadData(true)}
          className={`p-2.5 bg-white/90 backdrop-blur-sm hover:bg-white text-slate-700 rounded-full shadow-md border border-slate-200 transition-all ${
            isRefreshing ? 'animate-spin text-sky-700' : ''
          }`}
          title="Sincronizza e aggiorna dati in tempo reale"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* App Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-6 px-4 text-center text-xs text-slate-500 space-y-1.5">
        <div className="flex items-center justify-center gap-2 font-medium text-slate-700">
          <span>CinicoCare</span>
          <span>•</span>
          <span>Progettata e realizzata da Nicola Cirillo</span>
          <span>•</span>
          <span>Copyright © 2026 Tutti i diritti riservati</span>
        </div>
        <div className="pt-1">
          <button
            onClick={() => setIsInfoModalOpen(true)}
            className="text-sky-700 hover:text-sky-800 font-semibold underline text-[11px] mr-3"
          >
            Crediti & Trasparenza Privacy
          </button>
          <button
            onClick={() => setIsInstallModalOpen(true)}
            className="text-teal-700 hover:text-teal-800 font-semibold underline text-[11px]"
          >
            Installa come Web App (PWA)
          </button>
        </div>
      </footer>

      {/* MODALS */}
      {currentUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          user={currentUser}
          onClose={() => setIsProfileModalOpen(false)}
          onUserUpdated={(u) => {
            setCurrentUser(u);
            loadData(false);
          }}
        />
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        onOpenInfo={() => setIsInfoModalOpen(true)}
        onOpenPrivacyDisclaimer={() => setIsInfoModalOpen(true)}
      />

      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />

      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      <DoseActionModal
        isOpen={Boolean(activeDoseModalState)}
        doseItem={activeDoseModalState?.item || null}
        initialStatus={activeDoseModalState?.initialStatus}
        onClose={() => setActiveDoseModalState(null)}
        onConfirm={async (status, notes) => {
          if (!activeDoseModalState?.item) return;
          const item = activeDoseModalState.item;
          await handleToggleDose({
            therapyId: item.therapy.id,
            patientId: item.patient.id,
            scheduledDate: item.scheduledDate,
            scheduledTime: item.scheduledTime,
            status,
            notes
          });
        }}
      />

      <NudgeModal
        isOpen={Boolean(activeNudgeModalItem)}
        doseItem={activeNudgeModalItem}
        caregivers={members}
        onClose={() => setActiveNudgeModalItem(null)}
        onSuccess={() => loadData(false)}
      />

      {/* Confirmation Toast Alert */}
      {confirmToastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-emerald-700 text-white p-4 rounded-2xl shadow-xl border border-emerald-500/30 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-200" />
          <div className="text-xs font-semibold">{confirmToastMessage}</div>
          <button
            onClick={() => setConfirmToastMessage(null)}
            className="ml-auto text-emerald-200 hover:text-white text-xs font-bold px-2 py-1 bg-emerald-800/60 rounded-lg"
          >
            OK
          </button>
        </div>
      )}

      {/* In-App Floating Notification Banner & Push Permission Prompt */}
      <InAppNotificationBanner
        onConfirmDose={handleToggleDose}
        onOpenSkipModal={(payload) => {
          const matchingTherapy = therapies.find(t => t.id === payload.therapyId);
          const matchingPatient = patients.find(p => p.id === payload.patientId);
          if (matchingTherapy && matchingPatient) {
            const scheduledItem: ScheduledDoseItem = {
              id: `${payload.therapyId}_${payload.scheduledDate}_${payload.scheduledTime}`,
              doseLogId: `${payload.therapyId}_${payload.scheduledDate}_${payload.scheduledTime}`,
              therapy: matchingTherapy,
              patient: matchingPatient,
              scheduledDate: payload.scheduledDate,
              scheduledTime: payload.scheduledTime,
              scheduledDateTime: new Date(`${payload.scheduledDate}T${payload.scheduledTime}:00`),
              status: 'pending',
              isDueNow: true,
              isUpcoming: false,
              isOverdue: false
            };
            setActiveDoseModalState({ item: scheduledItem, initialStatus: 'skipped' });
          }
        }}
      />

      <CookieConsentBanner
        onOpenPrivacyModal={() => setIsInfoModalOpen(true)}
      />

    </div>
  );
};

export default App;

