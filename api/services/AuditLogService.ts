import crypto from 'node:crypto';
import type { AuditLogEntry, AuditActionType } from '../../shared/types.js';
import { FileStorageService } from './FileStorageService.js';

function genId() {
  return `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function computeHash(entry: Omit<AuditLogEntry, 'hash'>): string {
  const data = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    operatorId: entry.operatorId,
    operatorName: entry.operatorName,
    beforeState: entry.beforeState,
    afterState: entry.afterState,
    comment: entry.comment,
    previousHash: entry.previousHash,
  });
  return crypto.createHash('sha256').update(data).digest('hex');
}

export class AuditLogService {
  static async listAll(): Promise<AuditLogEntry[]> {
    return FileStorageService.readJson<AuditLogEntry[]>(FileStorageService.getWorkflowAuditLogPath(), []);
  }

  static async listByEntity(entityType: AuditLogEntry['entityType'], entityId: string): Promise<AuditLogEntry[]> {
    const all = await this.listAll();
    return all.filter((e) => e.entityType === entityType && e.entityId === entityId);
  }

  static async listByInstance(instanceId: string): Promise<AuditLogEntry[]> {
    return this.listByEntity('workflow_instance', instanceId);
  }

  static async getLastEntry(): Promise<AuditLogEntry | null> {
    const all = await this.listAll();
    return all.length > 0 ? all[all.length - 1] : null;
  }

  static async createEntry(params: {
    action: AuditActionType;
    entityType: AuditLogEntry['entityType'];
    entityId: string;
    operatorId: string;
    operatorName: string;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
    comment?: string;
  }): Promise<AuditLogEntry> {
    const lastEntry = await this.getLastEntry();
    const now = new Date().toISOString();
    const entryWithoutHash: Omit<AuditLogEntry, 'hash'> = {
      id: genId(),
      timestamp: now,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      operatorId: params.operatorId,
      operatorName: params.operatorName,
      beforeState: params.beforeState,
      afterState: params.afterState,
      comment: params.comment,
      previousHash: lastEntry?.hash,
    };
    const hash = computeHash(entryWithoutHash);
    const entry: AuditLogEntry = { ...entryWithoutHash, hash };
    await FileStorageService.appendJson(FileStorageService.getWorkflowAuditLogPath(), entry);
    return entry;
  }

  static async verifyIntegrity(): Promise<{ valid: boolean; invalidIndex?: number; message: string }> {
    const logs = await this.listAll();
    if (logs.length === 0) {
      return { valid: true, message: '日志为空' };
    }
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const expectedPreviousHash = i > 0 ? logs[i - 1].hash : undefined;
      if (log.previousHash !== expectedPreviousHash) {
        return {
          valid: false,
          invalidIndex: i,
          message: `第 ${i + 1} 条日志的 previousHash 不匹配`,
        };
      }
      const { hash: _hash, ...entryWithoutHash } = log;
      void _hash;
      const computedHash = computeHash(entryWithoutHash as Omit<AuditLogEntry, 'hash'>);
      if (computedHash !== log.hash) {
        return {
          valid: false,
          invalidIndex: i,
          message: `第 ${i + 1} 条日志的哈希校验失败，数据可能已被篡改`,
        };
      }
    }
    return { valid: true, message: `共 ${logs.length} 条日志，全部校验通过` };
  }
}
