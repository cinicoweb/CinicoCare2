import { User, Family, Patient, Therapy, DoseLog, Invitation, BootstrapData, AdminOverviewData, NotificationSettings } from '../types';
import { formatPhoneNumber, formatCaregiverAlertMessage, buildWhatsAppShareUrl, buildTelegramShareUrl } from '../utils/phone';
import { DEFAULT_PRIVACY_DISCLAIMER_MARKDOWN } from '../utils/privacyDefault';

const STORAGE_KEY = 'cinicocare_client_db_v1';
const CURRENT_USER_ID_KEY = 'cinicocare_current_user_id';

interface LocalDBSchema {
  users: (User & { passwordHash: string })[];
  families: Family[];
  patients: Patient[];
  therapies: Therapy[];
  doseLogs: DoseLog[];
  invitations: Invitation[];
  pushSubscriptions: any[];
}

function getInitialLocalDB(): LocalDBSchema {
  return {
    users: [
      {
        id: 'user_superadmin_01',
        email: 'admin@cinicocare.it',
        name: 'Amministratore Generale',
        phone: '',
        role: 'superadmin',
        familyId: null,
        assignedPatientIds: [],
        isFamilyAdmin: true,
        gdprAccepted: true,
        gdprAcceptedAt: '2026-01-01T00:00:00.000Z',
        passwordHash: 'Adm10870@!',
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    ],
    families: [],
    patients: [],
    therapies: [],
    doseLogs: [],
    invitations: [],
    pushSubscriptions: []
  };
}

export class ClientStorageManager {
  public static getDB(): LocalDBSchema {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Ensure structure is sound without overwriting user data
        if (!parsed.users || !Array.isArray(parsed.users)) parsed.users = [];
        if (!parsed.families || !Array.isArray(parsed.families)) parsed.families = [];
        if (!parsed.patients || !Array.isArray(parsed.patients)) parsed.patients = [];
        if (!parsed.therapies || !Array.isArray(parsed.therapies)) parsed.therapies = [];
        if (!parsed.doseLogs || !Array.isArray(parsed.doseLogs)) parsed.doseLogs = [];
        if (!parsed.invitations || !Array.isArray(parsed.invitations)) parsed.invitations = [];

        // If admin account doesn't exist yet, insert it (preserve if it already exists!)
        const adminExists = parsed.users.some((u: any) => u.email === 'admin@cinicocare.it');
        if (!adminExists) {
          parsed.users.push(getInitialLocalDB().users[0]);
          ClientStorageManager.saveDB(parsed);
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Error loading localStorage DB:', e);
    }
    const initial = getInitialLocalDB();
    ClientStorageManager.saveDB(initial);
    return initial;
  }

  public static saveDB(db: LocalDBSchema) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      console.error('Error writing to localStorage:', e);
    }
  }

  public static getCurrentUserId(): string | null {
    return localStorage.getItem(CURRENT_USER_ID_KEY);
  }

  public static setCurrentUserId(userId: string | null) {
    if (userId) {
      localStorage.setItem(CURRENT_USER_ID_KEY, userId);
    } else {
      localStorage.removeItem(CURRENT_USER_ID_KEY);
    }
  }

  public static login(email: string, password: string): { user: User; token: string } {
    const db = this.getDB();
    const cleanEmail = email.toLowerCase().trim();
    const user = db.users.find(u => u.email.toLowerCase().trim() === cleanEmail);

    if (!user) {
      throw new Error('Credenziali non valide: utente non trovato');
    }

    if (user.passwordHash !== password) {
      throw new Error('Password errata');
    }

    this.setCurrentUserId(user.id);
    const { passwordHash, ...sanitized } = user;
    return {
      user: sanitized,
      token: `local_token_${user.id}_${Date.now()}`
    };
  }

  public static register(payload: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    familyName?: string;
    gdprAccepted: boolean;
    invitationToken?: string;
  }): { user: User; token: string } {
    if (!payload.email || !payload.password || !payload.name) {
      throw new Error('Compila tutti i campi obbligatori (nome, email, password)');
    }
    if (!payload.gdprAccepted) {
      throw new Error('È obbligatorio accettare l\'informativa sul trattamento dei dati (GDPR)');
    }

    const db = this.getDB();
    const cleanEmail = payload.email.toLowerCase().trim();
    if (db.users.some(u => u.email.toLowerCase().trim() === cleanEmail)) {
      throw new Error('Un utente con questa email esiste già');
    }

    const newUserId = 'user_' + Math.random().toString(36).substring(2, 9);
    let assignedFamilyId = '';
    let userRole: 'familiare' | 'caregiver' = 'familiare';
    let isFamilyAdmin = true;
    let assignedPatientIds: string[] = [];

    if (payload.invitationToken) {
      const inv = db.invitations.find(i => i.token === payload.invitationToken && i.status === 'pending');
      if (!inv) {
        throw new Error('Codice invito non valido o già utilizzato');
      }
      assignedFamilyId = inv.familyId;
      userRole = inv.role;
      isFamilyAdmin = inv.role === 'familiare';
      assignedPatientIds = inv.assignedPatientIds || [];
      inv.status = 'accepted';
      inv.acceptedByUserId = newUserId;
      inv.acceptedAt = new Date().toISOString();
    }

    if (!assignedFamilyId) {
      const newFamilyId = 'family_' + Math.random().toString(36).substring(2, 9);
      assignedFamilyId = newFamilyId;

      const newFamily: Family = {
        id: newFamilyId,
        name: (payload.familyName && payload.familyName.trim()) || `Famiglia ${payload.name.split(' ')[0]}`,
        code: 'CNC-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
        createdAt: new Date().toISOString(),
        createdBy: newUserId,
        privacyDisclaimerMarkdown: DEFAULT_PRIVACY_DISCLAIMER_MARKDOWN,
        notificationSettings: {
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
      };
      db.families.push(newFamily);
    }

    const newUser: User & { passwordHash: string } = {
      id: newUserId,
      email: cleanEmail,
      name: payload.name.trim(),
      phone: payload.phone ? formatPhoneNumber(payload.phone) : '',
      role: userRole,
      familyId: assignedFamilyId,
      assignedPatientIds,
      isFamilyAdmin,
      gdprAccepted: true,
      gdprAcceptedAt: new Date().toISOString(),
      passwordHash: payload.password,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    this.saveDB(db);
    this.setCurrentUserId(newUser.id);

    const { passwordHash, ...sanitized } = newUser;
    return {
      user: sanitized,
      token: `local_token_${newUser.id}_${Date.now()}`
    };
  }

  public static updateProfile(payload: {
    name?: string;
    email?: string;
    phone?: string;
    telegramChatId?: string;
    telegramUsername?: string;
    currentPassword?: string;
    newPassword?: string;
  }): { user: User } {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Non autenticato');
    const db = this.getDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new Error('Utente non trovato');

    if (payload.newPassword) {
      if (payload.currentPassword && user.passwordHash !== payload.currentPassword) {
        throw new Error('La password attuale inserita non è corretta');
      }
      user.passwordHash = payload.newPassword;
    }

    if (payload.name && payload.name.trim()) {
      user.name = payload.name.trim();
    }
    if (payload.phone !== undefined) {
      user.phone = payload.phone.trim();
    }
    if (payload.telegramChatId !== undefined) {
      user.telegramChatId = payload.telegramChatId ? payload.telegramChatId.trim() : undefined;
      if (payload.telegramChatId && !user.telegramConnectedAt) {
        user.telegramConnectedAt = new Date().toISOString();
      } else if (!payload.telegramChatId) {
        user.telegramConnectedAt = undefined;
      }
    }
    if (payload.telegramUsername !== undefined) {
      user.telegramUsername = payload.telegramUsername ? payload.telegramUsername.trim() : undefined;
    }
    if (payload.email && payload.email.trim()) {
      const cleanEmail = payload.email.toLowerCase().trim();
      const existing = db.users.find(u => u.email.toLowerCase().trim() === cleanEmail && u.id !== userId);
      if (existing) {
        throw new Error('Questa email è già utilizzata da un altro account');
      }
      user.email = cleanEmail;
    }

    this.saveDB(db);
    const { passwordHash, ...sanitized } = user;
    return { user: sanitized };
  }

  public static getMe(): { user: User } {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Non autenticato');
    const db = this.getDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new Error('Utente non trovato');
    const { passwordHash, ...sanitized } = user;
    return { user: sanitized };
  }

  public static getBootstrap(): BootstrapData {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Non autenticato');
    const db = this.getDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new Error('Utente non trovato');

    const { passwordHash, ...sanitizedUser } = user;

    if (user.role === 'superadmin') {
      return {
        user: sanitizedUser,
        family: null,
        patients: db.patients,
        therapies: db.therapies,
        doseLogs: db.doseLogs,
        members: db.users.map(({ passwordHash, ...u }) => u),
        invitations: db.invitations
      };
    }

    const family = db.families.find(f => f.id === user.familyId) || null;
    let patients = db.patients.filter(p => p.familyId === user.familyId);
    let therapies = db.therapies.filter(t => t.familyId === user.familyId);
    let doseLogs = db.doseLogs.filter(d => d.familyId === user.familyId);
    const members = db.users
      .filter(u => u.familyId === user.familyId)
      .map(({ passwordHash, ...u }) => u);
    const invitations = db.invitations.filter(i => i.familyId === user.familyId);

    // Strict Caregiver Visibility Filter
    const isCaregiver = user.role === 'caregiver' || !user.isFamilyAdmin;
    if (isCaregiver) {
      const assignedIds = new Set(user.assignedPatientIds || []);
      patients = patients.filter(p => assignedIds.has(p.id));
      therapies = therapies.filter(t => assignedIds.has(t.patientId));
      doseLogs = doseLogs.filter(d => assignedIds.has(d.patientId));
    }

    return {
      user: sanitizedUser,
      family,
      patients,
      therapies,
      doseLogs,
      members,
      invitations
    };
  }

  public static updateFamilySettings(
    name?: string,
    notificationSettings?: Partial<NotificationSettings>,
    privacyDisclaimerMarkdown?: string
  ): { family: Family } {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Non autenticato');
    const db = this.getDB();
    const user = db.users.find(u => u.id === userId);
    if (!user || !user.familyId) throw new Error('Gruppo famiglia non trovato');

    const family = db.families.find(f => f.id === user.familyId);
    if (!family) throw new Error('Famiglia non trovata');

    if (name && name.trim()) {
      family.name = name.trim();
    }
    if (privacyDisclaimerMarkdown !== undefined) {
      family.privacyDisclaimerMarkdown = privacyDisclaimerMarkdown;
    }
    if (notificationSettings) {
      family.notificationSettings = {
        ...family.notificationSettings,
        ...notificationSettings
      };
    }

    this.saveDB(db);
    return { family };
  }

  public static savePatient(patient: Partial<Patient>): { success: boolean; patient: Patient } {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Non autenticato');
    const db = this.getDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new Error('Utente non trovato');

    const targetFamilyId = user.familyId || db.families[0]?.id || 'family_default';

    if (patient.id) {
      const idx = db.patients.findIndex(p => p.id === patient.id);
      if (idx >= 0) {
        db.patients[idx] = {
          ...db.patients[idx],
          name: patient.name || db.patients[idx].name,
          birthDate: patient.birthDate !== undefined ? patient.birthDate : db.patients[idx].birthDate,
          notes: patient.notes !== undefined ? patient.notes : db.patients[idx].notes,
          assignedCaregiverIds: patient.assignedCaregiverIds || db.patients[idx].assignedCaregiverIds
        };
        this.saveDB(db);
        return { success: true, patient: db.patients[idx] };
      }
    }

    const newPatient: Patient = {
      id: 'patient_' + Math.random().toString(36).substring(2, 9),
      familyId: targetFamilyId,
      name: patient.name || 'Nuovo Paziente',
      birthDate: patient.birthDate || '',
      notes: patient.notes || '',
      assignedCaregiverIds: patient.assignedCaregiverIds || [user.id],
      createdAt: new Date().toISOString()
    };

    db.patients.push(newPatient);
    this.saveDB(db);
    return { success: true, patient: newPatient };
  }

  public static deletePatient(id: string): { success: boolean } {
    const db = this.getDB();
    db.patients = db.patients.filter(p => p.id !== id);
    db.therapies = db.therapies.filter(t => t.patientId !== id);
    db.doseLogs = db.doseLogs.filter(d => d.patientId !== id);
    this.saveDB(db);
    return { success: true };
  }

  public static createInvitation(payload: {
    role: 'familiare' | 'caregiver';
    name?: string;
    assignedPatientIds?: string[];
  }): { invitation: Invitation; inviteUrl: string } {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Non autenticato');
    const db = this.getDB();
    const user = db.users.find(u => u.id === userId);
    if (!user || !user.familyId) throw new Error('Gruppo famiglia non trovato');

    const token = 'inv_' + Math.random().toString(36).substring(2, 12);
    const newInv: Invitation = {
      id: 'invitation_' + Date.now(),
      familyId: user.familyId,
      inviterName: user.name || 'Familiare',
      email: '',
      role: payload.role,
      token,
      assignedPatientIds: payload.assignedPatientIds || [],
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    };

    db.invitations.push(newInv);
    this.saveDB(db);

    const baseUrl = window.location.origin + window.location.pathname;
    const inviteUrl = `${baseUrl.replace(/\/$/, '')}?invite=${token}`;
    return { invitation: newInv, inviteUrl };
  }

  public static createMember(payload: {
    name: string;
    email: string;
    phone?: string;
    role: 'familiare' | 'caregiver';
    password?: string;
    assignedPatientIds?: string[];
  }): { member: User; initialPassword?: string } {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Non autenticato');
    const db = this.getDB();
    const currentUser = db.users.find(u => u.id === userId);
    if (!currentUser || !currentUser.familyId) throw new Error('Gruppo famiglia non trovato');

    const cleanEmail = payload.email.toLowerCase().trim();
    if (db.users.some(u => u.email.toLowerCase().trim() === cleanEmail)) {
      throw new Error('Un utente con questa email esiste già');
    }

    const generatedPass = payload.password || 'Care2026!' + Math.floor(100 + Math.random() * 900);
    const newMemberId = 'user_' + Math.random().toString(36).substring(2, 9);

    const newMember: User & { passwordHash: string } = {
      id: newMemberId,
      email: cleanEmail,
      name: payload.name.trim(),
      phone: payload.phone?.trim() || '',
      role: payload.role,
      familyId: currentUser.familyId,
      assignedPatientIds: payload.assignedPatientIds || [],
      isFamilyAdmin: false,
      gdprAccepted: true,
      gdprAcceptedAt: new Date().toISOString(),
      passwordHash: generatedPass,
      createdAt: new Date().toISOString()
    };

    db.users.push(newMember);
    this.saveDB(db);

    const { passwordHash, ...sanitized } = newMember;
    return { member: sanitized, initialPassword: generatedPass };
  }

  public static updateMember(id: string, payload: {
    name?: string;
    email?: string;
    phone?: string;
    role?: 'familiare' | 'caregiver';
    password?: string;
    assignedPatientIds?: string[];
    isFamilyAdmin?: boolean;
  }): { member: User } {
    const db = this.getDB();
    const idx = db.users.findIndex(u => u.id === id);
    if (idx < 0) throw new Error('Membro non trovato');

    if (payload.name) db.users[idx].name = payload.name.trim();
    if (payload.email && payload.email.trim()) {
      const cleanEmail = payload.email.toLowerCase().trim();
      const existing = db.users.find(u => u.email.toLowerCase().trim() === cleanEmail && u.id !== id);
      if (existing) {
        throw new Error(`L'email ${cleanEmail} è già associata ad un altro utente`);
      }
      db.users[idx].email = cleanEmail;
    }
    if (payload.phone !== undefined) db.users[idx].phone = payload.phone.trim();
    if (payload.role) db.users[idx].role = payload.role;
    if (payload.assignedPatientIds) db.users[idx].assignedPatientIds = payload.assignedPatientIds;
    if (payload.isFamilyAdmin !== undefined) db.users[idx].isFamilyAdmin = payload.isFamilyAdmin;
    if (payload.password) db.users[idx].passwordHash = payload.password;

    this.saveDB(db);
    const { passwordHash, ...sanitized } = db.users[idx];
    return { member: sanitized };
  }

  public static deleteMember(id: string): { success: boolean } {
    const db = this.getDB();
    db.users = db.users.filter(u => u.id !== id);
    this.saveDB(db);
    return { success: true };
  }

  public static saveTherapy(therapy: Partial<Therapy>): { success: boolean; therapy: Therapy } {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Non autenticato');
    const db = this.getDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new Error('Utente non trovato');

    const targetFamilyId = user.familyId || db.families[0]?.id || 'family_default';

    if (therapy.id) {
      const idx = db.therapies.findIndex(t => t.id === therapy.id);
      if (idx >= 0) {
        db.therapies[idx] = {
          ...db.therapies[idx],
          patientId: therapy.patientId || db.therapies[idx].patientId,
          medicationName: therapy.medicationName || db.therapies[idx].medicationName,
          dosage: therapy.dosage || db.therapies[idx].dosage,
          instructions: therapy.instructions !== undefined ? therapy.instructions : db.therapies[idx].instructions,
          timeSlots: therapy.timeSlots || db.therapies[idx].timeSlots,
          daysOfWeek: therapy.daysOfWeek || db.therapies[idx].daysOfWeek,
          startDate: therapy.startDate || db.therapies[idx].startDate,
          endDate: therapy.endDate !== undefined ? therapy.endDate : db.therapies[idx].endDate,
          isActive: therapy.isActive !== undefined ? therapy.isActive : db.therapies[idx].isActive,
          color: therapy.color || db.therapies[idx].color
        };
        this.saveDB(db);
        return { success: true, therapy: db.therapies[idx] };
      }
    }

    const colors = ['#0284c7', '#0d9488', '#e11d48', '#7c3aed', '#ea580c', '#059669', '#d97706'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newTherapy: Therapy = {
      id: 'therapy_' + Math.random().toString(36).substring(2, 9),
      familyId: targetFamilyId,
      patientId: therapy.patientId || '',
      medicationName: therapy.medicationName || 'Farmaco',
      dosage: therapy.dosage !== undefined ? therapy.dosage.trim() : '',
      instructions: therapy.instructions || '',
      timeSlots: therapy.timeSlots && therapy.timeSlots.length > 0 ? therapy.timeSlots : ['08:00'],
      daysOfWeek: therapy.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
      startDate: therapy.startDate || new Date().toISOString().split('T')[0],
      endDate: therapy.endDate || null,
      isActive: therapy.isActive !== undefined ? therapy.isActive : true,
      color: therapy.color || randomColor,
      createdAt: new Date().toISOString()
    };

    db.therapies.push(newTherapy);
    this.saveDB(db);
    return { success: true, therapy: newTherapy };
  }

  public static deleteTherapy(id: string): { success: boolean } {
    const db = this.getDB();
    db.therapies = db.therapies.filter(t => t.id !== id);
    db.doseLogs = db.doseLogs.filter(d => d.therapyId !== id);
    this.saveDB(db);
    return { success: true };
  }

  public static toggleDose(payload: {
    therapyId: string;
    patientId: string;
    scheduledDate: string;
    scheduledTime: string;
    status: 'taken' | 'skipped' | 'pending';
    notes?: string;
  }): { doseLog: DoseLog } {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Non autenticato');
    const db = this.getDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new Error('Utente non trovato');

    const logId = `${payload.therapyId}_${payload.scheduledDate}_${payload.scheduledTime}`;
    let existing = db.doseLogs.find(l => l.id === logId);

    if (existing) {
      existing.status = payload.status;
      existing.notes = payload.notes !== undefined ? payload.notes : existing.notes;
      if (payload.status === 'taken') {
        existing.takenAt = new Date().toISOString();
        existing.takenByUserId = user.id;
        existing.takenByUserName = user.name;
      } else if (payload.status === 'pending') {
        existing.takenAt = undefined;
        existing.takenByUserId = undefined;
        existing.takenByUserName = undefined;
      }
    } else {
      existing = {
        id: logId,
        familyId: user.familyId || '',
        therapyId: payload.therapyId,
        patientId: payload.patientId,
        scheduledDate: payload.scheduledDate,
        scheduledTime: payload.scheduledTime,
        status: payload.status,
        takenAt: payload.status === 'taken' ? new Date().toISOString() : undefined,
        takenByUserId: payload.status === 'taken' ? user.id : undefined,
        takenByUserName: payload.status === 'taken' ? user.name : undefined,
        notes: payload.notes || '',
        notificationsSentCount: 0
      };
      db.doseLogs.push(existing);
    }

    this.saveDB(db);
    return { doseLog: existing };
  }

  public static nudgeDose(payload: {
    therapyId: string;
    patientId: string;
    scheduledDate: string;
    scheduledTime: string;
    targetPhone?: string;
    caregiverName?: string;
    channel?: 'whatsapp' | 'telegram' | 'push' | 'all';
  }): {
    success: boolean;
    whatsappUrl: string;
    telegramUrl: string;
    messageText: string;
    notificationsSentCount: number;
    recipientsCount: number;
  } {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Non autenticato');
    const db = this.getDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new Error('Utente non trovato');

    const therapy = db.therapies.find(t => t.id === payload.therapyId);
    const patient = db.patients.find(p => p.id === payload.patientId);

    const logId = `${payload.therapyId}_${payload.scheduledDate}_${payload.scheduledTime}`;
    let doseLog = db.doseLogs.find(l => l.id === logId);

    if (!doseLog) {
      doseLog = {
        id: logId,
        familyId: user.familyId || '',
        therapyId: payload.therapyId,
        patientId: payload.patientId,
        scheduledDate: payload.scheduledDate,
        scheduledTime: payload.scheduledTime,
        status: 'pending',
        notificationsSentCount: 1,
        lastNotifiedAt: new Date().toISOString()
      };
      db.doseLogs.push(doseLog);
    } else {
      doseLog.notificationsSentCount = (doseLog.notificationsSentCount || 0) + 1;
      doseLog.lastNotifiedAt = new Date().toISOString();
    }

    this.saveDB(db);

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const confirmUrl = `${origin}?confirmDose=${logId}`;
    const messageText = formatCaregiverAlertMessage({
      caregiverName: payload.caregiverName || 'Caregiver',
      patientName: patient?.name || 'Paziente',
      medicationName: therapy?.medicationName || 'Farmaco',
      dosage: therapy?.dosage || '',
      scheduledTime: payload.scheduledTime,
      instructions: therapy?.instructions || '',
      confirmUrl
    });

    const cleanPhone = payload.targetPhone ? formatPhoneNumber(payload.targetPhone) : '';
    const whatsappUrl = buildWhatsAppShareUrl(cleanPhone, messageText);
    const telegramUrl = buildTelegramShareUrl(messageText);

    return {
      success: true,
      whatsappUrl,
      telegramUrl,
      messageText,
      notificationsSentCount: doseLog.notificationsSentCount || 1,
      recipientsCount: cleanPhone ? 1 : 0
    };
  }

  public static getAdminOverview(): AdminOverviewData {
    const db = this.getDB();
    const familiesWithCounts = db.families.map(f => ({
      ...f,
      patientsCount: db.patients.filter(p => p.familyId === f.id).length,
      membersCount: db.users.filter(u => u.familyId === f.id && u.role !== 'superadmin').length,
      therapiesCount: db.therapies.filter(t => t.familyId === f.id).length
    }));

    const allUsers = db.users.map(u => {
      const family = db.families.find(f => f.id === u.familyId);
      const { passwordHash, ...sanitized } = u;
      return {
        ...sanitized,
        familyName: family?.name || (u.role === 'superadmin' ? 'Sistema Generale' : 'Nessuna')
      };
    });

    return {
      totalFamilies: db.families.length,
      totalPatients: db.patients.length,
      totalTherapies: db.therapies.length,
      totalUsers: db.users.length,
      totalDoseLogs: db.doseLogs.length,
      families: familiesWithCounts,
      allUsers,
      recentLogs: db.doseLogs.slice(-20).reverse()
    };
  }

  public static exportFullBackup(): string {
    const db = this.getDB();
    return JSON.stringify(db, null, 2);
  }

  public static importFullBackup(jsonContent: string): { success: boolean; message: string } {
    try {
      const parsed = JSON.parse(jsonContent);
      if (!parsed.users || !Array.isArray(parsed.users)) {
        throw new Error('Formato backup non valido: manca array utenti');
      }
      this.saveDB(parsed);
      return { success: true, message: 'Dati ripristinati con successo!' };
    } catch (e: any) {
      throw new Error('Errore durante il ripristino del backup: ' + (e.message || 'file non valido'));
    }
  }

  public static resetDatabase(): { success: boolean; message: string } {
    const initial = getInitialLocalDB();
    this.saveDB(initial);
    return {
      success: true,
      message: 'Database locale ripristinato con successo.'
    };
  }
}
