import type {
  WorkflowConfig,
  WorkflowInstance,
  WorkflowStageConfig,
  TransitionAction,
  ReviewerRole,
} from '../../shared/types.js';
import { WorkflowStorageService } from './WorkflowStorageService.js';
import { AuditLogService } from './AuditLogService.js';
import { NotificationService } from './NotificationService.js';
import {
  evaluateApproval,
  hasRejection,
  canSubmitApproval,
} from './approvalRules.js';
import {
  createInstanceStages,
  applyStageTransition,
  addApprovalToStage,
  rollbackStage,
  calculateProgress,
  canTransition,
  getStageName,
  getCurrentStageConfig,
} from './stateMachine.js';

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class WorkflowEngineService {
  static async ensureDefaultConfig(): Promise<WorkflowConfig> {
    const existing = await WorkflowStorageService.getDefaultConfig();
    if (existing) return existing;

    const reviewerRoles: ReviewerRole[] = [
      { id: 'author', name: '文档作者', description: '创建文档的用户' },
      { id: 'reviewer_l1', name: '一级审阅人', description: '初审阶段审阅人' },
      { id: 'reviewer_l2', name: '二级审阅人', description: '复审阶段审阅人' },
      { id: 'reviewer_final', name: '终审人', description: '最终审批人' },
    ];
    await Promise.all(reviewerRoles.map((r) => WorkflowStorageService.saveReviewerRole(r)));

    const stages: WorkflowStageConfig[] = [
      {
        id: genId('stage'),
        stageType: 'draft',
        name: '草稿',
        description: '文档创建与编辑阶段',
        order: 0,
        reviewerRoles: ['author'],
        approvalMode: 'any',
      },
      {
        id: genId('stage'),
        stageType: 'first_review',
        name: '初审',
        description: '一级审阅人进行初步审核',
        order: 1,
        reviewerRoles: ['reviewer_l1'],
        approvalMode: 'any',
      },
      {
        id: genId('stage'),
        stageType: 'second_review',
        name: '复审',
        description: '二级审阅人进行详细审核',
        order: 2,
        reviewerRoles: ['reviewer_l2'],
        approvalMode: 'all',
        minApprovalCount: 1,
      },
      {
        id: genId('stage'),
        stageType: 'final_review',
        name: '终审',
        description: '终审人进行最终审批',
        order: 3,
        reviewerRoles: ['reviewer_final'],
        approvalMode: 'any',
      },
    ];

    const config: WorkflowConfig = {
      id: genId('cfg'),
      name: '标准四阶段审批流程',
      description: '草稿 → 初审 → 复审 → 终审，共四个阶段的标准文档审批流程',
      version: 1,
      stages,
      transitions: [
        { fromStage: 'draft', toStage: 'first_review', action: 'submit' },
        { fromStage: 'first_review', toStage: 'second_review', action: 'approve' },
        { fromStage: 'first_review', toStage: 'draft', action: 'reject' },
        { fromStage: 'second_review', toStage: 'final_review', action: 'approve' },
        { fromStage: 'second_review', toStage: 'first_review', action: 'reject' },
        { fromStage: 'final_review', toStage: 'completed', action: 'approve' },
        { fromStage: 'final_review', toStage: 'second_review', action: 'reject' },
      ],
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await WorkflowStorageService.saveConfig(config);

    await AuditLogService.createEntry({
      action: 'config_update',
      entityType: 'workflow_config',
      entityId: config.id,
      operatorId: 'system',
      operatorName: '系统初始化',
      afterState: config as unknown as Record<string, unknown>,
      comment: '创建默认工作流配置',
    });

    return config;
  }

  static async listConfigs(): Promise<WorkflowConfig[]> {
    return WorkflowStorageService.listConfigs();
  }

  static async listReviewerRoles(): Promise<ReviewerRole[]> {
    return WorkflowStorageService.listReviewerRoles();
  }

  static async createInstance(params: {
    docId: string;
    initiatorId: string;
    initiatorName: string;
    configId?: string;
  }): Promise<WorkflowInstance> {
    const config = params.configId
      ? await WorkflowStorageService.getConfig(params.configId)
      : await this.ensureDefaultConfig();
    if (!config) throw new Error('工作流配置不存在');

    const existing = await WorkflowStorageService.getInstanceByDocId(params.docId);
    if (existing) throw new Error('该文档已存在工作流实例');

    const now = new Date().toISOString();
    const instance: WorkflowInstance = {
      id: genId('wf'),
      docId: params.docId,
      configId: config.id,
      configVersion: config.version,
      currentStage: 'draft',
      currentStageName: '草稿',
      stages: createInstanceStages(config),
      status: 'running',
      initiatorId: params.initiatorId,
      initiatorName: params.initiatorName,
      createdAt: now,
      updatedAt: now,
    };

    await WorkflowStorageService.saveInstance(instance);

    await AuditLogService.createEntry({
      action: 'instance_create',
      entityType: 'workflow_instance',
      entityId: instance.id,
      operatorId: params.initiatorId,
      operatorName: params.initiatorName,
      afterState: instance as unknown as Record<string, unknown>,
      comment: '创建工作流实例',
    });

    return instance;
  }

  static async getInstance(id: string): Promise<WorkflowInstance | null> {
    return WorkflowStorageService.getInstance(id);
  }

  static async getInstanceByDocId(docId: string): Promise<WorkflowInstance | null> {
    return WorkflowStorageService.getInstanceByDocId(docId);
  }

  static async getProgress(instanceId: string) {
    const instance = await WorkflowStorageService.getInstance(instanceId);
    if (!instance) return null;

    const config = await WorkflowStorageService.getConfig(instance.configId);
    if (!config) return null;

    return calculateProgress(instance, config);
  }

  static async getApprovalStatus(instanceId: string) {
    const instance = await WorkflowStorageService.getInstance(instanceId);
    if (!instance) return null;

    const config = await WorkflowStorageService.getConfig(instance.configId);
    if (!config) return null;

    const stageConfig = getCurrentStageConfig(config, instance.currentStage);
    if (!stageConfig) return null;

    const currentStage = instance.stages.find((s) => s.stageType === instance.currentStage);
    if (!currentStage) return null;

    return evaluateApproval(currentStage.approvals, stageConfig.approvalMode, stageConfig.minApprovalCount);
  }

  static async getTransitionHistory(instanceId: string) {
    return WorkflowStorageService.listTransitions(instanceId);
  }

  static async submitApproval(params: {
    instanceId: string;
    reviewerId: string;
    reviewerName: string;
    reviewerEmail?: string;
    reviewerRole: string;
    decision: 'approved' | 'rejected';
    comment?: string;
  }): Promise<WorkflowInstance> {
    const instance = await WorkflowStorageService.getInstance(params.instanceId);
    if (!instance) throw new Error('工作流实例不存在');
    if (instance.status !== 'running') throw new Error('工作流已结束，无法审批');

    const config = await WorkflowStorageService.getConfig(instance.configId);
    if (!config) throw new Error('工作流配置不存在');

    const stageConfig = getCurrentStageConfig(config, instance.currentStage);
    if (!stageConfig) throw new Error('当前阶段配置不存在');

    if (!stageConfig.reviewerRoles.includes(params.reviewerRole)) {
      throw new Error(`您的角色（${params.reviewerRole}）无权审批当前阶段`);
    }

    const currentStage = instance.stages.find((s) => s.stageType === instance.currentStage);
    if (!currentStage) throw new Error('当前阶段不存在');

    const submitCheck = canSubmitApproval(currentStage.approvals, params.reviewerId, params.reviewerRole);
    if (!submitCheck.allowed) {
      throw new Error(submitCheck.reason || '无法提交审批');
    }

    const beforeState = JSON.parse(JSON.stringify(instance)) as Record<string, unknown>;

    let updated = addApprovalToStage(instance, instance.currentStage, {
      reviewerId: params.reviewerId,
      reviewerName: params.reviewerName,
      reviewerEmail: params.reviewerEmail,
      reviewerRole: params.reviewerRole,
      decision: params.decision,
      comment: params.comment,
    });

    await AuditLogService.createEntry({
      action: 'approval_submit',
      entityType: 'stage_approval',
      entityId: updated.id,
      operatorId: params.reviewerId,
      operatorName: params.reviewerName,
      beforeState,
      afterState: updated as unknown as Record<string, unknown>,
      comment: `${params.reviewerName} 在【${currentStage.stageName}】阶段提交了【${params.decision === 'approved' ? '通过' : '驳回'}】的审批意见`,
    });

    const evalResult = evaluateApproval(
      updated.stages.find((s) => s.stageType === updated.currentStage)!.approvals,
      stageConfig.approvalMode,
      stageConfig.minApprovalCount
    );

    if (evalResult.transitionAction === 'approve' || evalResult.transitionAction === 'reject') {
      updated = await this.transitionStage({
        instance: updated,
        action: evalResult.transitionAction as TransitionAction,
        operatorId: params.reviewerId,
        operatorName: params.reviewerName,
        comment: evalResult.reason,
      });
    } else {
      await WorkflowStorageService.saveInstance(updated);
    }

    return updated;
  }

  static async submitForReview(params: {
    instanceId: string;
    operatorId: string;
    operatorName: string;
    comment?: string;
  }): Promise<WorkflowInstance> {
    const instance = await WorkflowStorageService.getInstance(params.instanceId);
    if (!instance) throw new Error('工作流实例不存在');
    if (instance.status !== 'running') throw new Error('工作流已结束');
    if (instance.currentStage !== 'draft') throw new Error('仅草稿阶段可提交审核');

    return this.transitionStage({
      instance,
      action: 'submit',
      operatorId: params.operatorId,
      operatorName: params.operatorName,
      comment: params.comment,
    });
  }

  private static async transitionStage(params: {
    instance: WorkflowInstance;
    action: TransitionAction;
    operatorId: string;
    operatorName: string;
    comment?: string;
  }): Promise<WorkflowInstance> {
    const { instance, action, operatorId, operatorName, comment } = params;
    const config = await WorkflowStorageService.getConfig(instance.configId);
    if (!config) throw new Error('工作流配置不存在');

    const transitionCheck = canTransition(config, instance.currentStage, action);
    if (!transitionCheck.allowed || !transitionCheck.toStage) {
      throw new Error(transitionCheck.reason || '不允许执行此操作');
    }

    const fromStage = instance.currentStage;
    const toStage = transitionCheck.toStage;

    const beforeState = JSON.parse(JSON.stringify(instance)) as Record<string, unknown>;

    let updated = applyStageTransition(instance, fromStage, toStage);

    await WorkflowStorageService.saveInstance(updated);

    const record = {
      id: genId('tr'),
      instanceId: updated.id,
      fromStage,
      toStage,
      action,
      operatorId,
      operatorName,
      comment,
      timestamp: updated.updatedAt,
    };
    await WorkflowStorageService.addTransition(record);

    await AuditLogService.createEntry({
      action: 'stage_transition',
      entityType: 'workflow_instance',
      entityId: updated.id,
      operatorId,
      operatorName,
      beforeState,
      afterState: updated as unknown as Record<string, unknown>,
      comment: `从【${getStageName(fromStage)}】流转到【${getStageName(toStage)}】，操作：${action}`,
    });

    if (toStage === 'completed') {
      await NotificationService.notifyWorkflowCompleted(updated, updated.initiatorId, updated.initiatorName);
    } else if (action === 'reject') {
      await NotificationService.notifyWorkflowRejected(
        updated,
        updated.initiatorId,
        updated.initiatorName,
        getStageName(fromStage)
      );
    } else {
      const nextStageConfig = config.stages.find((s) => s.stageType === toStage);
      if (nextStageConfig) {
        const recipients = nextStageConfig.reviewerRoles.map((roleId, idx) => ({
          id: `user_${roleId}_${idx}`,
          name: `${roleId} 用户`,
          email: undefined,
        }));
        await NotificationService.notifyStageAssigned(updated, recipients);
      }
    }

    return updated;
  }

  static async rollback(params: {
    instanceId: string;
    operatorId: string;
    operatorName: string;
    comment?: string;
  }): Promise<WorkflowInstance> {
    const instance = await WorkflowStorageService.getInstance(params.instanceId);
    if (!instance) throw new Error('工作流实例不存在');
    if (instance.status !== 'running') throw new Error('工作流已结束');

    const transitionCheck = canTransition(
      { transitions: [] } as unknown as WorkflowConfig,
      instance.currentStage,
      'rollback'
    );
    if (!transitionCheck.allowed || !transitionCheck.toStage) {
      throw new Error(transitionCheck.reason || '无法回退');
    }

    const fromStage = instance.currentStage;
    const toStage = transitionCheck.toStage;
    const beforeState = JSON.parse(JSON.stringify(instance)) as Record<string, unknown>;

    let updated = rollbackStage(instance, toStage);

    await WorkflowStorageService.saveInstance(updated);

    const record = {
      id: genId('tr'),
      instanceId: updated.id,
      fromStage,
      toStage,
      action: 'rollback' as const,
      operatorId: params.operatorId,
      operatorName: params.operatorName,
      comment: params.comment,
      timestamp: updated.updatedAt,
    };
    await WorkflowStorageService.addTransition(record);

    await AuditLogService.createEntry({
      action: 'stage_transition',
      entityType: 'workflow_instance',
      entityId: updated.id,
      operatorId: params.operatorId,
      operatorName: params.operatorName,
      beforeState,
      afterState: updated as unknown as Record<string, unknown>,
      comment: `手动回退：从【${getStageName(fromStage)}】回退到【${getStageName(toStage)}】`,
    });

    return updated;
  }

  static async listInstances(): Promise<WorkflowInstance[]> {
    return WorkflowStorageService.listInstances();
  }
}
