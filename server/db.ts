import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { User, Family, Patient, Therapy, DoseLog, Invitation, TelegramBotConfig, SmtpConfig } from '../src/types';

export interface DatabaseSchema {
  users: (User & { passwordHash: string })[];
  families: Family[];
  patients: Patient[];
  therapies: Therapy[];
  doseLogs: DoseLog[];
  invitations: Invitation[];
  telegramConfig?: TelegramBotConfig;
  smtpConfig?: SmtpConfig;
  pushSubscriptions: Array<{
    userId: string;
    endpoint: string;
    subscription: any;
    createdAt: string;
  }>;
}

// Choose appropriate data directory based on environment (Vercel serverless vs Docker / Local)
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? path.join('/tmp', 'cinicocare_data') : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'cinicocare_db.json');

// Simple secure hash helper for stored passwords
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_cinicocare_salt_2026').digest('hex');
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getInitialSeedData(): DatabaseSchema {
  const superAdminId = 'user_superadmin_01';

  return {
    users: [
      // 1. SuperAdmin (Account Amministratore Generale)
      {
        id: superAdminId,
        email: 'admin@cinicocare.it',
        name: 'Amministratore Generale',
        phone: '',
        role: 'superadmin',
        familyId: null,
        assignedPatientIds: [],
        isFamilyAdmin: true,
        gdprAccepted: true,
        gdprAcceptedAt: '2026-01-01T00:00:00.000Z',
        passwordHash: hashPassword('Adm10870@!'),
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    ],
    families: [],
    patients: [],
    therapies: [],
    doseLogs: [],
    invitations: [],
    pushSubscriptions: [],
    telegramConfig: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '8765733787:AAHubCXTDstfLVvktRU62SFKJM1LksTra2E',
      botUsername: process.env.TELEGRAM_BOT_USERNAME || 'Guardian32170_bot',
      isActive: true
    },
    smtpConfig: {
      host: process.env.SMTP_HOST || '',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      fromEmail: process.env.SMTP_FROM || 'notifiche@cinicocare.it',
      fromName: process.env.SMTP_FROM_NAME || 'CinicoCare Assistenza',
      isConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER)
    }
  };
}

export class JsonDatabase {
  private static instance: JsonDatabase;
  private db: DatabaseSchema;
  private isCloudSyncing = false;
  private lastCloudSync = 0;

  private constructor() {
    this.ensureDataDirectory();
    this.db = this.loadDatabase();
    // Attempt background cloud fetch if KV / Upstash / Remote is configured
    this.syncFromCloudAsync();
  }

  public static getInstance(): JsonDatabase {
    if (!JsonDatabase.instance) {
      JsonDatabase.instance = new JsonDatabase();
    }
    return JsonDatabase.instance;
  }

  private ensureDataDirectory() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (err) {
      console.warn('Could not create data directory, using in-memory mode:', err);
    }
  }

  private loadDatabase(): DatabaseSchema {
    try {
      // First check local file if exists
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users)) {
          return parsed;
        }
      }
      // Also check standard cwd data file if in serverless
      const rootDbFile = path.join(process.cwd(), 'data', 'cinicocare_db.json');
      if (fs.existsSync(rootDbFile)) {
        const raw = fs.readFileSync(rootDbFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users)) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Error loading database, initializing seed data:', err);
    }
    const seed = getInitialSeedData();
    this.saveDatabase(seed);
    return seed;
  }

  private saveDatabase(data: DatabaseSchema) {
    try {
      this.ensureDataDirectory();
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      // On read-only serverless filesystems, catch gracefully
      console.warn('Could not write database to disk (using memory/cloud sync):', err);
    }
  }

  // Cloud KV / Upstash / Remote Sync
  private async syncFromCloudAsync() {
    const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (kvUrl && kvToken) {
      try {
        const response = await fetch(`${kvUrl}/get/cinicocare_db`, {
          headers: { Authorization: `Bearer ${kvToken}` }
        });
        if (response.ok) {
          const resJson: any = await response.json();
          const rawData = resJson.result;
          if (rawData) {
            const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            if (parsed && Array.isArray(parsed.users)) {
              this.db = parsed;
              this.saveDatabase(this.db);
              this.lastCloudSync = Date.now();
            }
          }
        }
      } catch (e) {
        console.warn('Remote KV sync note:', e);
      }
    }
  }

  private async syncToCloudAsync(data: DatabaseSchema) {
    if (this.isCloudSyncing) return;
    const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (kvUrl && kvToken) {
      this.isCloudSyncing = true;
      try {
        await fetch(`${kvUrl}/set/cinicocare_db`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${kvToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        this.lastCloudSync = Date.now();
      } catch (e) {
        console.warn('Remote KV push note:', e);
      } finally {
        this.isCloudSyncing = false;
      }
    }
  }

  public getData(): DatabaseSchema {
    return this.db;
  }

  public persist() {
    this.saveDatabase(this.db);
    this.syncToCloudAsync(this.db);
  }

  // Complete DB Reset for SuperAdmin
  public resetDatabase(): void {
    const seed = getInitialSeedData();
    this.db = seed;
    this.saveDatabase(seed);
    this.syncToCloudAsync(seed);
  }
}
