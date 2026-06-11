import type {
  WorkflowConfig,
  WorkflowInstance,
  WorkflowTransitionRecord,
  WorkflowNotification,
  ReviewerRole,
} from '../../shared/types.js';
import { FileStorageService } from './FileStorageService.js';

export class WorkflowStorageService {
  static async listConfigs(): Promise<WorkflowConfig[]> {
    return FileStorageService.readJson<WorkflowConfig[]>(FileStorageService.getWorkflowConfigsPath(), []);
  }

  static async getConfig(id: string): Promise<WorkflowConfig | null> {
    const configs = await this.listConfigs();
    return configs.find((c) => c.id === id) || null;
  }

  static async getDefaultConfig(): Promise<WorkflowConfig | null> {
    const configs = await this.listConfigs();
    return configs.find((c) => c.isDefault) || configs[0] || null;
  }

  static async saveConfig(config: WorkflowConfig): Promise<void> {
    const configs = await this.listConfigs();
    const idx = configs.findIndex((c) => c.id === config.id);
    if (idx >= 0) {
      configs[idx] = config;
    } else {
      configs.push(config);
    }
    await FileStorageService.writeJson(FileStorageService.getWorkflowConfigsPath(), configs);
  }

  static async listInstances(): Promise<WorkflowInstance[]> {
    return FileStorageService.readJson<WorkflowInstance[]>(FileStorageService.getWorkflowInstancesPath(), []);
  }

  static async getInstance(id: string): Promise<WorkflowInstance | null> {
    const instances = await this.listInstances();
    return instances.find((i) => i.id === id) || null;
  }

  static async getInstanceByDocId(docId: string): Promise<WorkflowInstance | null> {
    const instances = await this.listInstances();
    return instances.find((i) => i.docId === docId) || null;
  }

  static async saveInstance(instance: WorkflowInstance): Promise<void> {
    const instances = await this.listInstances();
    const idx = instances.findIndex((i) => i.id === instance.id);
    if (idx >= 0) {
      instances[idx] = instance;
    } else {
      instances.push(instance);
    }
    await FileStorageService.writeJson(FileStorageService.getWorkflowInstancesPath(), instances);
  }

  static async listTransitions(instanceId: string): Promise<WorkflowTransitionRecord[]> {
    return FileStorageService.readJson<WorkflowTransitionRecord[]>(
      FileStorageService.getWorkflowTransitionsPath(instanceId),
      []
    );
  }

  static async addTransition(record: WorkflowTransitionRecord): Promise<void> {
    await FileStorageService.appendJson(FileStorageService.getWorkflowTransitionsPath(record.instanceId), record);
  }

  static async listNotifications(recipientId?: string): Promise<WorkflowNotification[]> {
    const all = await FileStorageService.readJson<WorkflowNotification[]>(
      FileStorageService.getWorkflowNotificationsPath(),
      []
    );
    if (!recipientId) return all;
    return all.filter((n) => n.recipientId === recipientId);
  }

  static async getNotification(id: string): Promise<WorkflowNotification | null> {
    const notifications = await FileStorageService.readJson<WorkflowNotification[]>(
      FileStorageService.getWorkflowNotificationsPath(),
      []
    );
    return notifications.find((n) => n.id === id) || null;
  }

  static async saveNotification(notification: WorkflowNotification): Promise<void> {
    const notifications = await FileStorageService.readJson<WorkflowNotification[]>(
      FileStorageService.getWorkflowNotificationsPath(),
      []
    );
    const idx = notifications.findIndex((n) => n.id === notification.id);
    if (idx >= 0) {
      notifications[idx] = notification;
    } else {
      notifications.push(notification);
    }
    await FileStorageService.writeJson(FileStorageService.getWorkflowNotificationsPath(), notifications);
  }

  static async markNotificationRead(id: string): Promise<boolean> {
    const notifications = await FileStorageService.readJson<WorkflowNotification[]>(
      FileStorageService.getWorkflowNotificationsPath(),
      []
    );
    const idx = notifications.findIndex((n) => n.id === id);
    if (idx < 0) return false;
    notifications[idx] = {
      ...notifications[idx],
      read: true,
      readAt: new Date().toISOString(),
    };
    await FileStorageService.writeJson(FileStorageService.getWorkflowNotificationsPath(), notifications);
    return true;
  }

  static async listReviewerRoles(): Promise<ReviewerRole[]> {
    return FileStorageService.readJson<ReviewerRole[]>(FileStorageService.getReviewerRolesPath(), []);
  }

  static async saveReviewerRole(role: ReviewerRole): Promise<void> {
    const roles = await this.listReviewerRoles();
    const idx = roles.findIndex((r) => r.id === role.id);
    if (idx >= 0) {
      roles[idx] = role;
    } else {
      roles.push(role);
    }
    await FileStorageService.writeJson(FileStorageService.getReviewerRolesPath(), roles);
  }
}
