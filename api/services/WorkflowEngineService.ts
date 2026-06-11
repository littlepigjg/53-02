import type {
  WorkflowConfig,
  WorkflowInstance,
  WorkflowInstanceStage,
  WorkflowStageConfig,
  WorkflowStageType,
  WorkflowTransitionRecord,
  WorkflowProgress,
  StageApproval,
  ApprovalMode,
  TransitionAction,
  ReviewerRole,
} from '../../shared/types.js';
import { WorkflowStorageService } from './WorkflowStorageService.js';
import { AuditLogService } from './AuditLogService.js';
import { NotificationService } from './NotificationService.js';

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const STAGE_ORDER: WorkflowStageType[] = ['draft', 'first_review', 'second_review', 'final_review', 'completed'];

const STAGE_NAMES: Record<WorkflowStageType, string> = {
  draft: '草稿',
  first_review: '初审',
  second_review: '复审',
  final_review: '终审',
  completed: '已完成',
  rejected: '已驳回',
};

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
    const instanceStages: WorkflowInstanceStage[] = config.stages
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        stageType: s.stageType,
        stageName: s.name,
        approvals: [],
        status: s.stageType === 'draft' ? 'in_progress' : 'pending',
        startedAt: s.stageType === 'draft' ? now : undefined,
      }));

    const instance: WorkflowInstance = {
      id: genId('wf'),
      docId: params.docId,
      configId: config.id,
      configVersion: config.version,
      currentStage: 'draft',
      currentStageName: '草稿',
      stages: instanceStages,
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

  static async getProgress(instanceId: string): Promise<WorkflowProgress | null> {
    const instance = await WorkflowStorageService.getInstance(instanceId);
    if (!instance) return null;

    const config = await WorkflowStorageService.getConfig(instance.configId);
    const sortedStages = config?.stages.sort((a, b) => a.order - b.order) || [];

    const progressStages = sortedStages.map((s) => {
      const instStage = instance.stages.find((is) => is.stageType === s.stageType);
      return {
        stageType: s.stageType,
        stageName: s.name,
        status: instStage?.status || 'pending',
        order: s.order,
        approvals: instStage?.approvals || [],
      };
    });

    const completedStages = progressStages.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
    const totalStages = sortedStages.length;

    return {
      instanceId: instance.id,
      currentStage: instance.currentStage,
      currentStageName: instance.currentStageName,
      totalStages,
      completedStages,
      progressPercentage: Math.round((completedStages / totalStages) * 100),
      stages: progressStages,
    };
  }

  static async getTransitionHistory(instanceId: string): Promise<WorkflowTransitionRecord[]> {
    return WorkflowStorageService.listTransitions(instanceId);
  }

  private static async getStageConfig(instance: WorkflowInstance, stageType: WorkflowStageType): Promise<WorkflowStageConfig | null> {
    const config = await WorkflowStorageService.getConfig(instance.configId);
    return config?.stages.find((s) => s.stageType === stageType) || null;
  }

  private static isStageApprovalComplete(
    approvals: StageApproval[],
    mode: ApprovalMode,
    minCount?: number
  ): boolean {
    const approved = approvals.filter((a) => a.decision === 'approved');
    const rejected = approvals.filter((a) => a.decision === 'rejected');
    if (rejected.length > 0) return false;
    if (mode === 'any') return approved.length > 0;
    const threshold = minCount || approvals.length;
    return approved.length >= threshold && approvals.every((a) => a.decision === 'approved');
  }

  private static hasRejection(approvals: StageApproval[]): boolean {
    return approvals.some((a) => a.decision === 'rejected');
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

    const stageConfig = await this.getStageConfig(instance, instance.currentStage);
    if (!stageConfig) throw new Error('当前阶段配置不存在');

    if (!stageConfig.reviewerRoles.includes(params.reviewerRole)) {
      throw new Error(`您的角色（${params.reviewerRole}）无权审批当前阶段`);
    }

    const currentStageIdx = instance.stages.findIndex((s) => s.stageType === instance.currentStage);
    if (currentStageIdx < 0) throw new Error('当前阶段不存在');

    const now = new Date().toISOString();
    const currentStage = instance.stages[currentStageIdx];

    const existingApproval = currentStage.approvals.find(
      (a) => a.reviewerId === params.reviewerId && a.reviewerRole === params.reviewerRole
    );

    const beforeState = JSON.parse(JSON.stringify(instance)) as Record<string, unknown>;

    if (existingApproval) {
      existingApproval.decision = params.decision;
      existingApproval.comment = params.comment;
      existingApproval.decidedAt = now;
    } else {
      currentStage.approvals.push({
        id: genId('apr'),
        reviewerId: params.reviewerId,
        reviewerName: params.reviewerName,
        reviewerEmail: params.reviewerEmail,
        reviewerRole: params.reviewerRole,
        decision: params.decision,
        comment: params.comment,
        decidedAt: now,
      });
    }

    await AuditLogService.createEntry({
      action: 'approval_submit',
      entityType: 'stage_approval',
      entityId: instance.id,
      operatorId: params.reviewerId,
      operatorName: params.reviewerName,
      beforeState,
      afterState: instance as unknown as Record<string, unknown>,
      comment: `${params.reviewerName} 在【${currentStage.stageName}】阶段提交了【${params.decision === 'approved' ? '通过' : '驳回'}】的审批意见`,
    });

    const action: TransitionAction = this.hasRejection(currentStage.approvals)
      ? 'reject'
      : this.isStageApprovalComplete(currentStage.approvals, stageConfig.approvalMode, stageConfig.minApprovalCount)
      ? 'approve'
      : 'submit';

    if (action === 'approve' || action === 'reject') {
      await this.transitionStage({
        instance,
        action,
        operatorId: params.reviewerId,
        operatorName: params.reviewerName,
        comment: params.comment,
      });
    } else {
      instance.updatedAt = now;
      await WorkflowStorageService.saveInstance(instance);
    }

    return instance;
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

    const beforeState = JSON.parse(JSON.stringify(instance)) as Record<string, unknown>;

    const transition = config.transitions.find(
      (t) => t.fromStage === instance.currentStage && t.action === action
    );
    if (!transition) {
      throw new Error(`不允许从【${STAGE_NAMES[instance.currentStage]}】执行操作【${action}】`);
    }

    const fromStage = instance.currentStage;
    const toStage = transition.toStage;
    const now = new Date().toISOString();

    const currentStageIdx = instance.stages.findIndex((s) => s.stageType === fromStage);
    if (currentStageIdx >= 0) {
      instance.stages[currentStageIdx].status = 'completed';
      instance.stages[currentStageIdx].completedAt = now;
    }

    const nextStageIdx = instance.stages.findIndex((s) => s.stageType === toStage);
    if (nextStageIdx >= 0) {
      instance.stages[nextStageIdx].status = 'in_progress';
      instance.stages[nextStageIdx].startedAt = now;
    }

    instance.currentStage = toStage;
    instance.currentStageName = STAGE_NAMES[toStage] || toStage;
    instance.updatedAt = now;

    if (toStage === 'completed') {
      instance.status = 'completed';
      instance.completedAt = now;
    }

    await WorkflowStorageService.saveInstance(instance);

    const record: WorkflowTransitionRecord = {
      id: genId('tr'),
      instanceId: instance.id,
      fromStage,
      toStage,
      action,
      operatorId,
      operatorName,
      comment,
      timestamp: now,
    };
    await WorkflowStorageService.addTransition(record);

    await AuditLogService.createEntry({
      action: 'stage_transition',
      entityType: 'workflow_instance',
      entityId: instance.id,
      operatorId,
      operatorName,
      beforeState,
      afterState: instance as unknown as Record<string, unknown>,
      comment: `从【${STAGE_NAMES[fromStage]}】流转到【${STAGE_NAMES[toStage]}】，操作：${action}`,
    });

    if (toStage === 'completed') {
      await NotificationService.notifyWorkflowCompleted(instance, instance.initiatorId, instance.initiatorName);
    } else if (action === 'reject') {
      await NotificationService.notifyWorkflowRejected(
        instance,
        instance.initiatorId,
        instance.initiatorName,
        STAGE_NAMES[fromStage]
      );
    } else {
      const nextStageConfig = config.stages.find((s) => s.stageType === toStage);
      if (nextStageConfig) {
        const recipients = nextStageConfig.reviewerRoles.map((roleId, idx) => ({
          id: `user_${roleId}_${idx}`,
          name: `${roleId} 用户`,
          email: undefined,
        }));
        await NotificationService.notifyStageAssigned(instance, recipients);
      }
    }

    return instance;
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

    const currentOrder = STAGE_ORDER.indexOf(instance.currentStage);
    if (currentOrder <= 0) throw new Error('当前已是第一阶段，无法回退');

    const prevStage = STAGE_ORDER[currentOrder - 1];
    const beforeState = JSON.parse(JSON.stringify(instance)) as Record<string, unknown>;
    const now = new Date().toISOString();

    const currentStageIdx = instance.stages.findIndex((s) => s.stageType === instance.currentStage);
    if (currentStageIdx >= 0) {
      instance.stages[currentStageIdx].status = 'pending';
      instance.stages[currentStageIdx].approvals = [];
      instance.stages[currentStageIdx].startedAt = undefined;
      instance.stages[currentStageIdx].completedAt = undefined;
    }

    const prevStageIdx = instance.stages.findIndex((s) => s.stageType === prevStage);
    if (prevStageIdx >= 0) {
      instance.stages[prevStageIdx].status = 'in_progress';
      instance.stages[prevStageIdx].startedAt = now;
      instance.stages[prevStageIdx].completedAt = undefined;
    }

    instance.currentStage = prevStage;
    instance.currentStageName = STAGE_NAMES[prevStage] || prevStage;
    instance.updatedAt = now;

    await WorkflowStorageService.saveInstance(instance);

    const record: WorkflowTransitionRecord = {
      id: genId('tr'),
      instanceId: instance.id,
      fromStage: STAGE_ORDER[currentOrder],
      toStage: prevStage,
      action: 'rollback',
      operatorId: params.operatorId,
      operatorName: params.operatorName,
      comment: params.comment,
      timestamp: now,
    };
    await WorkflowStorageService.addTransition(record);

    await AuditLogService.createEntry({
      action: 'stage_transition',
      entityType: 'workflow_instance',
      entityId: instance.id,
      operatorId: params.operatorId,
      operatorName: params.operatorName,
      beforeState,
      afterState: instance as unknown as Record<string, unknown>,
      comment: `手动回退：从【${STAGE_NAMES[STAGE_ORDER[currentOrder]]}】回退到【${STAGE_NAMES[prevStage]}】`,
    });

    return instance;
  }

  static async listInstances(): Promise<WorkflowInstance[]> {
    return WorkflowStorageService.listInstances();
  }
}
