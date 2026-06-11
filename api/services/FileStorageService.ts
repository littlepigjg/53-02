import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const ANNOTATIONS_DIR = path.join(DATA_DIR, 'annotations');
const PARSED_DIR = path.join(DATA_DIR, 'parsed');
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');
const WORKFLOW_DIR = path.join(DATA_DIR, 'workflow');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');
const WORKFLOW_CONFIGS_FILE = path.join(WORKFLOW_DIR, 'configs.json');
const WORKFLOW_INSTANCES_FILE = path.join(WORKFLOW_DIR, 'instances.json');
const WORKFLOW_TRANSITIONS_DIR = path.join(WORKFLOW_DIR, 'transitions');
const WORKFLOW_AUDIT_LOG_FILE = path.join(WORKFLOW_DIR, 'audit_log.json');
const WORKFLOW_NOTIFICATIONS_FILE = path.join(WORKFLOW_DIR, 'notifications.json');
const REVIEWER_ROLES_FILE = path.join(WORKFLOW_DIR, 'reviewer_roles.json');

export class FileStorageService {
  static async ensureDirs() {
    await Promise.all([
      fs.mkdir(DATA_DIR, { recursive: true }),
      fs.mkdir(ANNOTATIONS_DIR, { recursive: true }),
      fs.mkdir(PARSED_DIR, { recursive: true }),
      fs.mkdir(UPLOADS_DIR, { recursive: true }),
      fs.mkdir(WORKFLOW_DIR, { recursive: true }),
      fs.mkdir(WORKFLOW_TRANSITIONS_DIR, { recursive: true }),
    ]);
    const initFiles: [string, string][] = [
      [DOCUMENTS_FILE, '[]'],
      [WORKFLOW_CONFIGS_FILE, '[]'],
      [WORKFLOW_INSTANCES_FILE, '[]'],
      [WORKFLOW_AUDIT_LOG_FILE, '[]'],
      [WORKFLOW_NOTIFICATIONS_FILE, '[]'],
      [REVIEWER_ROLES_FILE, '[]'],
    ];
    await Promise.all(
      initFiles.map(async ([filePath, defaultContent]) => {
        try {
          await fs.access(filePath);
        } catch {
          await fs.writeFile(filePath, defaultContent, 'utf8');
        }
      })
    );
  }

  static async readJson<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      await fs.access(filePath);
      const raw = await fs.readFile(filePath, 'utf8');
      return raw.trim() ? (JSON.parse(raw) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  static async writeJson<T>(filePath: string, data: T) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  static async appendJson<T>(filePath: string, item: T) {
    const data = await this.readJson<T[]>(filePath, []);
    data.push(item);
    await this.writeJson(filePath, data);
  }

  static getDocumentsPath() {
    return DOCUMENTS_FILE;
  }

  static getAnnotationsPath(docId: string) {
    return path.join(ANNOTATIONS_DIR, `${docId}.json`);
  }

  static getParsedPath(docId: string) {
    return path.join(PARSED_DIR, `${docId}.json`);
  }

  static getUploadsPath() {
    return UPLOADS_DIR;
  }

  static getWorkflowConfigsPath() {
    return WORKFLOW_CONFIGS_FILE;
  }

  static getWorkflowInstancesPath() {
    return WORKFLOW_INSTANCES_FILE;
  }

  static getWorkflowTransitionsPath(instanceId: string) {
    return path.join(WORKFLOW_TRANSITIONS_DIR, `${instanceId}.json`);
  }

  static getWorkflowAuditLogPath() {
    return WORKFLOW_AUDIT_LOG_FILE;
  }

  static getWorkflowNotificationsPath() {
    return WORKFLOW_NOTIFICATIONS_FILE;
  }

  static getReviewerRolesPath() {
    return REVIEWER_ROLES_FILE;
  }

  static async deleteFile(filePath: string) {
    try {
      await fs.unlink(filePath);
    } catch {
      // ignore
    }
  }
}
