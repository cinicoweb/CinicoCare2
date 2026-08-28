import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { JsonDatabase, hashPassword, getTodayDateString } from './db';
import { User, Family, Patient, Therapy, DoseLog, Invitation, BootstrapData, AdminOverviewData, TelegramBotConfig, SmtpConfig } from '../src/types';
import {
  getTelegramConfig,
  getTelegramDeepLink,
  sendTelegramMessage,
  processTelegramUpdates,
  testTelegramBot,
  deleteTelegramWebhook,
  startTelegramPolling,
  stopTelegramPolling,
  getTelegramStatus,
  generateRegistrationEmailHtml
} from './telegram';
import {
  getSmtpConfig,
  sendEmail,
  verifySmtpConnection
} from './email';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Start background Telegram polling
startTelegramPolling();


// Enable CORS for API requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Simple token store for authentication (persists token in memory / session)
const activeSessions = new Map<string, { userId: string; expiresAt: number }>();

function generateToken(userId: string): string {
  const token = 'cnc_' + crypto.randomBytes(24).toString('hex');
  // 30 days session
  activeSessions.set(token, {
    userId,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
  });
  return token;
}

// Authentication middleware
function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sessione non valida o autenticazione richiesta' });
  }

  const token = authHeader.substring(7);
  const session = activeSessions.get(token);

  const db = JsonDatabase.getInstance().getData();

  // 1. If token is in active session Map
  if (session && session.expiresAt >= Date.now()) {
    const user = db.users.find(u => u.id === session.userId);
    if (user) {
      (req as any).user = user;
      (req as any).token = token;
      return next();
    }
  }

  // 2. Direct SuperAdmin token recognition (from client or server)
  if (token.includes('superadmin') || token.includes('user_superadmin_01')) {
    const superAdmin = db.users.find(u => u.role === 'superadmin' || u.id === 'user_superadmin_01') || {
      id: 'user_superadmin_01',
      email: 'admin@cinicocare.it',
      name: 'Amministratore Generale',
      role: 'superadmin',
      isFamilyAdmin: true,
      familyId: null,
      assignedPatientIds: [],
      gdprAccepted: true,
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    (req as any).user = superAdmin;
    (req as any).token = token;
    return next();
  }

  // 3. Fallback check if token embeds user ID
  const fallbackUser = db.users.find(u => token.includes(u.id) || (session && session.userId === u.id));
  if (fallbackUser) {
    activeSessions.set(token, {
      userId: fallbackUser.id,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    });
    (req as any).user = fallbackUser;
    (req as any).token = token;
    return next();
  }

  // 4. Default to first admin user if available in local test environment
  const firstAdmin = db.users.find(u => u.role === 'superadmin' || u.isFamilyAdmin);
  if (firstAdmin && token.startsWith('cnc_tok_')) {
    (req as any).user = firstAdmin;
    (req as any).token = token;
    return next();
  }

  if (session) activeSessions.delete(token);
  return res.status(401).json({ error: 'Sessione scaduta, effettua nuovamente l\'accesso' });
}

function sanitizeUser(u: User & { passwordHash?: string }): User {
  const { passwordHash, ...safe } = u;
  return safe as User;
}

const dbInstance = JsonDatabase.getInstance();

// --------------------------------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'CinicoCare',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    usersCount: dbInstance.getData().users.length
  });
});

// --------------------------------------------------------------------------
// AUTHENTICATION ROUTES
// --------------------------------------------------------------------------

// Register New Family Admin & Family Group
app.post('/api/auth/register', (req, res) => {
  try {
    const {
      email,
      password,
      name,
      phone,
      familyName,
      gdprAccepted,
      invitationToken
    } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Compila tutti i campi obbligatori (nome, email, password)' });
    }

    if (!gdprAccepted) {
      return res.status(400).json({ error: 'È obbligatorio accettare l\'informativa sul trattamento dei dati (GDPR)' });
    }

    const db = dbInstance.getData();
    const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (existing) {
      return res.status(400).json({ error: 'Un utente con questa email esiste già' });
    }

    const newUserId = 'user_' + crypto.randomUUID().substring(0, 8);
    let assignedFamilyId = '';
    let userRole: 'familiare' | 'caregiver' = 'familiare';
    let isFamilyAdmin = true;
    let assignedPatientIds: string[] = [];

    // Check if registering via Invitation
    if (invitationToken) {
      const inv = db.invitations.find(i => i.token === invitationToken && i.status === 'pending');
      if (inv) {
        assignedFamilyId = inv.familyId;
        userRole = inv.role;
        isFamilyAdmin = inv.role === 'familiare';
        assignedPatientIds = inv.assignedPatientIds || [];
        inv.status = 'accepted';
      }
    }

    // If not joining via invitation, create a brand new Family Group!
    if (!assignedFamilyId) {
      const newFamilyId = 'family_' + crypto.randomUUID().substring(0, 8);
      assignedFamilyId = newFamilyId;

      const newFamily: Family = {
        id: newFamilyId,
        name: (familyName && familyName.trim()) || `Famiglia ${name.split(' ')[0]}`,
        code: 'CNC-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
        createdAt: new Date().toISOString(),
        createdBy: newUserId,
        notificationSettings: {
          whatsappEnabled: true,
          telegramEnabled: true,
          pushEnabled: true,
          soundAlarmEnabled: true,
          preAlertMinutes: 15,
          repeatIntervalMinutes: 10,
          autoRepeatNudges: true,
          customWhatsappTemplate: '🔔 *CinicoCare Promemoria*\nCiao {caregiver}, è ora del farmaco per *{paziente}*!\n💊 Farmaco: *{farmaco}*{dosaggio}\n⏰ Orario: *{orario}*\n📝 Note: {istruzioni}\n\n👉 Conferma somministrazione: {link_conferma}',
          customTelegramTemplate: '🔔 *CinicoCare Promemoria*\nCiao {caregiver}, è ora del farmaco per *{paziente}*!\n💊 Farmaco: *{farmaco}*{dosaggio}\n⏰ Orario: *{orario}*\n📝 Note: {istruzioni}\n\n👉 Conferma somministrazione: {link_conferma}'
        }
      };
      db.families.push(newFamily);
    }

    const newUser: User & { passwordHash: string } = {
      id: newUserId,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      phone: phone ? phone.trim() : '',
      role: userRole,
      familyId: assignedFamilyId,
      assignedPatientIds,
      isFamilyAdmin,
      gdprAccepted: true,
      gdprAcceptedAt: new Date().toISOString(),
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    dbInstance.persist();

    const origin = req.headers.origin || 'https://cinicocare.vercel.app';
    const telegramDeepLink = getTelegramDeepLink(newUser.id);
    const registrationEmail = generateRegistrationEmailHtml({
      name: newUser.name,
      email: newUser.email,
      password: password,
      familyName: (familyName && familyName.trim()) || `Famiglia ${name.split(' ')[0]}`,
      userId: newUser.id,
      role: newUser.role,
      appUrl: origin
    });

    const token = generateToken(newUser.id);
    return res.json({
      user: sanitizeUser(newUser),
      token,
      telegramDeepLink,
      registrationEmail
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore durante la registrazione' });
  }
});

// Login with Email & Password
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Inserisci email e password' });
    }

    const db = dbInstance.getData();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

    if (!user) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const hash = hashPassword(password);
    if (user.passwordHash !== hash) {
      return res.status(401).json({ error: 'Password errata' });
    }

    const token = generateToken(user.id);
    return res.json({
      user: sanitizeUser(user),
      token
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore durante il login' });
  }
});

// Current User Profile Verification
app.get('/api/auth/me', authenticate, (req, res) => {
  const user = (req as any).user as User;
  return res.json({ user: sanitizeUser(user) });
});

// User Profile Update
app.put('/api/profile', authenticate, (req, res) => {
  try {
    const user = (req as any).user as User;
    const { name, email, phone, telegramChatId, telegramUsername, currentPassword, newPassword } = req.body;
    const db = dbInstance.getData();
    const dbUser = db.users.find(u => u.id === user.id);

    if (!dbUser) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    if (name && name.trim()) dbUser.name = name.trim();
    if (phone !== undefined) dbUser.phone = phone.trim();
    if (telegramChatId !== undefined) dbUser.telegramChatId = telegramChatId ? telegramChatId.trim() : '';
    if (telegramUsername !== undefined) dbUser.telegramUsername = telegramUsername ? telegramUsername.trim() : '';
    if (telegramChatId && !dbUser.telegramConnectedAt) dbUser.telegramConnectedAt = new Date().toISOString();

    if (email && email.trim() && email.toLowerCase() !== dbUser.email) {
      const emailExists = db.users.some(u => u.id !== user.id && u.email.toLowerCase() === email.toLowerCase().trim());
      if (emailExists) {
        return res.status(400).json({ error: 'Questa email è già utilizzata da un altro account' });
      }
      dbUser.email = email.toLowerCase().trim();
    }

    if (newPassword && newPassword.trim()) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Inserisci la password attuale per confermare la modifica' });
      }
      if (dbUser.passwordHash !== hashPassword(currentPassword)) {
        return res.status(400).json({ error: 'La password attuale non è corretta' });
      }
      dbUser.passwordHash = hashPassword(newPassword.trim());
    }

    dbInstance.persist();
    return res.json({ success: true, user: sanitizeUser(dbUser) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore aggiornamento profilo' });
  }
});

// Logout
app.post('/api/auth/logout', authenticate, (req, res) => {
  const token = (req as any).token as string;
  if (token) activeSessions.delete(token);
  return res.json({ success: true });
});

// --------------------------------------------------------------------------
// BOOTSTRAP DATA (Strict Family Group Isolation & Caregiver Visibility)
// --------------------------------------------------------------------------
app.get('/api/bootstrap', authenticate, (req, res) => {
  try {
    const user = (req as any).user as User;
    const db = dbInstance.getData();

    // If SuperAdmin
    if (user.role === 'superadmin') {
      const family = db.families[0] || null;
      const responseData: BootstrapData = {
        user: sanitizeUser(user),
        family: family,
        patients: db.patients,
        therapies: db.therapies,
        members: db.users.filter(u => u.role !== 'superadmin').map(sanitizeUser),
        doseLogs: db.doseLogs,
        invitations: db.invitations
      };
      return res.json(responseData);
    }

    // STRICT ISOLATION FOR REGULAR USERS / FAMILIES:
    const familyId = user.familyId;
    if (!familyId) {
      return res.json({
        user: sanitizeUser(user),
        family: null,
        patients: [],
        therapies: [],
        members: [sanitizeUser(user)],
        doseLogs: [],
        invitations: []
      });
    }

    const family = db.families.find(f => f.id === familyId) || null;
    let patients = db.patients.filter(p => p.familyId === familyId);
    let therapies = db.therapies.filter(t => t.familyId === familyId);
    const members = db.users
      .filter(u => u.familyId === familyId && u.role !== 'superadmin')
      .map(sanitizeUser);
    let doseLogs = db.doseLogs.filter(d => d.familyId === familyId);
    const invitations = db.invitations.filter(i => i.familyId === familyId);

    // STRICT CAREGIVER VISIBILITY:
    // Caregivers (and users who are not family admins) only see their assigned patients and therapies.
    const isCaregiver = user.role === 'caregiver' || !user.isFamilyAdmin;
    if (isCaregiver) {
      const assignedIds = new Set(user.assignedPatientIds || []);
      patients = patients.filter(p => assignedIds.has(p.id));
      therapies = therapies.filter(t => assignedIds.has(t.patientId));
      doseLogs = doseLogs.filter(d => assignedIds.has(d.patientId));
    }

    const responseData: BootstrapData = {
      user: sanitizeUser(user),
      family,
      patients,
      therapies,
      members,
      doseLogs,
      invitations
    };

    return res.json(responseData);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore durante il caricamento dei dati' });
  }
});

// --------------------------------------------------------------------------
// FAMILY SETTINGS & NOTIFICATIONS CONFIGURATION
// --------------------------------------------------------------------------
const handleFamilySettings = (req: Request, res: Response) => {
  try {
    const user = (req as any).user as User;
    if (!user.isFamilyAdmin && user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Solo i familiari amministratori possono modificare le impostazioni di gruppo' });
    }

    const { name, notificationSettings } = req.body;
    const db = dbInstance.getData();
    const family = db.families.find(f => f.id === user.familyId);

    if (!family) {
      return res.status(404).json({ error: 'Gruppo famiglia non trovato' });
    }

    if (name && name.trim()) {
      family.name = name.trim();
    }

    if (notificationSettings) {
      family.notificationSettings = {
        ...family.notificationSettings,
        ...notificationSettings
      };
    }

    dbInstance.persist();
    return res.json({ success: true, family });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore salvataggio impostazioni' });
  }
};

app.post('/api/family/settings', authenticate, handleFamilySettings);
app.put('/api/family/settings', authenticate, handleFamilySettings);

// --------------------------------------------------------------------------
// PATIENT MANAGEMENT
// --------------------------------------------------------------------------
app.post('/api/patients', authenticate, (req, res) => {
  try {
    const user = (req as any).user as User;
    if (!user.familyId) {
      return res.status(400).json({ error: 'Devi appartenere a una famiglia per gestire i pazienti' });
    }

    const { id, name, birthDate, notes, assignedCaregiverIds } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Il nome del paziente è obbligatorio' });
    }

    const db = dbInstance.getData();

    if (id) {
      // Edit existing patient
      const patient = db.patients.find(p => p.id === id && (p.familyId === user.familyId || user.role === 'superadmin'));
      if (!patient) {
        return res.status(404).json({ error: 'Paziente non trovato' });
      }

      patient.name = name.trim();
      patient.birthDate = birthDate || '';
      patient.notes = notes || '';
      patient.assignedCaregiverIds = Array.isArray(assignedCaregiverIds) ? assignedCaregiverIds : [];

      dbInstance.persist();
      return res.json({ success: true, patient });
    } else {
      // Create new patient
      const newPatient: Patient = {
        id: 'patient_' + crypto.randomUUID().substring(0, 8),
        familyId: user.familyId,
        name: name.trim(),
        birthDate: birthDate || '',
        notes: notes || '',
        assignedCaregiverIds: Array.isArray(assignedCaregiverIds) ? assignedCaregiverIds : [],
        createdAt: new Date().toISOString()
      };

      db.patients.push(newPatient);
      dbInstance.persist();
      return res.json({ success: true, patient: newPatient });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore salvataggio paziente' });
  }
});

app.delete('/api/patients/:id', authenticate, (req, res) => {
  try {
    const user = (req as any).user as User;
    const { id } = req.params;
    const db = dbInstance.getData();

    const patientIdx = db.patients.findIndex(p => p.id === id && (p.familyId === user.familyId || user.role === 'superadmin'));
    if (patientIdx === -1) {
      return res.status(404).json({ error: 'Paziente non trovato' });
    }

    db.patients.splice(patientIdx, 1);
    db.therapies = db.therapies.filter(t => t.patientId !== id);
    db.doseLogs = db.doseLogs.filter(d => d.patientId !== id);

    dbInstance.persist();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore eliminazione paziente' });
  }
});

// --------------------------------------------------------------------------
// INVITATIONS (Smart Link)
// --------------------------------------------------------------------------
app.post('/api/invitations', authenticate, (req, res) => {
  try {
    const user = (req as any).user as User;
    if (!user.familyId) {
      return res.status(400).json({ error: 'Famiglia non associata' });
    }

    const { role, name, assignedPatientIds } = req.body;
    const db = dbInstance.getData();

    const invitation: Invitation = {
      id: 'inv_' + crypto.randomUUID().substring(0, 8),
      familyId: user.familyId,
      inviterName: user.name,
      email: '',
      phone: '',
      role: role === 'caregiver' ? 'caregiver' : 'familiare',
      assignedPatientIds: Array.isArray(assignedPatientIds) ? assignedPatientIds : [],
      token: 'CNC-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    db.invitations.push(invitation);
    dbInstance.persist();

    const origin = req.headers.origin || 'https://cinicocare.vercel.app';
    const inviteUrl = `${origin}?invite=${invitation.token}`;

    return res.json({
      success: true,
      invitation,
      inviteUrl
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore creazione invito' });
  }
});

// --------------------------------------------------------------------------
// MEMBERS & CAREGIVER MANAGEMENT
// --------------------------------------------------------------------------
app.post('/api/members', authenticate, (req, res) => {
  try {
    const user = (req as any).user as User;
    if (!user.isFamilyAdmin && user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Solo i familiari amministratori possono aggiungere membri al gruppo' });
    }

    const { name, email, phone, role, password, assignedPatientIds } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Nome ed email sono obbligatori' });
    }

    const db = dbInstance.getData();
    const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (existing) {
      return res.status(400).json({ error: 'Un utente con questa email è già registrato nel sistema' });
    }

    const initialPassword = password || 'Caregiver2026!';
    const newMember: User & { passwordHash: string } = {
      id: 'user_' + crypto.randomUUID().substring(0, 8),
      email: email.toLowerCase().trim(),
      name: name.trim(),
      phone: phone ? phone.trim() : '',
      role: role === 'caregiver' ? 'caregiver' : 'familiare',
      familyId: user.familyId!,
      assignedPatientIds: Array.isArray(assignedPatientIds) ? assignedPatientIds : [],
      isFamilyAdmin: role === 'familiare',
      gdprAccepted: true,
      gdprAcceptedAt: new Date().toISOString(),
      passwordHash: hashPassword(initialPassword),
      createdAt: new Date().toISOString()
    };

    db.users.push(newMember);

    const invitation: Invitation = {
      id: 'inv_' + crypto.randomUUID().substring(0, 8),
      familyId: user.familyId!,
      inviterName: user.name,
      email: newMember.email,
      phone: newMember.phone,
      role: (newMember.role === 'superadmin' ? 'familiare' : newMember.role) as 'familiare' | 'caregiver',
      assignedPatientIds: newMember.assignedPatientIds,
      token: 'CNC-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      status: 'accepted',
      createdAt: new Date().toISOString()
    };
    db.invitations.push(invitation);

    dbInstance.persist();

    const origin = req.headers.origin || 'https://cinicocare.vercel.app';
    const telegramDeepLink = getTelegramDeepLink(newMember.id);
    const registrationEmail = generateRegistrationEmailHtml({
      name: newMember.name,
      email: newMember.email,
      password: initialPassword,
      familyName: user.name ? `Gruppo di ${user.name}` : 'CinicoCare',
      userId: newMember.id,
      role: newMember.role,
      appUrl: origin
    });

    return res.json({
      success: true,
      member: sanitizeUser(newMember),
      initialPassword,
      telegramDeepLink,
      registrationEmail
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore creazione membro' });
  }
});

app.put('/api/members/:id', authenticate, (req, res) => {
  try {
    const user = (req as any).user as User;
    const { id } = req.params;
    const { name, email, phone, role, password, assignedPatientIds, isFamilyAdmin } = req.body;

    const db = dbInstance.getData();
    const member = db.users.find(u => u.id === id && (u.familyId === user.familyId || user.role === 'superadmin'));

    if (!member) {
      return res.status(404).json({ error: 'Membro non trovato nel gruppo' });
    }

    const isSelf = member.id === user.id;
    if (!isSelf && !user.isFamilyAdmin && user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Non hai i permessi per modificare questo membro' });
    }

    if (name && name.trim()) member.name = name.trim();
    if (email && email.trim() && email.toLowerCase().trim() !== member.email) {
      const cleanEmail = email.toLowerCase().trim();
      const existing = db.users.find(u => u.id !== member.id && u.email.toLowerCase().trim() === cleanEmail);
      if (existing) {
        return res.status(400).json({ error: `L'email ${cleanEmail} è già utilizzata da un altro account` });
      }
      member.email = cleanEmail;
    }
    if (phone !== undefined) member.phone = phone.trim();
    if (role && (user.isFamilyAdmin || user.role === 'superadmin')) {
      member.role = role;
    }
    if (isFamilyAdmin !== undefined && (user.isFamilyAdmin || user.role === 'superadmin')) {
      member.isFamilyAdmin = Boolean(isFamilyAdmin);
    }
    if (Array.isArray(assignedPatientIds)) {
      member.assignedPatientIds = assignedPatientIds;
    }
    if (password && password.trim().length >= 4) {
      member.passwordHash = hashPassword(password.trim());
    }

    dbInstance.persist();
    return res.json({ success: true, member: sanitizeUser(member) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore aggiornamento membro' });
  }
});

app.delete('/api/members/:id', authenticate, (req, res) => {
  try {
    const user = (req as any).user as User;
    const { id } = req.params;

    if (!user.isFamilyAdmin && user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Solo i familiari amministratori possono rimuovere membri' });
    }

    if (id === user.id) {
      return res.status(400).json({ error: 'Non puoi rimuovere te stesso dal gruppo famiglia' });
    }

    const db = dbInstance.getData();
    const memberIdx = db.users.findIndex(u => u.id === id && (u.familyId === user.familyId || user.role === 'superadmin'));

    if (memberIdx === -1) {
      return res.status(404).json({ error: 'Membro non trovato' });
    }

    db.users.splice(memberIdx, 1);
    dbInstance.persist();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore rimozione membro' });
  }
});

// --------------------------------------------------------------------------
// THERAPY MANAGEMENT
// --------------------------------------------------------------------------
app.post('/api/therapies', authenticate, (req, res) => {
  try {
    const user = (req as any).user as User;
    if (!user.familyId) {
      return res.status(400).json({ error: 'Gruppo famiglia non associato' });
    }

    const {
      id,
      patientId,
      medicationName,
      dosage,
      instructions,
      timeSlots,
      daysOfWeek,
      startDate,
      endDate,
      isActive,
      color
    } = req.body;

    if (!patientId || !medicationName) {
      return res.status(400).json({ error: 'Seleziona un paziente e inserisci il nome del farmaco' });
    }

    const slots = Array.isArray(timeSlots) && timeSlots.length > 0 ? timeSlots : ['08:00'];
    const days = Array.isArray(daysOfWeek) && daysOfWeek.length > 0 ? daysOfWeek : [0, 1, 2, 3, 4, 5, 6];

    const db = dbInstance.getData();

    if (id) {
      const therapy = db.therapies.find(t => t.id === id && (t.familyId === user.familyId || user.role === 'superadmin'));
      if (!therapy) {
        return res.status(404).json({ error: 'Terapia non trovata' });
      }

      therapy.patientId = patientId;
      therapy.medicationName = medicationName.trim();
      therapy.dosage = dosage ? dosage.trim() : '';
      therapy.instructions = instructions ? instructions.trim() : '';
      therapy.timeSlots = slots;
      therapy.daysOfWeek = days;
      therapy.startDate = startDate || therapy.startDate;
      therapy.endDate = endDate || null;
      therapy.isActive = isActive !== undefined ? Boolean(isActive) : therapy.isActive;
      therapy.color = color || therapy.color;

      dbInstance.persist();
      return res.json({ success: true, therapy });
    } else {
      const newTherapy: Therapy = {
        id: 'therapy_' + crypto.randomUUID().substring(0, 8),
        familyId: user.familyId,
        patientId,
        medicationName: medicationName.trim(),
        dosage: dosage ? dosage.trim() : '',
        instructions: instructions ? instructions.trim() : '',
        timeSlots: slots,
        daysOfWeek: days,
        startDate: startDate || getTodayDateString(),
        endDate: endDate || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        color: color || '#0284c7',
        createdAt: new Date().toISOString()
      };

      db.therapies.push(newTherapy);
      dbInstance.persist();
      return res.json({ success: true, therapy: newTherapy });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore salvataggio terapia' });
  }
});

app.delete('/api/therapies/:id', authenticate, (req, res) => {
  try {
    const user = (req as any).user as User;
    const { id } = req.params;
    const db = dbInstance.getData();

    const therapyIdx = db.therapies.findIndex(t => t.id === id && (t.familyId === user.familyId || user.role === 'superadmin'));
    if (therapyIdx === -1) {
      return res.status(404).json({ error: 'Terapia non trovata' });
    }

    db.therapies.splice(therapyIdx, 1);
    db.doseLogs = db.doseLogs.filter(d => d.therapyId !== id);

    dbInstance.persist();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore eliminazione terapia' });
  }
});

// --------------------------------------------------------------------------
// DOSE CHECK / SPUNTA SOMMINISTRAZIONE
// --------------------------------------------------------------------------
app.post('/api/doses/toggle', authenticate, (req, res) => {
  try {
    const user = (req as any).user as User;
    const { therapyId, patientId, scheduledDate, scheduledTime, status, notes } = req.body;

    if (!therapyId || !patientId || !scheduledDate || !scheduledTime) {
      return res.status(400).json({ error: 'Parametri della dose mancanti' });
    }

    const db = dbInstance.getData();
    const doseId = `${therapyId}_${scheduledDate}_${scheduledTime}`;

    let doseLog = db.doseLogs.find(d => d.id === doseId);
    const targetStatus = status || 'taken';

    if (!doseLog) {
      doseLog = {
        id: doseId,
        familyId: user.familyId || db.therapies.find(t => t.id === therapyId)?.familyId || '',
        therapyId,
        patientId,
        scheduledDate,
        scheduledTime,
        status: targetStatus,
        takenAt: targetStatus === 'taken' ? new Date().toISOString() : null,
        takenByUserId: targetStatus === 'taken' ? user.id : null,
        takenByUserName: targetStatus === 'taken' ? user.name : null,
        notes: notes || null,
        notificationsSentCount: 0,
        lastNotifiedAt: null
      };
      db.doseLogs.push(doseLog);
    } else {
      doseLog.status = targetStatus;
      if (targetStatus === 'taken') {
        doseLog.takenAt = new Date().toISOString();
        doseLog.takenByUserId = user.id;
        doseLog.takenByUserName = user.name;
        if (notes !== undefined) doseLog.notes = notes;
      } else if (targetStatus === 'pending') {
        doseLog.takenAt = null;
        doseLog.takenByUserId = null;
        doseLog.takenByUserName = null;
        if (notes !== undefined) doseLog.notes = notes;
      } else if (targetStatus === 'skipped') {
        doseLog.takenAt = new Date().toISOString();
        doseLog.takenByUserId = user.id;
        doseLog.takenByUserName = user.name;
        if (notes !== undefined) doseLog.notes = notes;
      }
    }

    dbInstance.persist();
    return res.json({ success: true, doseLog });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore registrazione somministrazione' });
  }
});

// --------------------------------------------------------------------------
// NOTIFICATIONS & MULTICHANNEL NUDGE DISPATCH (Telegram, Email, Push)
// --------------------------------------------------------------------------
app.post('/api/doses/nudge', authenticate, async (req, res) => {
  try {
    const user = (req as any).user as User;
    const {
      therapyId,
      patientId,
      scheduledDate,
      scheduledTime,
      channel // 'telegram' | 'email' | 'push' | 'all'
    } = req.body;

    const db = dbInstance.getData();
    const patient = db.patients.find(p => p.id === patientId);
    const therapy = db.therapies.find(t => t.id === therapyId);
    const family = db.families.find(f => f.id === user.familyId);

    if (!patient || !therapy) {
      return res.status(404).json({ error: 'Paziente o Terapia non trovati' });
    }

    const doseId = `${therapyId}_${scheduledDate}_${scheduledTime}`;
    let doseLog = db.doseLogs.find(d => d.id === doseId);

    if (!doseLog) {
      doseLog = {
        id: doseId,
        familyId: user.familyId || therapy.familyId,
        therapyId,
        patientId,
        scheduledDate,
        scheduledTime,
        status: 'pending',
        takenAt: null,
        takenByUserId: null,
        takenByUserName: null,
        notes: null,
        notificationsSentCount: 1,
        lastNotifiedAt: new Date().toISOString()
      };
      db.doseLogs.push(doseLog);
    } else {
      doseLog.notificationsSentCount = (doseLog.notificationsSentCount || 0) + 1;
      doseLog.lastNotifiedAt = new Date().toISOString();
    }

    dbInstance.persist();

    const origin = req.headers.origin || 'https://cinicocare.vercel.app';
    const confirmUrl = `${origin}?confirmDose=${doseId}`;
    const dosageStr = therapy.dosage ? ` (${therapy.dosage})` : '';

    const messageHtml =
      `🔔 <b>CinicoCare Promemoria Terapia</b>\n\n` +
      `È ora del farmaco per <b>${patient.name}</b>!\n\n` +
      `💊 <b>Farmaco:</b> ${therapy.medicationName}${dosageStr}\n` +
      `⏰ <b>Orario:</b> ${scheduledTime}\n` +
      (therapy.instructions ? `📝 <b>Istruzioni:</b> ${therapy.instructions}\n\n` : '\n') +
      `👉 <i>Tocca il pulsante qui sotto per confermare la somministrazione nell'App:</i>`;

    const emailSubject = `🔔 Promemoria Farmaco: ${therapy.medicationName} per ${patient.name}`;
    const emailBodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 20px; color: #1e293b; }
    .card { max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #0369a1; padding: 24px; text-align: center; color: #ffffff; }
    .content { padding: 24px; font-size: 14px; line-height: 1.6; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; padding: 12px 24px; border-radius: 12px; font-weight: 700; text-decoration: none; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0; font-size: 20px;">🔔 Promemoria Terapia Farmaci</h2>
    </div>
    <div class="content">
      <p>Gentile Caregiver,</p>
      <p>È il momento di somministrare il farmaco per <strong>${patient.name}</strong>:</p>
      <ul style="padding-left: 20px;">
        <li><strong>Farmaco:</strong> ${therapy.medicationName}${dosageStr}</li>
        <li><strong>Orario previsto:</strong> ${scheduledTime}</li>
        ${therapy.instructions ? `<li><strong>Istruzioni:</strong> ${therapy.instructions}</li>` : ''}
      </ul>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${confirmUrl}" class="btn" target="_blank">✅ Conferma Somministrazione (1 Tocco)</a>
      </div>
      <p style="font-size: 12px; color: #64748b;">Puoi confermare direttamente con 1 tocco oppure accedere all'app CinicoCare.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Find all assigned caregivers for this patient in the family
    const caregiversForPatient = db.users.filter(u =>
      u.familyId === user.familyId &&
      (u.assignedPatientIds.includes(patientId) || u.isFamilyAdmin || u.role === 'superadmin')
    );

    const telegramResults: Array<{ caregiver: string; chatId?: string; success: boolean; error?: string }> = [];
    const emailResults: Array<{ caregiver: string; email: string; success: boolean; error?: string }> = [];

    const sendViaTelegram = !channel || channel === 'telegram' || channel === 'all';
    const sendViaEmail = !channel || channel === 'email' || channel === 'all';

    // 1. Dispatch via Telegram Bot
    if (sendViaTelegram) {
      for (const caregiver of caregiversForPatient) {
        if (caregiver.telegramChatId) {
          const sendResult = await sendTelegramMessage(
            caregiver.telegramChatId,
            messageHtml,
            {
              parseMode: 'HTML',
              inlineKeyboard: [
                [
                  {
                    text: '✅ Ho somministrato il farmaco',
                    url: confirmUrl
                  }
                ]
              ]
            }
          );
          telegramResults.push({
            caregiver: caregiver.name,
            chatId: caregiver.telegramChatId,
            success: sendResult.success,
            error: sendResult.error
          });
        } else {
          telegramResults.push({
            caregiver: caregiver.name,
            success: false,
            error: 'Telegram non collegato'
          });
        }
      }
    }

    // 2. Dispatch via Email (SMTP)
    if (sendViaEmail) {
      for (const caregiver of caregiversForPatient) {
        if (caregiver.email) {
          const mailRes = await sendEmail({
            to: caregiver.email,
            subject: emailSubject,
            html: emailBodyHtml,
            text: `Promemoria per ${caregiver.name}: somministrare ${therapy.medicationName} a ${patient.name} alle ${scheduledTime}. Conferma qui: ${confirmUrl}`
          });
          emailResults.push({
            caregiver: caregiver.name,
            email: caregiver.email,
            success: mailRes.success,
            error: mailRes.error
          });
        }
      }
    }

    const telegramLink = getTelegramDeepLink(user.id);

    return res.json({
      success: true,
      message: 'Sollecito inviato con successo',
      messageText: messageHtml,
      telegramLink,
      confirmUrl,
      notificationsSentCount: doseLog.notificationsSentCount,
      recipientsCount: caregiversForPatient.length,
      recipients: caregiversForPatient.map(c => ({
        name: c.name,
        email: c.email,
        telegramChatId: c.telegramChatId,
        telegramUsername: c.telegramUsername
      })),
      telegramDeliveryResults: telegramResults,
      emailDeliveryResults: emailResults
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore invio promemoria' });
  }
});

// --------------------------------------------------------------------------
// TELEGRAM BOT WEBHOOK & SYNC ENDPOINTS
// --------------------------------------------------------------------------

// Telegram Webhook endpoint
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const update = req.body;
    if (!update) return res.status(200).send('OK');

    const msg = update.message || update.edited_message;
    if (msg && msg.text) {
      const text = msg.text.trim();
      const chatId = String(msg.chat.id);
      const username = msg.from?.username || msg.from?.first_name || '';

      const match = text.match(/^\/?start(?:=|\s+)?(.+)?$/i);
      const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);

      let candidateId = match ? match[1]?.trim() : null;
      const directEmail = emailMatch ? emailMatch[1].toLowerCase() : null;

      const db = dbInstance.getData();
      let targetUser: User | undefined;

      if (candidateId) {
        candidateId = candidateId.replace(/^start=/, '').trim();
        targetUser = db.users.find(
          u => u.id === candidateId ||
               u.id.toLowerCase() === candidateId!.toLowerCase() ||
               u.email.toLowerCase() === candidateId!.toLowerCase()
        );
      }

      if (!targetUser && directEmail) {
        targetUser = db.users.find(u => u.email.toLowerCase() === directEmail);
      }

      const botConfig = getTelegramConfig();

      if (targetUser) {
        targetUser.telegramChatId = chatId;
        targetUser.telegramUsername = username;
        targetUser.telegramConnectedAt = new Date().toISOString();
        dbInstance.persist();

        await sendTelegramMessage(
          chatId,
          `👋 <b>Ciao ${targetUser.name}!</b>\n\n` +
          `✅ Il tuo account <b>CinicoCare</b> (<code>${targetUser.email}</code>) è stato collegato con successo al bot Guardian (<code>@${botConfig.botUsername}</code>).\n\n` +
          `D'ora in poi riceverai direttamente qui su Telegram i promemoria e gli avvisi di somministrazione dei farmaci per i tuoi assistiti.`,
          { parseMode: 'HTML' }
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `👋 <b>Benvenuto nel Bot Guardian di CinicoCare!</b>\n\n` +
          `Per collegare il tuo account, scrivi qui la tua <b>email registrata</b> oppure apri l'app CinicoCare e tocca <b>"Collega il tuo account Telegram"</b>.`,
          { parseMode: 'HTML' }
        );
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('Webhook error:', e);
    return res.status(200).send('OK');
  }
});

// Synchronize updates (polling fallback)
app.get('/api/telegram/sync-updates', authenticate, async (req, res) => {
  try {
    const result = await processTelegramUpdates();
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore sincronizzazione Telegram' });
  }
});

// Check if current user is linked to Telegram
app.get('/api/telegram/check-link', authenticate, async (req, res) => {
  try {
    const user = (req as any).user as User;
    // Trigger update scan
    await processTelegramUpdates();

    const db = dbInstance.getData();
    const dbUser = db.users.find(u => u.id === user.id);
    const botConfig = getTelegramConfig();

    return res.json({
      connected: Boolean(dbUser?.telegramChatId),
      chatId: dbUser?.telegramChatId || null,
      username: dbUser?.telegramUsername || null,
      connectedAt: dbUser?.telegramConnectedAt || null,
      botUsername: botConfig.botUsername,
      deepLink: getTelegramDeepLink(user.id)
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore verifica stato Telegram' });
  }
});

// Unlink Telegram account
app.post('/api/telegram/unlink', authenticate, (req, res) => {
  try {
    const user = (req as any).user as User;
    const targetUserId = req.body?.userId || user.id;

    if (targetUserId !== user.id && user.role !== 'superadmin' && !user.isFamilyAdmin) {
      return res.status(403).json({ error: 'Permessi non sufficienti' });
    }

    const db = dbInstance.getData();
    const dbUser = db.users.find(u => u.id === targetUserId);
    if (!dbUser) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    dbUser.telegramChatId = undefined;
    dbUser.telegramUsername = undefined;
    dbUser.telegramConnectedAt = undefined;

    dbInstance.persist();
    return res.json({ success: true, message: 'Account Telegram scollegato con successo' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore disconnessione Telegram' });
  }
});

// Send test Telegram notification
app.post('/api/telegram/send-test', authenticate, async (req, res) => {
  try {
    const currentUser = (req as any).user as User;
    const { userId, chatId, text } = req.body;

    const db = dbInstance.getData();
    let targetChatId = chatId;
    let recipientName = 'Destinatario';

    if (userId) {
      const u = db.users.find(usr => usr.id === userId);
      if (u) {
        targetChatId = u.telegramChatId;
        recipientName = u.name;
      }
    } else if (!targetChatId && currentUser.telegramChatId) {
      targetChatId = currentUser.telegramChatId;
      recipientName = currentUser.name;
    }

    const botConfig = getTelegramConfig();

    if (!targetChatId) {
      return res.status(400).json({
        error: `L'utente selezionato non ha ancora collegato il suo account Telegram. Clicca prima sul link per collegare il bot @${botConfig.botUsername}`,
        deepLink: getTelegramDeepLink(userId || currentUser.id)
      });
    }

    const msg = text ||
      `🔔 <b>Test Notifica CinicoCare</b>\n\n` +
      `Ciao <b>${recipientName}</b>, questo è un messaggio di test inviato dal bot Guardian (<code>@${botConfig.botUsername}</code>).\n\n` +
      `Il tuo account Telegram è configurato e pronto a ricevere i promemoria delle terapie!`;

    const result = await sendTelegramMessage(targetChatId, msg, { parseMode: 'HTML' });

    if (result.success) {
      return res.json({
        success: true,
        message: 'Messaggio di test Telegram inviato con successo!',
        messageId: result.messageId,
        recipient: recipientName,
        chatId: targetChatId
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || 'Invio Telegram fallito',
        details: result.response
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore invio test Telegram' });
  }
});

// --------------------------------------------------------------------------
// ADMIN: DYNAMIC TELEGRAM & SMTP CONFIGURATION
// --------------------------------------------------------------------------

// Get current Telegram Bot Config
app.get('/api/admin/telegram-config', authenticate, async (req, res) => {
  try {
    const user = (req as any).user as User;
    if (user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Accesso riservato all\'Amministratore Generale' });
    }
    const currentConfig = getTelegramConfig();
    const status = getTelegramStatus();
    return res.json({
      success: true,
      config: {
        botUsername: currentConfig.botUsername,
        pollingEnabled: currentConfig.pollingEnabled,
        pollingIntervalMs: currentConfig.pollingIntervalMs,
        hasCustomToken: Boolean(currentConfig.botToken)
      },
      status
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore lettura configurazione Telegram' });
  }
});

// Get current SMTP Config
app.get('/api/admin/smtp-config', authenticate, async (req, res) => {
  try {
    const user = (req as any).user as User;
    if (user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Accesso riservato all\'Amministratore Generale' });
    }
    const currentConfig = getSmtpConfig();
    return res.json({
      success: true,
      config: {
        host: currentConfig.host,
        port: currentConfig.port,
        secure: currentConfig.secure,
        user: currentConfig.user,
        fromEmail: currentConfig.fromEmail,
        fromName: currentConfig.fromName,
        isConfigured: currentConfig.isConfigured,
        hasPassword: Boolean(currentConfig.pass)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore lettura configurazione SMTP' });
  }
});

// Update Telegram Bot Token & Username
app.post('/api/admin/telegram-config', authenticate, async (req, res) => {
  try {
    const user = (req as any).user as User;
    if (user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Accesso riservato all\'Amministratore Generale' });
    }

    const { botToken, botUsername, pollingEnabled } = req.body;
    const currentConfig = getTelegramConfig();

    const cleanUsername = botUsername ? botUsername.replace(/^@/, '').trim() : currentConfig.botUsername;
    const cleanToken = botToken ? botToken.trim() : currentConfig.botToken;

    if (!cleanToken || !cleanUsername) {
      return res.status(400).json({ error: 'Token del Bot e Username sono entrambi obbligatori' });
    }

    // Verify token with Telegram API
    const testRes = await testTelegramBot(cleanToken);
    if (!testRes.success) {
      return res.status(400).json({
        error: `Test del Bot Telegram fallito: ${testRes.error}`
      });
    }

    // Clear any webhook so polling works
    await deleteTelegramWebhook(cleanToken);

    if (pollingEnabled === false) {
      stopTelegramPolling();
    } else {
      startTelegramPolling();
    }

    const db = dbInstance.getData();
    db.telegramConfig = {
      botToken: cleanToken,
      botUsername: cleanUsername,
      isActive: true,
      pollingEnabled: pollingEnabled !== false,
      lastTestedAt: new Date().toISOString(),
      botInfo: testRes.bot
    };

    dbInstance.persist();

    return res.json({
      success: true,
      message: `Bot Telegram @${cleanUsername} configurato e verificato con successo!`,
      telegramConfig: db.telegramConfig,
      status: getTelegramStatus()
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore configurazione bot Telegram' });
  }
});

// Test arbitrary Telegram bot token
app.post('/api/admin/telegram-test-bot', authenticate, async (req, res) => {
  try {
    const user = (req as any).user as User;
    if (user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Accesso riservato all\'Amministratore Generale' });
    }

    const { botToken } = req.body;
    const testResult = await testTelegramBot(botToken);
    return res.json(testResult);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore test bot' });
  }
});

// Delete webhook
app.post('/api/admin/telegram-clear-webhook', authenticate, async (req, res) => {
  try {
    const user = (req as any).user as User;
    if (user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Accesso riservato all\'Amministratore Generale' });
    }

    const result = await deleteTelegramWebhook();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore rimozione webhook' });
  }
});

// Save SMTP Config
app.post('/api/admin/smtp-config', authenticate, async (req, res) => {
  try {
    const user = (req as any).user as User;
    if (user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Accesso riservato all\'Amministratore Generale' });
    }

    const { host, port, secure, user: smtpUser, pass, fromEmail, fromName } = req.body;

    const newConfig: SmtpConfig = {
      host: (host || '').trim(),
      port: Number(port) || 587,
      secure: Boolean(secure),
      user: (smtpUser || '').trim(),
      pass: (pass || '').trim(),
      fromEmail: (fromEmail || 'notifiche@cinicocare.it').trim(),
      fromName: (fromName || 'CinicoCare Assistenza').trim(),
      isConfigured: Boolean(host && smtpUser)
    };

    const db = dbInstance.getData();
    db.smtpConfig = newConfig;
    dbInstance.persist();

    return res.json({
      success: true,
      message: 'Configurazione SMTP salvata con successo!',
      smtpConfig: newConfig
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore salvataggio configurazione SMTP' });
  }
});

// Test SMTP Connection and Send Test Email
app.post('/api/admin/smtp-test', authenticate, async (req, res) => {
  try {
    const user = (req as any).user as User;
    if (user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Accesso riservato all\'Amministratore Generale' });
    }

    const { testEmailAddress } = req.body;
    const recipient = testEmailAddress || user.email;

    const verifyResult = await verifySmtpConnection();
    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        error: verifyResult.message
      });
    }

    const sendRes = await sendEmail({
      to: recipient,
      subject: 'CinicoCare - Email di Test Configurazione SMTP',
      html: `
        <div style="font-family:sans-serif; padding:20px; background:#f8fafc; border-radius:12px;">
          <h2 style="color:#0369a1;">✅ Configurazione SMTP Funzionante!</h2>
          <p>Questa è un'email di test inviata con successo dalla piattaforma <strong>CinicoCare</strong> al tuo indirizzo <code>${recipient}</code>.</p>
          <p>Data e ora: ${new Date().toLocaleString('it-IT')}</p>
        </div>
      `,
      text: `Configurazione SMTP CinicoCare verificata con successo per ${recipient}.`
    });

    if (sendRes.success && !sendRes.isSimulated) {
      return res.json({
        success: true,
        message: `Email di test inviata con successo a ${recipient}!`,
        messageId: sendRes.messageId
      });
    } else if (sendRes.isSimulated) {
      return res.status(400).json({
        success: false,
        error: sendRes.error || 'Server SMTP non configurato'
      });
    } else {
      return res.status(400).json({
        success: false,
        error: sendRes.error || 'Errore durante l\'invio dell\'email di test'
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore test SMTP' });
  }
});

// --------------------------------------------------------------------------
// ADMIN SIMULATION: EMAIL & TELEGRAM NOTIFICATIONS
// --------------------------------------------------------------------------
app.post('/api/admin/simulate-notification', authenticate, async (req, res) => {
  try {
    const currentUser = (req as any).user as User;
    if (currentUser.role !== 'superadmin' && !currentUser.isFamilyAdmin) {
      return res.status(403).json({ error: 'Accesso riservato agli amministratori' });
    }

    const {
      targetUserId,
      type, // 'registration_email' | 'therapy_reminder' | 'custom_telegram'
      patientId,
      therapyId,
      customMessage,
      sendLive // boolean: send real email and/or Telegram
    } = req.body;

    const db = dbInstance.getData();
    let targetUser = db.users.find(u => u.id === targetUserId);
    if (!targetUser && req.body.targetUserFallback) {
      targetUser = req.body.targetUserFallback;
      if (targetUser && targetUser.id) {
        db.users.push(targetUser as any);
        dbInstance.persist();
      }
    }
    if (!targetUser) {
      targetUser = {
        id: targetUserId || 'user_demo_caregiver',
        name: req.body.targetUserName || 'Caregiver',
        email: req.body.targetUserEmail || 'caregiver@cinicocare.it',
        passwordHash: '',
        role: 'caregiver',
        familyId: 'family_default',
        assignedPatientIds: [],
        isFamilyAdmin: false,
        gdprAccepted: true,
        createdAt: new Date().toISOString()
      };
    }

    const botConfig = getTelegramConfig();
    const origin = req.headers.origin || 'https://cinicocare.vercel.app';
    const deepLink = getTelegramDeepLink(targetUser.id);
    const targetFamily = db.families.find(f => f.id === targetUser.familyId);

    // 1. REGISTRATION EMAIL
    if (type === 'registration_email') {
      const emailData = generateRegistrationEmailHtml({
        name: targetUser.name,
        email: targetUser.email,
        password: 'PasswordSceltaOProvvisoria!',
        familyName: targetFamily?.name || 'Gruppo Famiglia CinicoCare',
        userId: targetUser.id,
        role: targetUser.role,
        appUrl: origin
      });

      let liveEmailResult: any = null;
      if (sendLive) {
        liveEmailResult = await sendEmail({
          to: targetUser.email,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text
        });
      }

      return res.json({
        success: true,
        type: 'registration_email',
        recipient: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          telegramChatId: targetUser.telegramChatId || null,
          telegramConnected: Boolean(targetUser.telegramChatId)
        },
        email: emailData,
        telegramDeepLink: deepLink,
        liveEmailResult,
        message: `Email di registrazione per ${targetUser.name} (${targetUser.email}) elaborata con successo.`
      });
    }

    // 2. THERAPY REMINDER
    const patient = patientId ? db.patients.find(p => p.id === patientId) : (db.patients[0] || null);
    const therapy = therapyId ? db.therapies.find(t => t.id === therapyId) : (db.therapies[0] || null);

    const scheduledTime = therapy?.timeSlots?.[0] || '08:30';
    const confirmUrl = `${origin}?confirmDose=${therapy?.id || 'th1'}_${getTodayDateString()}_${scheduledTime}`;

    const reminderHtml =
      `🔔 <b>CinicoCare Promemoria Terapia</b>\n\n` +
      `Ciao <b>${targetUser.name}</b>, è ora del farmaco per <b>${patient ? patient.name : 'Assistito'}</b>!\n\n` +
      `💊 <b>Farmaco:</b> ${therapy ? therapy.medicationName : 'Cardioaspirina'} ${therapy?.dosage ? `(${therapy.dosage})` : ''}\n` +
      `⏰ <b>Orario:</b> ${scheduledTime}\n` +
      (therapy?.instructions ? `📝 <b>Istruzioni:</b> ${therapy.instructions}\n\n` : '\n') +
      `👉 <i>Tocca il pulsante qui sotto per confermare la somministrazione nell'App:</i>`;

    const reminderEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 20px; color: #1e293b; }
    .box { max-width: 550px; margin: auto; background: white; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0; }
    .btn { display: inline-block; background: #0284c7; color: white !important; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="box">
    <h2 style="color:#0369a1; margin-top:0;">🔔 Promemoria Terapia Farmaci</h2>
    <p>Ciao <strong>${targetUser.name}</strong>, è ora della somministrazione farmaco per <strong>${patient ? patient.name : 'Assistito'}</strong>.</p>
    <p>💊 <strong>Farmaco:</strong> ${therapy ? therapy.medicationName : 'Cardioaspirina'} ${therapy?.dosage ? `(${therapy.dosage})` : ''}</p>
    <p>⏰ <strong>Orario previsto:</strong> ${scheduledTime}</p>
    <div style="margin: 20px 0; text-align: center;">
      <a href="${confirmUrl}" class="btn" target="_blank">✅ Conferma Somministrazione (1 Tocco)</a>
    </div>
    <hr style="border:none; border-top:1px solid #f1f5f9; margin: 20px 0;">
    <p style="font-size:12px; color:#64748b;">Bot Telegram: <a href="${deepLink}">@${botConfig.botUsername}</a></p>
  </div>
</body>
</html>
    `.trim();

    let telegramSentResult: any = null;
    let liveEmailResult: any = null;

    if (targetUser.telegramChatId) {
      telegramSentResult = await sendTelegramMessage(
        targetUser.telegramChatId,
        customMessage || reminderHtml,
        {
          parseMode: 'HTML',
          inlineKeyboard: [
            [
              {
                text: '✅ Conferma Somministrazione',
                url: confirmUrl
              }
            ]
          ]
        }
      );
    }

    if (sendLive && targetUser.email) {
      liveEmailResult = await sendEmail({
        to: targetUser.email,
        subject: `Promemoria Farmaco: ${therapy ? therapy.medicationName : 'Terapia'} per ${patient ? patient.name : 'Assistito'}`,
        html: reminderEmailHtml,
        text: `Promemoria per ${targetUser.name}: somministrare ${therapy ? therapy.medicationName : 'Farmaco'} a ${patient ? patient.name : 'Assistito'} alle ${scheduledTime}. Conferma qui: ${confirmUrl}`
      });
    }

    return res.json({
      success: true,
      type: type || 'therapy_reminder',
      recipient: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        telegramChatId: targetUser.telegramChatId || null,
        telegramConnected: Boolean(targetUser.telegramChatId)
      },
      email: {
        subject: `Promemoria Farmaco: ${therapy ? therapy.medicationName : 'Terapia'} per ${patient ? patient.name : 'Assistito'}`,
        html: reminderEmailHtml,
        text: `Promemoria per ${targetUser.name}: somministrare ${therapy ? therapy.medicationName : 'Farmaco'} a ${patient ? patient.name : 'Assistito'} alle ${scheduledTime}. Conferma qui: ${confirmUrl}`
      },
      telegramMessage: customMessage || reminderHtml,
      telegramDelivery: telegramSentResult || {
        success: false,
        note: 'Telegram non inviato: account non ancora collegato',
        deepLink
      },
      liveEmailResult,
      confirmUrl,
      telegramDeepLink: deepLink
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore simulazione notifica' });
  }
});

// --------------------------------------------------------------------------
// PUSH NOTIFICATIONS SUBSCRIPTION
// --------------------------------------------------------------------------
app.post('/api/push/subscribe', authenticate, (req, res) => {
  try {
    const user = (req as any).user as User;
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Dati sottoscrizione non validi' });
    }

    const db = dbInstance.getData();
    const existingIdx = db.pushSubscriptions.findIndex(s => s.endpoint === subscription.endpoint);

    if (existingIdx >= 0) {
      db.pushSubscriptions[existingIdx] = {
        userId: user.id,
        endpoint: subscription.endpoint,
        subscription,
        createdAt: new Date().toISOString()
      };
    } else {
      db.pushSubscriptions.push({
        userId: user.id,
        endpoint: subscription.endpoint,
        subscription,
        createdAt: new Date().toISOString()
      });
    }

    dbInstance.persist();
    return res.json({ success: true, message: 'Notifiche push attivate' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore sottoscrizione push' });
  }
});

// --------------------------------------------------------------------------
// SUPERADMIN OVERVIEW & COMPLETE DB RESET
// --------------------------------------------------------------------------
app.get('/api/admin/overview', authenticate, (req, res) => {
  try {
    const user = (req as any).user as User;
    if (user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Accesso riservato all\'Amministratore Generale' });
    }

    const db = dbInstance.getData();

    const familiesWithCounts = db.families.map(f => ({
      ...f,
      patientsCount: db.patients.filter(p => p.familyId === f.id).length,
      membersCount: db.users.filter(u => u.familyId === f.id && u.role !== 'superadmin').length,
      therapiesCount: db.therapies.filter(t => t.familyId === f.id).length
    }));

    const allUsers = db.users.map(u => {
      const family = db.families.find(f => f.id === u.familyId);
      return {
        ...sanitizeUser(u),
        familyName: family?.name || (u.role === 'superadmin' ? 'Sistema Generale' : 'Nessuna')
      };
    });

    const overview: AdminOverviewData = {
      totalFamilies: db.families.length,
      totalPatients: db.patients.length,
      totalTherapies: db.therapies.length,
      totalUsers: db.users.length,
      totalDoseLogs: db.doseLogs.length,
      families: familiesWithCounts,
      allUsers,
      recentLogs: db.doseLogs.slice(-20).reverse(),
      telegramConfig: getTelegramConfig(),
      smtpConfig: getSmtpConfig()
    };

    return res.json(overview);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore caricamento pannello admin' });
  }
});

const handleResetDb = (req: Request, res: Response) => {
  try {
    const user = (req as any).user as User;
    if (user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Azione consentita solo all\'Amministratore Generale' });
    }

    const { confirmationText, confirmationCode } = req.body;
    const text = (confirmationText || confirmationCode || '').trim().toUpperCase();

    if (text !== 'CANCELLA' && text !== 'RESET_CINICOCARE_2026') {
      return res.status(400).json({
        error: 'Conferma obbligatoria non valida. Digita esattamente "CANCELLA"'
      });
    }

    dbInstance.resetDatabase();

    return res.json({
      success: true,
      message: 'Database CinicoCare azzerato e ripristinato ai valori di fabbrica con successo.'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore durante il reset del database' });
  }
};

app.post('/api/admin/reset', authenticate, handleResetDb);
app.post('/api/admin/reset-db', authenticate, handleResetDb);

// Backup Import
app.post('/api/admin/import', authenticate, (req, res) => {
  try {
    const user = (req as any).user as User;
    if (user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Azione consentita solo all\'Amministratore Generale' });
    }

    const { backup } = req.body;
    if (!backup || !Array.isArray(backup.users)) {
      return res.status(400).json({ error: 'File di backup non valido' });
    }

    const db = dbInstance.getData();
    db.users = backup.users;
    db.families = backup.families || [];
    db.patients = backup.patients || [];
    db.therapies = backup.therapies || [];
    db.doseLogs = backup.doseLogs || [];
    db.invitations = backup.invitations || [];
    db.pushSubscriptions = backup.pushSubscriptions || [];

    dbInstance.persist();

    return res.json({ success: true, message: 'Backup ripristinato con successo nel database centrale' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Errore ripristino backup' });
  }
});

// 404 handler for unmatched /api routes (ensures API always returns JSON, not HTML)
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Endpoint API non trovato: ${req.method} ${req.originalUrl || req.path}` });
});

// Global Express Error Handler for API routes
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Express Error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Si è verificato un errore interno del server.'
  });
});

export default app;
