export type UserRole = 'superadmin' | 'familiare' | 'caregiver';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  familyId: string | null; // null for superadmin or unassigned
  assignedPatientIds: string[]; // for caregivers
  isFamilyAdmin: boolean;
  gdprAccepted: boolean;
  gdprAcceptedAt?: string;
  telegramChatId?: string;
  telegramUsername?: string;
  telegramConnectedAt?: string;
  createdAt: string;
}

export interface NotificationSettings {
  emailEnabled?: boolean;
  telegramEnabled: boolean;
  pushEnabled: boolean;
  soundAlarmEnabled: boolean;
  preAlertMinutes: number; // e.g. 15
  repeatIntervalMinutes: number; // 1 to 60 minutes
  autoRepeatNudges: boolean; // continua finché qualcuno non somministra o salta
  customTelegramTemplate?: string;
  customWhatsappTemplate?: string; // legacy fallback
  whatsappEnabled?: boolean; // legacy fallback
  privacyDisclaimerMarkdown?: string;
}

export interface Family {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  createdBy: string; // userId of creator
  notificationSettings: NotificationSettings;
  privacyDisclaimerMarkdown?: string;
}

export interface Patient {
  id: string;
  familyId: string;
  name: string;
  birthDate?: string;
  notes?: string; // allergie, condizioni mediche, medico curante
  assignedCaregiverIds: string[];
  createdAt: string;
}

export interface Therapy {
  id: string;
  familyId: string;
  patientId: string;
  medicationName: string;
  dosage?: string;
  instructions?: string;
  timeSlots: string[]; // e.g. ["08:00", "13:00", "20:00"]
  daysOfWeek: number[]; // 0=Dom, 1=Lun, 2=Mar, 3=Mer, 4=Gio, 5=Ven, 6=Sab
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD or null
  isActive: boolean;
  color: string; // badge hex or tailwind identifier
  createdAt: string;
}

export type DoseStatus = 'pending' | 'taken' | 'skipped' | 'late';

export interface DoseLog {
  id: string; // generated: `${therapyId}_${scheduledDate}_${scheduledTime}`
  familyId: string;
  therapyId: string;
  patientId: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  status: DoseStatus;
  takenAt?: string | null; // ISO Date String
  takenByUserId?: string | null;
  takenByUserName?: string | null;
  notes?: string | null;
  notificationsSentCount: number;
  lastNotifiedAt?: string | null;
}

export interface ScheduledDoseItem {
  id: string;
  doseLogId: string;
  therapy: Therapy;
  patient: Patient;
  scheduledDate: string;
  scheduledTime: string;
  scheduledDateTime: Date;
  status: DoseStatus;
  isDueNow: boolean;
  isUpcoming: boolean;
  isOverdue: boolean;
  doseLog?: DoseLog;
}

export interface Invitation {
  id: string;
  familyId: string;
  inviterName: string;
  email?: string;
  phone?: string;
  role: 'familiare' | 'caregiver';
  assignedPatientIds?: string[];
  token: string;
  status: 'pending' | 'accepted' | 'declined';
  acceptedByUserId?: string;
  acceptedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface BootstrapData {
  user: User;
  family: Family | null;
  patients: Patient[];
  therapies: Therapy[];
  members: User[]; // only within the same family, superadmin excluded from list
  doseLogs: DoseLog[];
  invitations: Invitation[];
}

export interface AdminOverviewData {
  totalFamilies: number;
  totalPatients: number;
  totalTherapies: number;
  totalUsers: number;
  totalDoseLogs: number;
  families: (Family & {
    patientsCount: number;
    membersCount: number;
    therapiesCount: number;
  })[];
  allUsers: (Omit<User, 'passwordHash'> & { familyName?: string })[];
  recentLogs: DoseLog[];
}
