import type {
  WorkflowStageType,
  ApprovalMode,
  StageApproval,
} from '../types';

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

export const STAGE_ICONS: Record<WorkflowStageType, string> = {
  draft: '📝',
  first_review: '🔍',
  second_review: '📋',
  final_review: '✅',
  completed: '🎉',
  rejected: '❌',
};

export function getStageName(stageType: WorkflowStageType): string {
  return STAGE_NAMES[stageType] || stageType;
}

export function getStageIcon(stageType: WorkflowStageType): string {
  return STAGE_ICONS[stageType] || '📄';
}

export function getStageOrder(stageType: WorkflowStageType): number {
  return STAGE_ORDER.indexOf(stageType);
}

export function isStageBefore(a: WorkflowStageType, b: WorkflowStageType): boolean {
  return getStageOrder(a) < getStageOrder(b);
}

export function isStageAfter(a: WorkflowStageType, b: WorkflowStageType): boolean {
  return getStageOrder(a) > getStageOrder(b);
}

export function getNextStage(stageType: WorkflowStageType): WorkflowStageType | null {
  const idx = STAGE_ORDER.indexOf(stageType);
  return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
}

export function getPreviousStage(stageType: WorkflowStageType): WorkflowStageType | null {
  const idx = STAGE_ORDER.indexOf(stageType);
  return idx > 0 ? STAGE_ORDER[idx - 1] : null;
}

export function formatApprovalMode(mode: ApprovalMode, minCount?: number): string {
  if (mode === 'any') return '或签（任意一人通过即可）';
  if (minCount !== undefined && minCount > 0) return `会签（至少 ${minCount} 人通过）`;
  return '会签（所有人通过）';
}

export function getApprovalStats(approvals: StageApproval[]) {
  const approved = approvals.filter((a) => a.decision === 'approved');
  const rejected = approvals.filter((a) => a.decision === 'rejected');
  const pending = approvals.filter((a) => a.decision === 'pending');
  return {
    total: approvals.length,
    approved: approved.length,
    rejected: rejected.length,
    pending: pending.length,
  };
}

export function getApprovalStatusText(approvals: StageApproval[], mode: ApprovalMode, minCount?: number): string {
  const stats = getApprovalStats(approvals);
  if (stats.rejected > 0) {
    return `已驳回：${stats.rejected} 人`;
  }
  if (mode === 'any') {
    if (stats.approved > 0) return `已通过：${stats.approved} 人`;
    return `等待审批：共需至少 1 人通过`;
  }
  const threshold = minCount ?? stats.total;
  if (minCount !== undefined && minCount > 0) {
    if (stats.approved >= threshold) return `已通过：${stats.approved}/${threshold} 人`;
    return `等待审批：${stats.approved}/${threshold} 人`;
  }
  if (stats.approved >= stats.total) return `已全部通过：${stats.approved}/${stats.total} 人`;
  return `等待审批：${stats.approved}/${stats.total} 人`;
}

export function getActionName(action: string): string {
  const names: Record<string, string> = {
    submit: '提交审核',
    approve: '审批通过',
    reject: '审批驳回',
    rollback: '手动回退',
  };
  return names[action] || action;
}

export function getActionColor(action: string): string {
  const colors: Record<string, string> = {
    submit: 'text-blue-600',
    approve: 'text-emerald-600',
    reject: 'text-red-600',
    rollback: 'text-amber-600',
  };
  return colors[action] || 'text-gray-600';
}

export function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString).getTime();
    const now = Date.now();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return formatTime(isoString);
  } catch {
    return isoString;
  }
}

export interface StageStatusConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export function getStageStatusConfig(status: string): StageStatusConfig {
  switch (status) {
    case 'completed':
      return { label: '已完成', color: 'text-emerald-700', bgColor: 'bg-emerald-100', borderColor: 'border-emerald-300' };
    case 'in_progress':
      return { label: '进行中', color: 'text-blue-700', bgColor: 'bg-blue-100', borderColor: 'border-blue-300' };
    case 'pending':
      return { label: '待处理', color: 'text-gray-600', bgColor: 'bg-gray-100', borderColor: 'border-gray-300' };
    case 'rejected':
      return { label: '已驳回', color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-300' };
    case 'skipped':
      return { label: '已跳过', color: 'text-gray-500', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' };
    default:
      return { label: status, color: 'text-gray-600', bgColor: 'bg-gray-100', borderColor: 'border-gray-300' };
  }
}
