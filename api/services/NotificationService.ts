import type {
  WorkflowNotification,
  WorkflowInstance,
  WorkflowStageType,
} from '../../shared/types.js';
import { WorkflowStorageService } from './WorkflowStorageService.js';

function genId() {
  return `notif_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class NotificationService {
  static async createNotification(params: {
    instanceId: string;
    docId: string;
    recipientId: string;
    recipientName: string;
    recipientEmail?: string;
    type: WorkflowNotification['type'];
    message: string;
    stageType?: WorkflowStageType;
    stageName?: string;
  }): Promise<WorkflowNotification> {
    const now = new Date().toISOString();
    const notification: WorkflowNotification = {
      id: genId(),
      instanceId: params.instanceId,
      docId: params.docId,
      recipientId: params.recipientId,
      recipientName: params.recipientName,
      recipientEmail: params.recipientEmail,
      type: params.type,
      message: params.message,
      stageType: params.stageType,
      stageName: params.stageName,
      read: false,
      createdAt: now,
    };
    await WorkflowStorageService.saveNotification(notification);
    return notification;
  }

  static async notifyStageAssigned(
    instance: WorkflowInstance,
    recipientIds: { id: string; name: string; email?: string }[]
  ): Promise<void> {
    const currentStage = instance.stages.find((s) => s.stageType === instance.currentStage);
    await Promise.all(
      recipientIds.map((r) =>
        this.createNotification({
          instanceId: instance.id,
          docId: instance.docId,
          recipientId: r.id,
          recipientName: r.name,
          recipientEmail: r.email,
          type: 'stage_assigned',
          message: `您被指派为【${currentStage?.stageName || instance.currentStageName}】阶段的审批人，请及时处理。`,
          stageType: instance.currentStage,
          stageName: currentStage?.stageName || instance.currentStageName,
        })
      )
    );
  }

  static async notifyWorkflowCompleted(instance: WorkflowInstance, initiatorId: string, initiatorName: string): Promise<void> {
    await this.createNotification({
      instanceId: instance.id,
      docId: instance.docId,
      recipientId: initiatorId,
      recipientName: initiatorName,
      type: 'workflow_completed',
      message: '您发起的文档审批流程已全部通过，流程完成。',
    });
  }

  static async notifyWorkflowRejected(
    instance: WorkflowInstance,
    initiatorId: string,
    initiatorName: string,
    stageName: string
  ): Promise<void> {
    await this.createNotification({
      instanceId: instance.id,
      docId: instance.docId,
      recipientId: initiatorId,
      recipientName: initiatorName,
      type: 'workflow_rejected',
      message: `您发起的文档审批流程在【${stageName}】阶段被驳回。`,
      stageType: instance.currentStage,
      stageName,
    });
  }

  static async listByRecipient(recipientId: string): Promise<WorkflowNotification[]> {
    return WorkflowStorageService.listNotifications(recipientId);
  }

  static async markRead(id: string): Promise<boolean> {
    return WorkflowStorageService.markNotificationRead(id);
  }
}
