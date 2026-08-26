import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  Settings,
  Bell,
  MessageSquare,
  Volume2,
  Lock,
  Phone,
  Mail,
  Edit2,
  Trash2,
  Plus,
  Check,
  X,
  AlertCircle,
  ShieldCheck,
  Share2,
  Send,
  Heart,
  Key,
  Copy,
  Link as LinkIcon,
  CheckCircle2,
  FileText,
  RotateCcw
} from 'lucide-react';
import { Patient, User, Family, NotificationSettings, Invitation } from '../types';
import { requestPushPermission } from '../utils/notifications';
import { formatPhoneNumber } from '../utils/phone';
import { DEFAULT_PRIVACY_DISCLAIMER_MARKDOWN } from '../utils/privacyDefault';
import { api } from '../services/api';

interface GroupSettingsViewProps {
  currentFamily: Family | null;
  currentUser: User;
  patients: Patient[];
  members: User[];
  invitations: Invitation[];
  onSaveFamilySettings: (name?: string, settings?: Partial<NotificationSettings>, privacyDisclaimerMarkdown?: string) => Promise<void>;
  onSavePatient: (patient: Partial<Patient>) => Promise<void>;
  onDeletePatient: (id: string) => Promise<void>;
  onCreateMember: (payload: {
    name: string;
    email: string;
    phone?: string;
    role: 'familiare' | 'caregiver';
    password?: string;
    assignedPatientIds?: string[];
  }) => Promise<void>;
  onUpdateMember: (id: string, payload: {
    name?: string;
    email?: string;
    phone?: string;
    role?: 'familiare' | 'caregiver';
    password?: string;
    assignedPatientIds?: string[];
    isFamilyAdmin?: boolean;
  }) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
  onRefreshData?: () => Promise<void>;
}

export const GroupSettingsView: React.FC<GroupSettingsViewProps> = ({
  currentFamily,
  currentUser,
  patients,
  members,
  invitations,
  onSaveFamilySettings,
  onSavePatient,
  onDeletePatient,
  onCreateMember,
  onUpdateMember,
  onDeleteMember,
  onRefreshData
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'patients' | 'members' | 'notifications'>('patients');
  
  // Patient Modal state
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [patientName, setPatientName] = useState('');
  const [patientBirthDate, setPatientBirthDate] = useState('');
  const [patientNotes, setPatientNotes] = useState('');
  const [assignedCaregivers, setAssignedCaregivers] = useState<string[]>([]);
  const [patientSaving, setPatientSaving] = useState(false);
  const [patientError, setPatientError] = useState<string | null>(null);

  // Member Modal state (Manual creation / Edit)
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<User | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberRole, setMemberRole] = useState<'familiare' | 'caregiver'>('caregiver');
  const [memberPassword, setMemberPassword] = useState('');
  const [memberAssignedPatients, setMemberAssignedPatients] = useState<string[]>([]);
  const [memberIsAdmin, setMemberIsAdmin] = useState(false);
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  // Smart WhatsApp Invite Link Modal state
  const [isInviteLinkModalOpen, setIsInviteLinkModalOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<'caregiver' | 'familiare'>('caregiver');
  const [inviteAssignedPatients, setInviteAssignedPatients] = useState<string[]>([]);
  const [inviteRecipientPhone, setInviteRecipientPhone] = useState('');
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [inviteGenerating, setInviteGenerating] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Notification & Privacy Settings state
  const [familyName, setFamilyName] = useState(currentFamily?.name || '');
  const [privacyDisclaimerMarkdown, setPrivacyDisclaimerMarkdown] = useState(
    currentFamily?.privacyDisclaimerMarkdown || DEFAULT_PRIVACY_DISCLAIMER_MARKDOWN
  );
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    currentFamily?.notificationSettings || {
      whatsappEnabled: true,
      telegramEnabled: true,
      pushEnabled: true,
      soundAlarmEnabled: true,
      preAlertMinutes: 15,
      repeatIntervalMinutes: 10,
      autoRepeatNudges: true,
      customWhatsappTemplate: '🔔 *CinicoCare Promemoria Terapia*\nCiao *{caregiver}*, è ora del farmaco per *{paziente}*!\n💊 Farmaco: *{farmaco}*{dosaggio}\n⏰ Orario: *{orario}*\n📝 Istruzioni: {istruzioni}\n\n👉 *Conferma somministrazione nell\'App:*\n{link_conferma}',
      customTelegramTemplate: '🔔 *CinicoCare Promemoria Terapia*\nCiao *{caregiver}*, è ora del farmaco per *{paziente}*!\n💊 Farmaco: *{farmaco}*{dosaggio}\n⏰ Orario: *{orario}*\n📝 Istruzioni: {istruzioni}\n\n👉 *Conferma somministrazione nell\'App:*\n{link_conferma}'
    }
  );
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  const isFamilyAdmin = currentUser.isFamilyAdmin || currentUser.role === 'superadmin';

  // --- Handlers: Patients ---
  const handleOpenPatientModal = (patient?: Patient) => {
    if (patient) {
      setEditingPatient(patient);
      setPatientName(patient.name);
      setPatientBirthDate(patient.birthDate || '');
      setPatientNotes(patient.notes || '');
      setAssignedCaregivers(patient.assignedCaregiverIds || []);
    } else {
      setEditingPatient(null);
      setPatientName('');
      setPatientBirthDate('');
      setPatientNotes('');
      setAssignedCaregivers(members.map(m => m.id));
    }
    setPatientError(null);
    setIsPatientModalOpen(true);
  };

  const handleSavePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) {
      setPatientError('Inserisci il nome del paziente');
      return;
    }

    setPatientSaving(true);
    setPatientError(null);
    try {
      await onSavePatient({
        id: editingPatient?.id,
        name: patientName.trim(),
        birthDate: patientBirthDate || undefined,
        notes: patientNotes.trim() || undefined,
        assignedCaregiverIds: assignedCaregivers
      });
      setIsPatientModalOpen(false);
    } catch (err: any) {
      setPatientError(err.message || 'Errore salvataggio paziente');
    } finally {
      setPatientSaving(false);
    }
  };

  // --- Handlers: Members ---
  const handleOpenMemberModal = (member?: User) => {
    if (member) {
      setEditingMember(member);
      setMemberName(member.name);
      setMemberEmail(member.email);
      setMemberPhone(member.phone || '');
      setMemberRole(member.role === 'familiare' ? 'familiare' : 'caregiver');
      setMemberAssignedPatients(member.assignedPatientIds || []);
      setMemberIsAdmin(member.isFamilyAdmin);
      setMemberPassword('');
    } else {
      setEditingMember(null);
      setMemberName('');
      setMemberEmail('');
      setMemberPhone('');
      setMemberRole('caregiver');
      setMemberAssignedPatients(patients.map(p => p.id));
      setMemberIsAdmin(false);
      setMemberPassword('Care2026!' + Math.floor(100 + Math.random() * 900));
    }
    setMemberError(null);
    setIsMemberModalOpen(true);
  };

  const handleSaveMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || !memberEmail.trim()) {
      setMemberError('Nome ed email sono obbligatori');
      return;
    }

    setMemberSaving(true);
    setMemberError(null);

    const formattedPhone = memberPhone.trim() ? formatPhoneNumber(memberPhone.trim()) : undefined;

    try {
      if (editingMember) {
        await onUpdateMember(editingMember.id, {
          name: memberName.trim(),
          email: memberEmail.trim().toLowerCase(),
          phone: formattedPhone,
          role: memberRole,
          password: memberPassword.trim() || undefined,
          assignedPatientIds: memberAssignedPatients,
          isFamilyAdmin: memberIsAdmin
        });
      } else {
        await onCreateMember({
          name: memberName.trim(),
          email: memberEmail.trim().toLowerCase(),
          phone: formattedPhone,
          role: memberRole,
          password: memberPassword.trim() || undefined,
          assignedPatientIds: memberAssignedPatients
        });
      }
      setIsMemberModalOpen(false);
    } catch (err: any) {
      setMemberError(err.message || 'Errore salvataggio membro');
    } finally {
      setMemberSaving(false);
    }
  };

  // --- Handlers: Smart One-Time Invite Link ---
  const handleOpenInviteLinkModal = () => {
    setInviteRole('caregiver');
    setInviteAssignedPatients(patients.map(p => p.id));
    setInviteRecipientPhone('');
    setGeneratedInviteUrl(null);
    setInviteCopied(false);
    setInviteError(null);
    setIsInviteLinkModalOpen(true);
  };

  const handleGenerateInviteToken = async () => {
    setInviteGenerating(true);
    setInviteError(null);
    setInviteCopied(false);
    try {
      const res = await api.createInvitation({
        role: inviteRole,
        assignedPatientIds: inviteAssignedPatients
      });
      setGeneratedInviteUrl(res.inviteUrl);
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      setInviteError(err.message || 'Errore nella generazione del link di invito');
    } finally {
      setInviteGenerating(false);
    }
  };

  const handleCopyInviteLink = () => {
    if (!generatedInviteUrl) return;
    navigator.clipboard.writeText(generatedInviteUrl);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  };

  const handleSendWhatsAppInviteLink = () => {
    if (!generatedInviteUrl) return;
    const roleLabel = inviteRole === 'caregiver' ? 'Caregiver Incaricato' : 'Familiare';
    const famName = currentFamily?.name || 'la nostra famiglia';
    
    const message = `👋 *Invito CinicoCare - Gestione Terapie*\n\nCiao! Sei stato/a invitato/a a collaborare come *${roleLabel}* per il gruppo *"${famName}"*.\n\n👉 Clicca su questo link sicuro per registrarti e impostare la tua password personale:\n${generatedInviteUrl}\n\n*(Il link è personale e monouso)*`;

    const formatted = inviteRecipientPhone ? formatPhoneNumber(inviteRecipientPhone) : '';
    const cleanPhone = formatted.replace(/[^0-9]/g, '');
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
  };

  // Send WhatsApp invite to an existing registered member
  const handleSendWhatsAppInvite = (member: User) => {
    const baseUrl = (window.location.origin + window.location.pathname).replace(/\/$/, '');
    const text = `👋 Ciao ${member.name}! Sei nel gruppo "${currentFamily?.name || 'CinicoCare'}" per la gestione e somministrazione farmaci.\n\n👉 Accedi a CinicoCare con la tua email (${member.email}) qui:\n${baseUrl}`;
    const formatted = member.phone ? formatPhoneNumber(member.phone) : '';
    const cleanPhone = formatted.replace(/[^0-9]/g, '');
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // --- Handlers: Settings ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsSuccess(false);

    try {
      await onSaveFamilySettings(familyName, notificationSettings, privacyDisclaimerMarkdown);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Errore salvataggio impostazioni');
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-['Outfit'] flex items-center gap-2">
              <Settings className="w-5 h-5 text-sky-700" />
              Impostazioni & Anagrafica Unificata del Gruppo
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Gestione centralizzata di pazienti, caregiver, inviti sicuri WhatsApp e configurazione promemoria.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 text-sky-900 rounded-xl border border-sky-200 text-xs font-bold shrink-0">
            <Users className="w-4 h-4 text-sky-700" />
            <span>Gruppo: {currentFamily?.name || 'Famiglia'}</span>
            <span className="px-1.5 py-0.5 bg-sky-200 text-sky-900 rounded text-[10px]">
              {currentFamily?.code || 'CNC-2026'}
            </span>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex border-b border-slate-200 mt-6 gap-2 sm:gap-4 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('patients')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeSubTab === 'patients'
                ? 'border-sky-700 text-sky-800'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Heart className="w-4 h-4" />
            Anagrafica Pazienti ({patients.length})
          </button>

          <button
            onClick={() => setActiveSubTab('members')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeSubTab === 'members'
                ? 'border-sky-700 text-sky-800'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Familiari & Caregiver ({members.length})
          </button>

          <button
            onClick={() => setActiveSubTab('notifications')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeSubTab === 'notifications'
                ? 'border-sky-700 text-sky-800'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Bell className="w-4 h-4" />
            Notifiche, WhatsApp & Solleciti
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: PATIENTS ANAGRAFICA */}
      {activeSubTab === 'patients' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Pazienti Assistiti</h3>
              <p className="text-xs text-slate-500">I pazienti per cui sono programmate le somministrazioni farmacologiche.</p>
            </div>

            {isFamilyAdmin && (
              <button
                onClick={() => handleOpenPatientModal()}
                className="px-3.5 py-2 bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Aggiungi Paziente
              </button>
            )}
          </div>

          {patients.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center mx-auto">
                <Heart className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">Nessun paziente inserito</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Inserisci il primo paziente assistito per iniziare a pianificare e monitorare le terapie.
              </p>
              {isFamilyAdmin && (
                <button
                  onClick={() => handleOpenPatientModal()}
                  className="px-4 py-2 bg-sky-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  + Aggiungi Paziente
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {patients.map(p => (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-sm">
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-base font-['Outfit']">{p.name}</h4>
                          {p.birthDate && (
                            <span className="text-[11px] text-slate-500">
                              Data di nascita: {p.birthDate}
                            </span>
                          )}
                        </div>
                      </div>

                      {isFamilyAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenPatientModal(p)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Modifica paziente"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Sei sicuro di voler eliminare il paziente "${p.name}" e tutte le sue terapie associate?`)) {
                                await onDeletePatient(p.id);
                              }
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Elimina paziente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Clinical Notes / Allergies */}
                    {p.notes && (
                      <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700">
                        <span className="font-semibold text-slate-900 block mb-0.5">Note cliniche & avvertenze:</span>
                        {p.notes}
                      </div>
                    )}

                    {/* Assigned Caregivers */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Caregiver Assegnati ({p.assignedCaregiverIds?.length || 0})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {p.assignedCaregiverIds && p.assignedCaregiverIds.length > 0 ? (
                          p.assignedCaregiverIds.map(cId => {
                            const caregiver = members.find(m => m.id === cId);
                            if (!caregiver) return null;
                            return (
                              <span
                                key={cId}
                                className="px-2 py-0.5 bg-teal-50 text-teal-800 text-[11px] font-semibold rounded-md border border-teal-200"
                              >
                                {caregiver.name} ({caregiver.role === 'familiare' ? 'Fam' : 'Care'})
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-slate-400 italic">Tutti i caregiver del gruppo</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: MEMBERS & CAREGIVER ANAGRAFICA */}
      {activeSubTab === 'members' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Familiari e Caregiver del Gruppo</h3>
              <p className="text-xs text-slate-500">Gestisci i collaboratori o invia un link WhatsApp monouso per registrazione autonoma.</p>
            </div>

            {isFamilyAdmin && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleOpenInviteLinkModal}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
                  title="Genera link WhatsApp sicuro e monouso per registrazione autonoma"
                >
                  <Share2 className="w-4 h-4" />
                  Link Invito WhatsApp
                </button>

                <button
                  onClick={() => handleOpenMemberModal()}
                  className="px-3.5 py-2 bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Crea Utente Manuale
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map(m => {
              const isSelf = m.id === currentUser.id;
              const isMemberAdmin = m.isFamilyAdmin;

              return (
                <div
                  key={m.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                          {m.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            <span>{m.name}</span>
                            {isSelf && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded font-bold">Tu</span>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                            m.role === 'familiare'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-teal-100 text-teal-800'
                          }`}>
                            {m.role === 'familiare' ? (isMemberAdmin ? 'Familiare (Admin)' : 'Familiare') : 'Caregiver Incaricato'}
                          </span>
                        </div>
                      </div>

                      {/* Edit / Delete actions */}
                      {isFamilyAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenMemberModal(m)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Modifica profilo e password"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!isSelf && (
                            <button
                              onClick={async () => {
                                if (confirm(`Rimuovere "${m.name}" dal gruppo famiglia?`)) {
                                  await onDeleteMember(m.id);
                                }
                              }}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Rimuovi membro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Contacts: Email & Phone */}
                    <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{m.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{m.phone || 'Nessun numero WhatsApp'}</span>
                      </div>
                    </div>

                    {/* Assigned Patients count */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
                      <strong>Pazienti seguiti:</strong>{' '}
                      {m.assignedPatientIds && m.assignedPatientIds.length > 0
                        ? m.assignedPatientIds.map(pid => patients.find(p => p.id === pid)?.name).filter(Boolean).join(', ')
                        : 'Tutti i pazienti della famiglia'}
                    </div>
                  </div>

                  {/* WhatsApp Invitation action */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => handleSendWhatsAppInvite(m)}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline"
                      title="Invia messaggio di promemoria accesso WhatsApp con link all'app"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Invia WhatsApp
                    </button>

                    {isFamilyAdmin && (
                      <button
                        onClick={() => handleOpenMemberModal(m)}
                        className="text-xs font-semibold text-sky-700 hover:text-sky-800 flex items-center gap-1 hover:underline"
                        title="Cambia password di questo utente"
                      >
                        <Key className="w-3.5 h-3.5" />
                        Password
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: NOTIFICATIONS, CHANNELS & PRIVACY DISCLAIMER */}
      {activeSubTab === 'notifications' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
          
          {settingsSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Impostazioni di gruppo, canali e informativa salvate con successo!</span>
            </div>
          )}

          {/* Group Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nome del Gruppo Famiglia</label>
            <input
              type="text"
              disabled={!isFamilyAdmin}
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              className="w-full sm:w-80 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-sky-600"
            />
          </div>

          {/* Notification Channels */}
          <div className="border-t border-slate-100 pt-5">
            <h4 className="font-bold text-slate-900 text-sm mb-1">Canali di Notifica & Allarmi</h4>
            <p className="text-xs text-slate-500 mb-4">
              Tutte le funzioni di notifica possono essere attivate o disattivate singolarmente. I messaggi sono inviati ai caregiver assegnati al paziente.
            </p>

            <div className="space-y-4">
              
              {/* WhatsApp Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">Avvisi & Solleciti WhatsApp</div>
                    <div className="text-[11px] text-slate-500">
                      Invia messaggi preformattati via WhatsApp ai caregiver assegnati con link diretto di conferma somministrazione.
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isFamilyAdmin}
                    checked={notificationSettings.whatsappEnabled}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, whatsappEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Telegram Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-sky-100 text-sky-800 rounded-xl shrink-0">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">Avvisi & Solleciti Telegram</div>
                    <div className="text-[11px] text-slate-500">
                      Invia promemoria istantanei via Telegram con link di conferma rapida per ciascun caregiver.
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isFamilyAdmin}
                    checked={notificationSettings.telegramEnabled !== false}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, telegramEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>

              {/* Push Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-800 rounded-xl shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">Notifiche Push Browser & Mobile</div>
                    <div className="text-[11px] text-slate-500">
                      Ricevi notifiche sul dispositivo quando è il momento della somministrazione di un farmaco.
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isFamilyAdmin}
                    checked={notificationSettings.pushEnabled}
                    onChange={(e) => {
                      setNotificationSettings({ ...notificationSettings, pushEnabled: e.target.checked });
                      if (e.target.checked) requestPushPermission();
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Sound Alarm Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 text-purple-800 rounded-xl shrink-0">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">Allarme Sonoro Continuo</div>
                    <div className="text-[11px] text-slate-500">
                      Segnale acustico ripetuto quando una dose è in ritardo fino a conferma della somministrazione.
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isFamilyAdmin}
                    checked={notificationSettings.soundAlarmEnabled}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, soundAlarmEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

            </div>
          </div>

          {/* Templates */}
          <div className="border-t border-slate-100 pt-5 space-y-4">
            <h4 className="font-bold text-slate-900 text-sm">Template Messaggi di Allerta</h4>
            <p className="text-xs text-slate-500">
              Personalizza i testi inviati su WhatsApp e Telegram. Variabili disponibili: <code>{'{caregiver}'}</code>, <code>{'{paziente}'}</code>, <code>{'{farmaco}'}</code>, <code>{'{dosaggio}'}</code>, <code>{'{orario}'}</code>, <code>{'{istruzioni}'}</code>, <code>{'{link_conferma}'}</code>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                Template Messaggio WhatsApp
              </label>
              <textarea
                rows={3}
                disabled={!isFamilyAdmin}
                value={notificationSettings.customWhatsappTemplate}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, customWhatsappTemplate: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:bg-white focus:border-sky-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-sky-600" />
                Template Messaggio Telegram
              </label>
              <textarea
                rows={3}
                disabled={!isFamilyAdmin}
                value={notificationSettings.customTelegramTemplate || notificationSettings.customWhatsappTemplate}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, customTelegramTemplate: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:bg-white focus:border-sky-600"
              />
            </div>
          </div>

          {/* Privacy Disclaimer & Medical Device Notice */}
          <div className="border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-sky-700" />
                  Informativa Privacy & Termini (Non Dispositivo Medico)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Testo informativo visualizzato nel footer e al login. Dichiara esplicitamente la natura di strumento di supporto e non dispositivo medico.
                </p>
              </div>
              {isFamilyAdmin && (
                <button
                  type="button"
                  onClick={() => setPrivacyDisclaimerMarkdown(DEFAULT_PRIVACY_DISCLAIMER_MARKDOWN)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg flex items-center gap-1 transition-colors"
                  title="Ripristina il testo predefinito"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Ripristina Default
                </button>
              )}
            </div>

            <textarea
              rows={8}
              disabled={!isFamilyAdmin}
              value={privacyDisclaimerMarkdown}
              onChange={(e) => setPrivacyDisclaimerMarkdown(e.target.value)}
              placeholder="Inserisci il testo dell'informativa in formato Markdown..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:bg-white focus:border-sky-600"
            />
          </div>

          {/* Submit */}
          {isFamilyAdmin && (
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={settingsSaving}
                className="px-6 py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                {settingsSaving ? 'Salvataggio...' : 'Salva Tutte le Impostazioni'}
              </button>
            </div>
          )}

        </form>
      )}

      {/* MODAL: ADD / EDIT PATIENT */}
      {isPatientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-sky-700 to-teal-700 text-white flex items-center justify-between">
              <h3 className="font-bold text-base font-['Outfit']">
                {editingPatient ? 'Modifica Anagrafica Paziente' : 'Nuovo Paziente Assistito'}
              </h3>
              <button
                onClick={() => setIsPatientModalOpen(false)}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePatientSubmit} className="p-6 space-y-4 text-xs text-slate-700">
              {patientError && (
                <div className="p-3 bg-rose-50 text-rose-800 rounded-xl font-semibold">
                  {patientError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-800 mb-1">Nome e Cognome Paziente *</label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Es. Giuseppe Cirillo"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">Data di Nascita</label>
                <input
                  type="date"
                  value={patientBirthDate}
                  onChange={(e) => setPatientBirthDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">Note Cliniche, Allergie, Medico Curante</label>
                <textarea
                  rows={3}
                  value={patientNotes}
                  onChange={(e) => setPatientNotes(e.target.value)}
                  placeholder="Es. Iperteso, allergico alla penicillina. Dott. Rossi tel. 089 123456"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1.5">Caregiver Assegnati</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {members.map(m => (
                    <label key={m.id} className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={assignedCaregivers.includes(m.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignedCaregivers([...assignedCaregivers, m.id]);
                          } else {
                            setAssignedCaregivers(assignedCaregivers.filter(id => id !== m.id));
                          }
                        }}
                        className="rounded text-sky-700"
                      />
                      <span>{m.name} ({m.role === 'familiare' ? 'Familiare' : 'Caregiver'})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPatientModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={patientSaving}
                  className="px-5 py-2 font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-xl shadow-xs"
                >
                  {patientSaving ? 'Salvataggio...' : 'Salva Paziente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SMART WHATSAPP INVITE LINK (ONE-TIME SECURE TOKEN) */}
      {isInviteLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-emerald-700 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Share2 className="w-5 h-5 text-emerald-200" />
                </div>
                <div>
                  <h3 className="font-bold text-base font-['Outfit']">Invita via WhatsApp con Link Sicuro</h3>
                  <p className="text-[11px] text-emerald-100">Registrazione autonoma con password scelta dall'utente (monouso)</p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteLinkModalOpen(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              {inviteError && (
                <div className="p-3 bg-rose-50 text-rose-800 rounded-xl font-semibold">
                  {inviteError}
                </div>
              )}

              {/* Role selection */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1.5">Ruolo da assegnare all'invitato:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteRole('caregiver')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      inviteRole === 'caregiver'
                        ? 'bg-teal-50 border-teal-600 text-teal-950 ring-1 ring-teal-600 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-teal-700" />
                      Caregiver Incaricato
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal mt-1">
                      Visualizza e spunta la somministrazione dei farmaci assegnati.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInviteRole('familiare')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      inviteRole === 'familiare'
                        ? 'bg-sky-50 border-sky-600 text-sky-950 ring-1 ring-sky-600 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-sky-700" />
                      Familiare (Admin)
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal mt-1">
                      Gestisce terapie, pazienti, impostazioni e orari del gruppo.
                    </div>
                  </button>
                </div>
              </div>

              {/* Patient Selection for caregiver */}
              {inviteRole === 'caregiver' && patients.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Pazienti da assegnare a questo caregiver:</label>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    {patients.map(p => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={inviteAssignedPatients.includes(p.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setInviteAssignedPatients([...inviteAssignedPatients, p.id]);
                            } else {
                              setInviteAssignedPatients(inviteAssignedPatients.filter(id => id !== p.id));
                            }
                          }}
                          className="rounded text-teal-700"
                        />
                        <span>{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Recipient Phone (Optional for direct WhatsApp chat opening) */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Numero WhatsApp Destinatario (Opzionale, con prefisso es. +39)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="tel"
                    value={inviteRecipientPhone}
                    onChange={(e) => setInviteRecipientPhone(e.target.value)}
                    placeholder="+39 338 1234567"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 outline-none text-xs"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Se vuoto, WhatsApp ti permetterà di scegliere il contatto al momento dell'invio.
                </span>
              </div>

              {/* Generate button or Generated Link Display */}
              {!generatedInviteUrl ? (
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={inviteGenerating}
                    onClick={handleGenerateInviteToken}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <LinkIcon className="w-4 h-4" />
                    {inviteGenerating ? 'Generazione link monouso...' : 'Genera Link Invito Sicuro'}
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Link Invito Generato (Valido 1 volta)
                    </span>
                    <button
                      type="button"
                      onClick={handleGenerateInviteToken}
                      className="text-[10px] text-emerald-800 underline hover:text-emerald-950"
                    >
                      Rigenera
                    </button>
                  </div>

                  <div className="p-2 bg-white rounded-xl border border-emerald-300 font-mono text-[11px] text-slate-800 break-all select-all">
                    {generatedInviteUrl}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSendWhatsAppInviteLink}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      Invia su WhatsApp
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyInviteLink}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {inviteCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      {inviteCopied ? 'Copiato!' : 'Copia Link'}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInviteLinkModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT MEMBER & CAREGIVER PASSWORD */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="p-5 bg-gradient-to-r from-sky-700 to-teal-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base font-['Outfit']">
                  {editingMember ? `Modifica Profilo / Password: ${editingMember.name}` : 'Nuovo Familiare o Caregiver'}
                </h3>
                <p className="text-[11px] text-sky-100">Imposta contatti WhatsApp, ruolo e password di accesso</p>
              </div>
              <button
                onClick={() => setIsMemberModalOpen(false)}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMemberSubmit} className="p-6 space-y-3.5 text-xs text-slate-700">
              {memberError && (
                <div className="p-3 bg-rose-50 text-rose-800 rounded-xl font-semibold">
                  {memberError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-800 mb-1">Nome e Cognome *</label>
                <input
                  type="text"
                  required
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Es. Chiara Rossi"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Email di Accesso *</label>
                  <input
                    type="email"
                    required
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="email@caregiver.it"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Cellulare (per WhatsApp)</label>
                  <input
                    type="tel"
                    value={memberPhone}
                    onChange={(e) => setMemberPhone(e.target.value)}
                    placeholder="+39 338 1234567"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">Ruolo all'interno della famiglia</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMemberRole('caregiver')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      memberRole === 'caregiver'
                        ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Caregiver (Somministra e spunta)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemberRole('familiare')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      memberRole === 'familiare'
                        ? 'bg-sky-700 text-white border-sky-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Familiare (Gestisce e programma)
                  </button>
                </div>
              </div>

              {/* Password Setting / Reset */}
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl">
                <label className="block font-semibold text-amber-950 mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-700" />
                  {editingMember ? 'Reimposta Password per questo utente' : 'Password Iniziale di Accesso'}
                </label>
                <input
                  type="text"
                  value={memberPassword}
                  onChange={(e) => setMemberPassword(e.target.value)}
                  placeholder={editingMember ? 'Lascia vuoto per non modificare la password' : 'Es. Caregiver2026!'}
                  className="w-full p-2 bg-white border border-amber-300 rounded-xl text-xs font-mono outline-none"
                />
                <span className="text-[10px] text-amber-800 mt-1 block">
                  I familiari possono impostare o reimpostare direttamente la password dei caregiver.
                </span>
              </div>

              {/* Patient assignment */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">Pazienti da Assegnare</label>
                <div className="space-y-1.5 max-h-28 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {patients.map(p => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={memberAssignedPatients.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMemberAssignedPatients([...memberAssignedPatients, p.id]);
                          } else {
                            setMemberAssignedPatients(memberAssignedPatients.filter(id => id !== p.id));
                          }
                        }}
                        className="rounded text-sky-700"
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={memberSaving}
                  className="px-5 py-2 font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-xl shadow-xs"
                >
                  {memberSaving ? 'Salvataggio...' : 'Salva Membro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
