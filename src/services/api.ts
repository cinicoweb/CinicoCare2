import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';
import {
  User,
  Family,
  Patient,
  Therapy,
  DoseLog,
  Invitation,
  BootstrapData,
  AdminOverviewData,
  NotificationSettings
} from '../types';
import { ClientStorageManager } from './clientStorage';
import { formatPhoneNumber, formatCaregiverAlertMessage, buildWhatsAppShareUrl, buildTelegramShareUrl } from '../utils/phone';
import { DEFAULT_PRIVACY_DISCLAIMER_MARKDOWN } from '../utils/privacyDefault';

const TOKEN_KEY = 'cinicocare_token';
const CURRENT_USER_ID_KEY = 'cinicocare_current_user_id';

// SuperAdmin Default Credentials
const SUPERADMIN_EMAIL = 'admin@cinicocare.it';
const SUPERADMIN_PASS = 'Adm10870@!';

function simpleHash(pwd: string): string {
  let hash = 0;
  for (let i = 0; i < pwd.length; i++) {
    const char = pwd.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(16) + '_cnc';
}

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const api = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CURRENT_USER_ID_KEY);
    ClientStorageManager.setCurrentUserId(null);
  },

  getCurrentUserId(): string | null {
    return localStorage.getItem(CURRENT_USER_ID_KEY);
  },

  setCurrentUserId(id: string) {
    localStorage.setItem(CURRENT_USER_ID_KEY, id);
    ClientStorageManager.setCurrentUserId(id);
  },

  async checkEmailExists(email: string): Promise<boolean> {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return false;
    if (cleanEmail === SUPERADMIN_EMAIL) return true;

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const snap = await getDocs(q);
      if (!snap.empty) return true;
    } catch (e) {
      console.warn('Error querying firestore email uniqueness:', e);
    }

    const dbLocal = ClientStorageManager.getDB();
    return dbLocal.users.some(u => u.email.toLowerCase().trim() === cleanEmail);
  },

  // --------------------------------------------------------------------------
  // AUTHENTICATION & USERS
  // --------------------------------------------------------------------------
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const cleanEmail = email.toLowerCase().trim();

    // Check SuperAdmin Master Login
    if (cleanEmail === SUPERADMIN_EMAIL && password === SUPERADMIN_PASS) {
      const superAdminUser: User = {
        id: 'user_superadmin_01',
        email: SUPERADMIN_EMAIL,
        name: 'Amministratore Generale',
        phone: '',
        role: 'superadmin',
        familyId: null,
        assignedPatientIds: [],
        isFamilyAdmin: true,
        gdprAccepted: true,
        gdprAcceptedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z'
      };

      // Save/Ensure SuperAdmin in Firestore
      try {
        await setDoc(doc(db, 'users', superAdminUser.id), {
          ...superAdminUser,
          passwordHash: simpleHash(password)
        }, { merge: true });
      } catch (e) {
        console.warn('Could not sync superadmin doc to firestore:', e);
      }

      const token = 'cnc_tok_' + superAdminUser.id;
      this.setToken(token);
      this.setCurrentUserId(superAdminUser.id);
      return { user: superAdminUser, token };
    }

    try {
      // Query user by email from Firestore
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const snap = await getDocs(q);

      if (snap.empty) {
        // Fallback to client storage
        const local = ClientStorageManager.login(email, password);
        this.setToken(local.token);
        this.setCurrentUserId(local.user.id);
        return local;
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data() as any;

      if (userData.passwordHash && userData.passwordHash !== simpleHash(password)) {
        throw new Error('Password errata');
      }

      const { passwordHash, ...safeUser } = userData;
      const user = safeUser as User;
      const token = 'cnc_tok_' + user.id;

      this.setToken(token);
      this.setCurrentUserId(user.id);

      return { user, token };
    } catch (err: any) {
      if (err.message === 'Password errata') throw err;
      // Fallback
      const local = ClientStorageManager.login(email, password);
      this.setToken(local.token);
      this.setCurrentUserId(local.user.id);
      return local;
    }
  },

  async register(payload: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    familyName?: string;
    gdprAccepted: boolean;
    invitationToken?: string;
  }): Promise<{ user: User; token: string }> {
    const cleanEmail = payload.email.toLowerCase().trim();
    if (!payload.gdprAccepted) {
      throw new Error('È obbligatorio accettare l\'informativa sul trattamento dei dati (GDPR)');
    }

    try {
      // Check existing in Firestore
      const usersRef = collection(db, 'users');
      const existingSnap = await getDocs(query(usersRef, where('email', '==', cleanEmail)));
      if (!existingSnap.empty) {
        throw new Error('Un utente con questa email esiste già');
      }

      const newUserId = 'user_' + Math.random().toString(36).substring(2, 10);
      let assignedFamilyId = '';
      let userRole: 'familiare' | 'caregiver' = 'familiare';
      let isFamilyAdmin = true;
      let assignedPatientIds: string[] = [];

      // Check Invitation
      if (payload.invitationToken) {
        const invSnap = await getDocs(
          query(collection(db, 'invitations'), where('token', '==', payload.invitationToken.toUpperCase().trim()))
        );
        if (!invSnap.empty) {
          const invData = invSnap.docs[0].data() as Invitation;
          if (invData.status === 'pending') {
            assignedFamilyId = invData.familyId;
            userRole = invData.role;
            isFamilyAdmin = invData.role === 'familiare';
            assignedPatientIds = invData.assignedPatientIds || [];
            await updateDoc(doc(db, 'invitations', invSnap.docs[0].id), {
              status: 'accepted',
              acceptedByUserId: newUserId,
              acceptedAt: new Date().toISOString()
            });
          }
        }
      }

      const cleanPhone = payload.phone ? formatPhoneNumber(payload.phone) : '';

      // Create new Family if not using invitation
      if (!assignedFamilyId) {
        const newFamilyId = 'family_' + Math.random().toString(36).substring(2, 10);
        assignedFamilyId = newFamilyId;

        const newFamily: Family = {
          id: newFamilyId,
          name: (payload.familyName && payload.familyName.trim()) || `Famiglia ${payload.name.split(' ')[0]}`,
          code: 'CNC-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
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

        await setDoc(doc(db, 'families', newFamilyId), newFamily);
      }

      const newUser: User = {
        id: newUserId,
        email: cleanEmail,
        name: payload.name.trim(),
        phone: cleanPhone,
        role: userRole,
        familyId: assignedFamilyId,
        assignedPatientIds,
        isFamilyAdmin,
        gdprAccepted: true,
        gdprAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', newUserId), {
        ...newUser,
        passwordHash: simpleHash(payload.password)
      });

      const token = 'cnc_tok_' + newUserId;
      this.setToken(token);
      this.setCurrentUserId(newUserId);

      return { user: newUser, token };
    } catch (err: any) {
      if (err.message === 'Un utente con questa email esiste già') throw err;
      const local = ClientStorageManager.register(payload);
      this.setToken(local.token);
      this.setCurrentUserId(local.user.id);
      return local;
    }
  },

  async logout(): Promise<void> {
    this.clearToken();
  },

  async getMe(): Promise<{ user: User }> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      throw new Error('Nessun utente autenticato');
    }

    try {
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (userSnap.exists()) {
        const { passwordHash, ...user } = userSnap.data() as any;
        return { user: user as User };
      }
    } catch (e) {
      console.warn('Error fetching current user from firestore:', e);
    }

    return ClientStorageManager.getMe();
  },

  async updateProfile(payload: {
    name?: string;
    email?: string;
    phone?: string;
    telegramChatId?: string;
    telegramUsername?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<{ user: User }> {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Non autenticato');

    try {
      const userDocRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        return ClientStorageManager.updateProfile(payload);
      }

      const existingData = userSnap.data() as any;
      const updates: any = {};

      if (payload.name) updates.name = payload.name.trim();
      if (payload.phone !== undefined) updates.phone = payload.phone.trim();
      if (payload.telegramChatId !== undefined) {
        updates.telegramChatId = payload.telegramChatId ? payload.telegramChatId.trim() : null;
        if (payload.telegramChatId && !existingData.telegramConnectedAt) {
          updates.telegramConnectedAt = new Date().toISOString();
        } else if (!payload.telegramChatId) {
          updates.telegramConnectedAt = null;
        }
      }
      if (payload.telegramUsername !== undefined) {
        updates.telegramUsername = payload.telegramUsername ? payload.telegramUsername.trim() : null;
      }
      if (payload.email) updates.email = payload.email.toLowerCase().trim();

      if (payload.newPassword) {
        if (!payload.currentPassword) {
          throw new Error('Inserisci la password attuale per confermare la modifica');
        }
        if (existingData.passwordHash && existingData.passwordHash !== simpleHash(payload.currentPassword)) {
          throw new Error('La password attuale non è corretta');
        }
        updates.passwordHash = simpleHash(payload.newPassword);
      }

      await updateDoc(userDocRef, updates);
      const updatedSnap = await getDoc(userDocRef);
      const { passwordHash, ...safeUser } = updatedSnap.data() as any;
      return { user: safeUser as User };
    } catch (e: any) {
      if (e.message.includes('password')) throw e;
      return ClientStorageManager.updateProfile(payload);
    }
  },

  // --------------------------------------------------------------------------
  // BOOTSTRAP DATA (Real-time Cloud Sync & High-Speed Cache)
  // --------------------------------------------------------------------------
  async getBootstrap(): Promise<BootstrapData> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      return ClientStorageManager.getBootstrap();
    }

    try {
      // 1. Fetch current user
      const userSnap = await getDoc(doc(db, 'users', userId));
      let currentUser: User;

      if (userSnap.exists()) {
        const { passwordHash, ...u } = userSnap.data() as any;
        currentUser = u as User;
      } else {
        const local = ClientStorageManager.getMe();
        currentUser = local.user;
      }

      // If SuperAdmin
      if (currentUser.role === 'superadmin') {
        const [fSnap, pSnap, tSnap, uSnap, dSnap, iSnap] = await Promise.all([
          getDocs(collection(db, 'families')),
          getDocs(collection(db, 'patients')),
          getDocs(collection(db, 'therapies')),
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'doseLogs')),
          getDocs(collection(db, 'invitations'))
        ]);

        const families = fSnap.docs.map(d => d.data() as Family);
        const patients = pSnap.docs.map(d => d.data() as Patient);
        const therapies = tSnap.docs.map(d => d.data() as Therapy);
        const members = uSnap.docs
          .map(d => {
            const { passwordHash, ...u } = d.data() as any;
            return u as User;
          })
          .filter(u => u.role !== 'superadmin');
        const doseLogs = dSnap.docs.map(d => d.data() as DoseLog);
        const invitations = iSnap.docs.map(d => d.data() as Invitation);

        return {
          user: currentUser,
          family: families[0] || null,
          patients,
          therapies,
          members,
          doseLogs,
          invitations
        };
      }

      // Family Isolated Bootstrap
      const familyId = currentUser.familyId;
      if (!familyId) {
        return {
          user: currentUser,
          family: null,
          patients: [],
          therapies: [],
          members: [currentUser],
          doseLogs: [],
          invitations: []
        };
      }

      const [familySnap, patientsSnap, therapiesSnap, membersSnap, doseLogsSnap, invSnap] =
        await Promise.all([
          getDoc(doc(db, 'families', familyId)),
          getDocs(query(collection(db, 'patients'), where('familyId', '==', familyId))),
          getDocs(query(collection(db, 'therapies'), where('familyId', '==', familyId))),
          getDocs(query(collection(db, 'users'), where('familyId', '==', familyId))),
          getDocs(query(collection(db, 'doseLogs'), where('familyId', '==', familyId))),
          getDocs(query(collection(db, 'invitations'), where('familyId', '==', familyId)))
        ]);

      const family = familySnap.exists() ? (familySnap.data() as Family) : null;
      let patients = patientsSnap.docs.map(d => d.data() as Patient);
      let therapies = therapiesSnap.docs.map(d => d.data() as Therapy);
      const members = membersSnap.docs
        .map(d => {
          const { passwordHash, ...u } = d.data() as any;
          return u as User;
        })
        .filter(u => u.role !== 'superadmin');
      let doseLogs = doseLogsSnap.docs.map(d => d.data() as DoseLog);
      const invitations = invSnap.docs.map(d => d.data() as Invitation);

      // STRICT CAREGIVER VISIBILITY:
      // Caregivers (and users who are not family admins) only see their assigned patients and therapies.
      const isCaregiver = currentUser.role === 'caregiver' || !currentUser.isFamilyAdmin;
      if (isCaregiver) {
        const assignedIds = new Set(currentUser.assignedPatientIds || []);
        patients = patients.filter(p => assignedIds.has(p.id));
        therapies = therapies.filter(t => assignedIds.has(t.patientId));
        doseLogs = doseLogs.filter(d => assignedIds.has(d.patientId));
      }

      return {
        user: currentUser,
        family,
        patients,
        therapies,
        members,
        doseLogs,
        invitations
      };
    } catch (e) {
      console.warn('Firestore bootstrap fallback:', e);
      return ClientStorageManager.getBootstrap();
    }
  },

  // Real-time Firestore Listener with debounced batch updating
  subscribeFamilyUpdates(familyId: string, onUpdate: (data: Partial<BootstrapData>) => void): Unsubscribe {
    if (!familyId) return () => {};

    try {
      let pendingUpdates: Partial<BootstrapData> = {};
      let timeoutId: any = null;

      const scheduleFlush = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (Object.keys(pendingUpdates).length > 0) {
            onUpdate({ ...pendingUpdates });
            pendingUpdates = {};
          }
        }, 50);
      };

      const qDoses = query(collection(db, 'doseLogs'), where('familyId', '==', familyId));
      const unsubDoses = onSnapshot(qDoses, { includeMetadataChanges: false }, (snap) => {
        pendingUpdates.doseLogs = snap.docs.map(d => d.data() as DoseLog);
        scheduleFlush();
      });

      const qPatients = query(collection(db, 'patients'), where('familyId', '==', familyId));
      const unsubPatients = onSnapshot(qPatients, { includeMetadataChanges: false }, (snap) => {
        pendingUpdates.patients = snap.docs.map(d => d.data() as Patient);
        scheduleFlush();
      });

      const qTherapies = query(collection(db, 'therapies'), where('familyId', '==', familyId));
      const unsubTherapies = onSnapshot(qTherapies, { includeMetadataChanges: false }, (snap) => {
        pendingUpdates.therapies = snap.docs.map(d => d.data() as Therapy);
        scheduleFlush();
      });

      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        unsubDoses();
        unsubPatients();
        unsubTherapies();
      };
    } catch (e) {
      console.warn('Could not establish real-time snapshot listener:', e);
      return () => {};
    }
  },

  // --------------------------------------------------------------------------
  // FAMILY SETTINGS
  // --------------------------------------------------------------------------
  async updateFamilySettings(
    name?: string,
    notificationSettings?: Partial<NotificationSettings>,
    privacyDisclaimerMarkdown?: string
  ): Promise<{ family: Family }> {
    const userId = this.getCurrentUserId();
    const userSnap = userId ? await getDoc(doc(db, 'users', userId)) : null;
    const familyId = userSnap?.exists() ? (userSnap.data() as User).familyId : null;

    if (familyId) {
      const famRef = doc(db, 'families', familyId);
      const famSnap = await getDoc(famRef);
      if (famSnap.exists()) {
        const currentFam = famSnap.data() as Family;
        const updatedFam: Family = {
          ...currentFam,
          name: name && name.trim() ? name.trim() : currentFam.name,
          privacyDisclaimerMarkdown: privacyDisclaimerMarkdown !== undefined ? privacyDisclaimerMarkdown : (currentFam.privacyDisclaimerMarkdown || DEFAULT_PRIVACY_DISCLAIMER_MARKDOWN),
          notificationSettings: notificationSettings
            ? { ...currentFam.notificationSettings, ...notificationSettings }
            : currentFam.notificationSettings
        };
        await updateDoc(famRef, updatedFam as any);
        return { family: updatedFam };
      }
    }

    return ClientStorageManager.updateFamilySettings(name, notificationSettings, privacyDisclaimerMarkdown);
  },

  // --------------------------------------------------------------------------
  // PATIENTS
  // --------------------------------------------------------------------------
  async savePatient(patient: Partial<Patient>): Promise<{ success: boolean; patient: Patient }> {
    const userId = this.getCurrentUserId();
    const userSnap = userId ? await getDoc(doc(db, 'users', userId)) : null;
    const familyId = userSnap?.exists() ? (userSnap.data() as User).familyId : 'family_default';

    const patientId = patient.id || 'patient_' + Math.random().toString(36).substring(2, 10);
    const fullPatient: Patient = {
      id: patientId,
      familyId: patient.familyId || familyId || 'family_default',
      name: patient.name?.trim() || 'Paziente',
      birthDate: patient.birthDate || '',
      notes: patient.notes || '',
      assignedCaregiverIds: Array.isArray(patient.assignedCaregiverIds) ? patient.assignedCaregiverIds : [],
      createdAt: patient.createdAt || new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'patients', patientId), fullPatient);
      return { success: true, patient: fullPatient };
    } catch (e) {
      console.warn('Save patient firestore error, using client storage:', e);
      return ClientStorageManager.savePatient(patient);
    }
  },

  async deletePatient(id: string): Promise<{ success: boolean }> {
    try {
      await deleteDoc(doc(db, 'patients', id));

      // Cascade delete therapies and logs
      const therapiesSnap = await getDocs(query(collection(db, 'therapies'), where('patientId', '==', id)));
      for (const d of therapiesSnap.docs) {
        await deleteDoc(doc(db, 'therapies', d.id));
      }

      const logsSnap = await getDocs(query(collection(db, 'doseLogs'), where('patientId', '==', id)));
      for (const d of logsSnap.docs) {
        await deleteDoc(doc(db, 'doseLogs', d.id));
      }

      return { success: true };
    } catch (e) {
      return ClientStorageManager.deletePatient(id);
    }
  },

  // --------------------------------------------------------------------------
  // INVITATIONS
  // --------------------------------------------------------------------------
  async createInvitation(payload: {
    role: 'familiare' | 'caregiver';
    name?: string;
    assignedPatientIds?: string[];
  }): Promise<{ invitation: Invitation; inviteUrl: string }> {
    const userId = this.getCurrentUserId();
    const userSnap = userId ? await getDoc(doc(db, 'users', userId)) : null;
    const currentUser = userSnap?.exists() ? (userSnap.data() as User) : null;
    const familyId = currentUser?.familyId || 'family_default';

    const invId = 'inv_' + Math.random().toString(36).substring(2, 10);
    const token = 'CNC-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    const invitation: Invitation = {
      id: invId,
      familyId,
      inviterName: currentUser?.name || 'Famiglia',
      email: '',
      phone: '',
      role: payload.role === 'caregiver' ? 'caregiver' : 'familiare',
      assignedPatientIds: payload.assignedPatientIds || [],
      token,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'invitations', invId), invitation);
    } catch (e) {
      console.warn('Could not write invitation to firestore:', e);
    }

    const origin = window.location.origin;
    const inviteUrl = `${origin}?invite=${token}`;

    return { invitation, inviteUrl };
  },

  // --------------------------------------------------------------------------
  // MEMBERS & CAREGIVERS
  // --------------------------------------------------------------------------
  async createMember(payload: {
    name: string;
    email: string;
    phone?: string;
    role: 'familiare' | 'caregiver';
    password?: string;
    assignedPatientIds?: string[];
  }): Promise<{ member: User; initialPassword?: string }> {
    const userId = this.getCurrentUserId();
    const userSnap = userId ? await getDoc(doc(db, 'users', userId)) : null;
    const currentUser = userSnap?.exists() ? (userSnap.data() as User) : null;
    const familyId = currentUser?.familyId || 'family_default';

    const cleanEmail = payload.email.toLowerCase().trim();
    const emailExists = await this.checkEmailExists(cleanEmail);
    if (emailExists) {
      throw new Error(`Un utente con l'indirizzo email ${cleanEmail} esiste già`);
    }

    const memberId = 'user_' + Math.random().toString(36).substring(2, 10);
    const initialPassword = payload.password || 'Caregiver2026!';
    const formattedPhone = payload.phone ? formatPhoneNumber(payload.phone) : '';

    const newMember: User = {
      id: memberId,
      email: cleanEmail,
      name: payload.name.trim(),
      phone: formattedPhone,
      role: payload.role,
      familyId,
      assignedPatientIds: Array.isArray(payload.assignedPatientIds) ? payload.assignedPatientIds : [],
      isFamilyAdmin: payload.role === 'familiare',
      gdprAccepted: true,
      gdprAcceptedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'users', memberId), {
        ...newMember,
        passwordHash: simpleHash(initialPassword)
      });
      return { member: newMember, initialPassword };
    } catch (e) {
      return ClientStorageManager.createMember(payload);
    }
  },

  async updateMember(
    id: string,
    payload: {
      name?: string;
      email?: string;
      phone?: string;
      role?: 'familiare' | 'caregiver';
      password?: string;
      assignedPatientIds?: string[];
      isFamilyAdmin?: boolean;
    }
  ): Promise<{ member: User }> {
    const formattedPhone = payload.phone !== undefined ? (payload.phone ? formatPhoneNumber(payload.phone) : '') : undefined;
    const cleanEmail = payload.email ? payload.email.toLowerCase().trim() : undefined;

    if (cleanEmail) {
      const emailExists = await this.checkEmailExists(cleanEmail);
      // Ensure it's not the user's current email
      const userDoc = await getDoc(doc(db, 'users', id));
      if (userDoc.exists() && (userDoc.data() as any).email !== cleanEmail && emailExists) {
        throw new Error(`L'email ${cleanEmail} è già utilizzata da un altro account`);
      }
    }

    try {
      const memberRef = doc(db, 'users', id);
      const memberSnap = await getDoc(memberRef);
      if (memberSnap.exists()) {
        const current = memberSnap.data() as any;
        const updates: any = {};
        if (payload.name) updates.name = payload.name.trim();
        if (cleanEmail) updates.email = cleanEmail;
        if (formattedPhone !== undefined) updates.phone = formattedPhone;
        if (payload.role) updates.role = payload.role;
        if (payload.isFamilyAdmin !== undefined) updates.isFamilyAdmin = payload.isFamilyAdmin;
        if (Array.isArray(payload.assignedPatientIds)) updates.assignedPatientIds = payload.assignedPatientIds;
        if (payload.password) updates.passwordHash = simpleHash(payload.password.trim());

        await updateDoc(memberRef, updates);
        const updated = await getDoc(memberRef);
        const { passwordHash, ...user } = updated.data() as any;
        return { member: user as User };
      }
    } catch (e) {}

    return ClientStorageManager.updateMember(id, { ...payload, email: cleanEmail, phone: formattedPhone });
  },

  async deleteMember(id: string): Promise<{ success: boolean }> {
    try {
      await deleteDoc(doc(db, 'users', id));
      return { success: true };
    } catch (e) {
      return ClientStorageManager.deleteMember(id);
    }
  },

  // --------------------------------------------------------------------------
  // THERAPIES
  // --------------------------------------------------------------------------
  async saveTherapy(therapy: Partial<Therapy>): Promise<{ success: boolean; therapy: Therapy }> {
    const userId = this.getCurrentUserId();
    const userSnap = userId ? await getDoc(doc(db, 'users', userId)) : null;
    const familyId = userSnap?.exists() ? (userSnap.data() as User).familyId : 'family_default';

    const therapyId = therapy.id || 'therapy_' + Math.random().toString(36).substring(2, 10);
    const fullTherapy: Therapy = {
      id: therapyId,
      familyId: therapy.familyId || familyId || 'family_default',
      patientId: therapy.patientId || '',
      medicationName: therapy.medicationName?.trim() || 'Farmaco',
      dosage: therapy.dosage !== undefined ? therapy.dosage.trim() : '',
      instructions: therapy.instructions || '',
      timeSlots: Array.isArray(therapy.timeSlots) && therapy.timeSlots.length > 0 ? therapy.timeSlots : ['08:00'],
      daysOfWeek: Array.isArray(therapy.daysOfWeek) && therapy.daysOfWeek.length > 0 ? therapy.daysOfWeek : [0, 1, 2, 3, 4, 5, 6],
      startDate: therapy.startDate || getTodayString(),
      endDate: therapy.endDate || null,
      isActive: therapy.isActive !== undefined ? Boolean(therapy.isActive) : true,
      color: therapy.color || '#0284c7',
      createdAt: therapy.createdAt || new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'therapies', therapyId), fullTherapy);
      return { success: true, therapy: fullTherapy };
    } catch (e) {
      return ClientStorageManager.saveTherapy(therapy);
    }
  },

  async deleteTherapy(id: string): Promise<{ success: boolean }> {
    try {
      await deleteDoc(doc(db, 'therapies', id));
      const logsSnap = await getDocs(query(collection(db, 'doseLogs'), where('therapyId', '==', id)));
      for (const d of logsSnap.docs) {
        await deleteDoc(doc(db, 'doseLogs', d.id));
      }
      return { success: true };
    } catch (e) {
      return ClientStorageManager.deleteTherapy(id);
    }
  },

  // --------------------------------------------------------------------------
  // DOSE TOGGLE (SPUNTA REAL-TIME)
  // --------------------------------------------------------------------------
  async toggleDose(payload: {
    therapyId: string;
    patientId: string;
    scheduledDate: string;
    scheduledTime: string;
    status: 'taken' | 'skipped' | 'pending';
    notes?: string;
  }): Promise<{ doseLog: DoseLog }> {
    const userId = this.getCurrentUserId();
    const userSnap = userId ? await getDoc(doc(db, 'users', userId)) : null;
    const currentUser = userSnap?.exists() ? (userSnap.data() as User) : null;
    const familyId = currentUser?.familyId || 'family_default';

    const doseId = `${payload.therapyId}_${payload.scheduledDate}_${payload.scheduledTime}`;
    const doseRef = doc(db, 'doseLogs', doseId);

    try {
      const existingSnap = await getDoc(doseRef);
      let doseLog: DoseLog;

      if (!existingSnap.exists()) {
        doseLog = {
          id: doseId,
          familyId,
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
        await setDoc(doseRef, doseLog);
      } else {
        const current = existingSnap.data() as DoseLog;
        doseLog = {
          ...current,
          status: payload.status,
          takenAt: payload.status === 'taken' ? new Date().toISOString() : payload.status === 'pending' ? null : current.takenAt,
          takenByUserId: payload.status === 'taken' ? (currentUser?.id || null) : payload.status === 'pending' ? null : current.takenByUserId,
          takenByUserName: payload.status === 'taken' ? (currentUser?.name || 'Utente') : payload.status === 'pending' ? null : current.takenByUserName,
          notes: payload.notes !== undefined ? payload.notes : current.notes
        };
        await updateDoc(doseRef, doseLog as any);
      }

      return { doseLog };
    } catch (e) {
      return ClientStorageManager.toggleDose(payload);
    }
  },

  // --------------------------------------------------------------------------
  // TELEGRAM BOT INTEGRATION (@Guardian32170_bot)
  // --------------------------------------------------------------------------
  getTelegramBotUsername(): string {
    return 'Guardian32170_bot';
  },

  getTelegramDeepLink(userId: string): string {
    if (!userId) return 'https://t.me/Guardian32170_bot';
    return `https://t.me/Guardian32170_bot?start=${userId.trim()}`;
  },

  async checkTelegramStatus(): Promise<{
    connected: boolean;
    chatId: string | null;
    username: string | null;
    connectedAt: string | null;
    botUsername: string;
    deepLink: string;
  }> {
    const token = this.getToken();
    if (token) {
      try {
        const res = await fetch('/api/telegram/check-link', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Backend telegram check failed:', e);
      }
    }

    const currentUserId = this.getCurrentUserId();
    const user = currentUserId ? ClientStorageManager.getDB().users.find(u => u.id === currentUserId) : null;
    return {
      connected: Boolean(user?.telegramChatId),
      chatId: user?.telegramChatId || null,
      username: user?.telegramUsername || null,
      connectedAt: user?.telegramConnectedAt || null,
      botUsername: 'Guardian32170_bot',
      deepLink: this.getTelegramDeepLink(currentUserId || '')
    };
  },

  async syncTelegramUpdates(): Promise<{ processedCount: number; linkedUsers: string[] }> {
    const token = this.getToken();
    if (token) {
      try {
        const res = await fetch('/api/telegram/sync-updates', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Backend telegram sync failed:', e);
      }
    }
    return { processedCount: 0, linkedUsers: [] };
  },

  async unlinkTelegram(userId?: string): Promise<{ success: boolean; message: string }> {
    const token = this.getToken();
    if (token) {
      try {
        const res = await fetch('/api/telegram/unlink', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ userId })
        });
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('Backend unlink failed:', e);
      }
    }

    const targetId = userId || this.getCurrentUserId();
    if (targetId) {
      ClientStorageManager.updateProfile({ telegramChatId: '', telegramUsername: '' });
    }
    return { success: true, message: 'Account Telegram scollegato con successo' };
  },

  async sendTelegramTest(payload: {
    userId?: string;
    chatId?: string;
    text?: string;
  }): Promise<{ success: boolean; message: string; messageId?: number; recipient?: string }> {
    const token = this.getToken();
    if (token) {
      const res = await fetch('/api/telegram/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore invio notifica Telegram');
      return data;
    }

    return {
      success: true,
      message: 'Simulazione locale invio messaggio Telegram a ' + (payload.userId || 'utente corrente')
    };
  },

  // --------------------------------------------------------------------------
  // ADMIN SIMULATION (EMAIL & TELEGRAM NOTIFICATION TO ANY CAREGIVER)
  // --------------------------------------------------------------------------
  async simulateAdminNotification(payload: {
    targetUserId: string;
    type: 'registration_email' | 'therapy_reminder' | 'custom_telegram';
    patientId?: string;
    therapyId?: string;
    customMessage?: string;
  }): Promise<{
    success: boolean;
    type: string;
    recipient: any;
    email?: { subject: string; html: string; text: string };
    telegramMessage?: string;
    telegramDelivery?: any;
    confirmUrl?: string;
    telegramDeepLink?: string;
    message?: string;
  }> {
    const token = this.getToken();
    if (token) {
      const res = await fetch('/api/admin/simulate-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore simulazione notifica');
      return data;
    }

    // Client fallback simulation
    const dbLocal = ClientStorageManager.getDB();
    const targetUser = dbLocal.users.find(u => u.id === payload.targetUserId);
    if (!targetUser) throw new Error('Utente destinatario non trovato');

    const deepLink = this.getTelegramDeepLink(targetUser.id);
    return {
      success: true,
      type: payload.type,
      recipient: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        telegramChatId: targetUser.telegramChatId || null,
        telegramConnected: Boolean(targetUser.telegramChatId)
      },
      email: {
        subject: 'Simulazione Notifica CinicoCare',
        html: `<p>Simulazione per ${targetUser.name}. Link Telegram: <a href="${deepLink}">${deepLink}</a></p>`,
        text: `Simulazione per ${targetUser.name}. Link Telegram: ${deepLink}`
      },
      telegramDeepLink: deepLink,
      message: `Simulazione creata per ${targetUser.name}`
    };
  },

  // --------------------------------------------------------------------------
  // TELEGRAM NUDGES & CAREGIVER NOTIFICATIONS
  // --------------------------------------------------------------------------
  async nudgeDose(payload: {
    therapyId: string;
    patientId: string;
    scheduledDate: string;
    scheduledTime: string;
    targetPhone?: string;
    caregiverName?: string;
    channel?: 'telegram' | 'push' | 'all';
  }): Promise<{
    success: boolean;
    telegramUrl: string;
    messageText: string;
    notificationsSentCount: number;
    recipientsCount: number;
    telegramDeliveryResults?: any[];
  }> {
    const token = this.getToken();
    if (token) {
      try {
        const res = await fetch('/api/doses/nudge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          return {
            success: true,
            telegramUrl: data.telegramLink || this.getTelegramDeepLink(this.getCurrentUserId() || ''),
            messageText: data.messageText,
            notificationsSentCount: data.notificationsSentCount,
            recipientsCount: data.recipientsCount,
            telegramDeliveryResults: data.telegramDeliveryResults
          };
        }
      } catch (e) {
        console.warn('Backend nudge error, fallback to firestore/local:', e);
      }
    }

    const doseId = `${payload.therapyId}_${payload.scheduledDate}_${payload.scheduledTime}`;
    const doseRef = doc(db, 'doseLogs', doseId);

    try {
      const [patientSnap, therapySnap, doseSnap] = await Promise.all([
        getDoc(doc(db, 'patients', payload.patientId)),
        getDoc(doc(db, 'therapies', payload.therapyId)),
        getDoc(doseRef)
      ]);

      const patient = patientSnap.exists() ? (patientSnap.data() as Patient) : null;
      const therapy = therapySnap.exists() ? (therapySnap.data() as Therapy) : null;

      let sentCount = 1;
      if (doseSnap.exists()) {
        const d = doseSnap.data() as DoseLog;
        sentCount = (d.notificationsSentCount || 0) + 1;
        await updateDoc(doseRef, {
          notificationsSentCount: sentCount,
          lastNotifiedAt: new Date().toISOString()
        });
      } else {
        await setDoc(doseRef, {
          id: doseId,
          familyId: therapy?.familyId || 'family_default',
          therapyId: payload.therapyId,
          patientId: payload.patientId,
          scheduledDate: payload.scheduledDate,
          scheduledTime: payload.scheduledTime,
          status: 'pending',
          takenAt: null,
          takenByUserId: null,
          takenByUserName: null,
          notes: null,
          notificationsSentCount: 1,
          lastNotifiedAt: new Date().toISOString()
        });
      }

      const patientName = patient?.name || 'Paziente';
      const medName = therapy?.medicationName || 'Farmaco';
      const dosage = therapy?.dosage || '';
      const instructions = therapy?.instructions || 'Nessuna istruzione particolare';
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const confirmUrl = `${origin}?confirmDose=${doseId}`;

      const messageText = formatCaregiverAlertMessage({
        caregiverName: payload.caregiverName || 'Caregiver',
        patientName,
        medicationName: medName,
        dosage,
        scheduledTime: payload.scheduledTime,
        instructions,
        confirmUrl
      });

      const telegramUrl = buildTelegramShareUrl(messageText);

      return {
        success: true,
        telegramUrl,
        messageText,
        notificationsSentCount: sentCount,
        recipientsCount: 1
      };
    } catch (e) {
      return ClientStorageManager.nudgeDose(payload);
    }
  },

  // --------------------------------------------------------------------------
  // SUPERADMIN OVERVIEW & RESET
  // --------------------------------------------------------------------------
  async getAdminOverview(): Promise<AdminOverviewData> {
    try {
      const [fSnap, pSnap, tSnap, uSnap, dSnap] = await Promise.all([
        getDocs(collection(db, 'families')),
        getDocs(collection(db, 'patients')),
        getDocs(collection(db, 'therapies')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'doseLogs'))
      ]);

      const families = fSnap.docs.map(d => d.data() as Family);
      const patients = pSnap.docs.map(d => d.data() as Patient);
      const therapies = tSnap.docs.map(d => d.data() as Therapy);
      const users = uSnap.docs.map(d => {
        const { passwordHash, ...u } = d.data() as any;
        return u as User;
      });
      const doseLogs = dSnap.docs.map(d => d.data() as DoseLog);

      const familiesWithCounts = families.map(f => ({
        ...f,
        patientsCount: patients.filter(p => p.familyId === f.id).length,
        membersCount: users.filter(u => u.familyId === f.id && u.role !== 'superadmin').length,
        therapiesCount: therapies.filter(t => t.familyId === f.id).length
      }));

      const allUsers = users.map(u => {
        const fam = families.find(f => f.id === u.familyId);
        return {
          ...u,
          familyName: fam?.name || (u.role === 'superadmin' ? 'Sistema Generale' : 'Nessuna')
        };
      });

      return {
        totalFamilies: families.length,
        totalPatients: patients.length,
        totalTherapies: therapies.length,
        totalUsers: users.length,
        totalDoseLogs: doseLogs.length,
        families: familiesWithCounts,
        allUsers,
        recentLogs: doseLogs.slice(-20).reverse()
      };
    } catch (e) {
      return ClientStorageManager.getAdminOverview();
    }
  },

  async resetDatabase(confirmationText: string): Promise<{ success: boolean; message: string }> {
    if (confirmationText !== 'RESET_CINICOCARE_2026') {
      throw new Error('Codice di conferma errato');
    }

    try {
      const collectionsToClear = ['families', 'patients', 'therapies', 'doseLogs', 'invitations'];
      for (const colName of collectionsToClear) {
        const snap = await getDocs(collection(db, colName));
        for (const docItem of snap.docs) {
          await deleteDoc(doc(db, colName, docItem.id));
        }
      }

      // Delete non-superadmin users
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const uDoc of usersSnap.docs) {
        const data = uDoc.data() as User;
        if (data.role !== 'superadmin') {
          await deleteDoc(doc(db, 'users', uDoc.id));
        }
      }
    } catch (e) {
      console.warn('Reset firestore error:', e);
    }

    ClientStorageManager.resetDatabase();
    return { success: true, message: 'Database azzerato con successo' };
  },

  exportBackup(): string {
    return ClientStorageManager.exportFullBackup();
  },

  importBackup(jsonContent: string): { success: boolean; message: string } {
    return ClientStorageManager.importFullBackup(jsonContent);
  }
};
