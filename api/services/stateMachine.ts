import type {
  WorkflowStageType,
  WorkflowTransition,
  WorkflowConfig,
  WorkflowInstance,
  WorkflowInstanceStage,
  StageApproval,
  WorkflowProgress,
} from '../../shared/types.js';

export const STAGE_ORDER: WorkflowStageType[] = [
  'draft',
  'first_review',
  'second_review',
  'final_review',
  'completed',
];

export const STAGE_NAMES: Record<WorkflowStageType, string> = {
  draft: '草稿',
  first_review: '初审',
  second_review: '复审',
  final_review: '终审',
  completed: '已完成',
  rejected: '已驳回',
};

export function getStageName(stageType: WorkflowStageType): string {
  return STAGE_NAMES[stageType] || stageType;
}

export function getStageOrder(stageType: WorkflowStageType): number {
  return STAGE_ORDER.indexOf(stageType);
}

export function getNextStage(stageType: WorkflowStageType): WorkflowStageType | null {
  const idx = STAGE_ORDER.indexOf(stageType);
  return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
}

export function getPreviousStage(stageType: WorkflowStageType): WorkflowStageType | null {
  const idx = STAGE_ORDER.indexOf(stageType);
  return idx > 0 ? STAGE_ORDER[idx - 1] : null;
}

export function findValidTransition(
  transitions: WorkflowTransition[],
  fromStage: WorkflowStageType,
  action: 'approve' | 'reject' | 'submit' | 'rollback'
): WorkflowTransition | null {
  return transitions.find((t) => t.fromStage === fromStage && t.action === action) || null;
}

export function canTransition(
  config: WorkflowConfig,
  fromStage: WorkflowStageType,
  action: 'approve' | 'reject' | 'submit' | 'rollback'
): { allowed: boolean; toStage?: WorkflowStageType; reason?: string } {
  if (action === 'rollback') {
    const prev = getPreviousStage(fromStage);
    if (!prev) {
      return { allowed: false, reason: '当前已是第一阶段，无法回退' };
    }
    return { allowed: true, toStage: prev };
  }

  const transition = findValidTransition(config.transitions, fromStage, action);
  if (!transition) {
    return { allowed: false, reason: `不允许从【${getStageName(fromStage)}】执行操作【${action}】` };
  }
  return { allowed: true, toStage: transition.toStage };
}

export function createInstanceStages(config: WorkflowConfig): WorkflowInstanceStage[] {
  return config.stages.sort((a, b) => a.order - b.order).map((s) => ({
    stageType: s.stageType,
    stageName: s.name,
    approvals: [],
    status: s.stageType === 'draft' ? 'in_progress' : 'pending',
    startedAt: s.stageType === 'draft' ? new Date().toISOString() : undefined,
  }));
}

export function applyStageTransition(
  instance: WorkflowInstance,
  fromStage: WorkflowStageType,
  toStage: WorkflowStageType
): WorkflowInstance {
  const now = new Date().toISOString();
  const updated = JSON.parse(JSON.stringify(instance)) as WorkflowInstance;

  const fromIdx = updated.stages.findIndex((s) => s.stageType === fromStage);
  if (fromIdx >= 0) {
    updated.stages[fromIdx].status = 'completed';
    updated.stages[fromIdx].completedAt = now;
  }

  const toIdx = updated.stages.findIndex((s) => s.stageType === toStage);
  if (toIdx >= 0) {
    updated.stages[toIdx].status = 'in_progress';
    updated.stages[toIdx].startedAt = now;
    updated.stages[toIdx].completedAt = undefined;
  }

  updated.currentStage = toStage;
  updated.currentStageName = getStageName(toStage);
  updated.updatedAt = now;

  if (toStage === 'completed') {
    updated.status = 'completed';
    updated.completedAt = now;
  }

  return updated;
}

export function addApprovalToStage(
  instance: WorkflowInstance,
  stageType: WorkflowStageType,
  approval: Omit<StageApproval, 'id' | 'decidedAt'>
): WorkflowInstance {
  const now = new Date().toISOString();
  const updated = JSON.parse(JSON.stringify(instance)) as WorkflowInstance;

  const stageIdx = updated.stages.findIndex((s) => s.stageType === stageType);
  if (stageIdx < 0) return updated;

  const existingIdx = updated.stages[stageIdx].approvals.findIndex(
    (a) => a.reviewerId === approval.reviewerId && a.reviewerRole === approval.reviewerRole
  );

  if (existingIdx >= 0) {
    updated.stages[stageIdx].approvals[existingIdx] = {
      ...updated.stages[stageIdx].approvals[existingIdx],
      ...approval,
      decidedAt: now,
    };
  } else {
    updated.stages[stageIdx].approvals.push({
      ...approval,
      id: `apr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      decidedAt: now,
    });
  }

  updated.updatedAt = now;
  return updated;
}

export function rollbackStage(
  instance: WorkflowInstance,
  toStage: WorkflowStageType
): WorkflowInstance {
  const now = new Date().toISOString();
  const updated = JSON.parse(JSON.stringify(instance)) as WorkflowInstance;

  const currentIdx = updated.stages.findIndex((s) => s.stageType === instance.currentStage);
  if (currentIdx >= 0) {
    updated.stages[currentIdx].status = 'pending';
    updated.stages[currentIdx].approvals = [];
    updated.stages[currentIdx].startedAt = undefined;
    updated.stages[currentIdx].completedAt = undefined;
  }

  const targetIdx = updated.stages.findIndex((s) => s.stageType === toStage);
  if (targetIdx >= 0) {
    updated.stages[targetIdx].status = 'in_progress';
    updated.stages[targetIdx].startedAt = now;
    updated.stages[targetIdx].completedAt = undefined;
  }

  updated.currentStage = toStage;
  updated.currentStageName = getStageName(toStage);
  updated.updatedAt = now;

  return updated;
}

export function calculateProgress(
  instance: WorkflowInstance,
  config: WorkflowConfig
): WorkflowProgress {
  const sortedStages = [...config.stages].sort((a, b) => a.order - b.order);

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

  const completedStages = progressStages.filter(
    (s) => s.status === 'completed' || s.status === 'skipped'
  ).length;
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

export function getCurrentStageConfig(
  config: WorkflowConfig,
  stageType: WorkflowStageType
) {
  return config.stages.find((s) => s.stageType === stageType) || null;
}

export function getStageReviewerRoleNames(config: WorkflowConfig, stageType: WorkflowStageType): string[] {
  const stageConfig = getCurrentStageConfig(config, stageType);
  return stageConfig?.reviewerRoles || [];
}
