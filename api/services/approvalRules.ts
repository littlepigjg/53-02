import type { StageApproval, ApprovalMode } from '../../shared/types.js';

export interface ApprovalResult {
  canTransition: boolean;
  transitionAction: 'approve' | 'reject' | 'submit' | null;
  reason: string;
  stats: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
  };
}

export function hasRejection(approvals: StageApproval[]): boolean {
  return approvals.some((a) => a.decision === 'rejected');
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

export function evaluateApproval(
  approvals: StageApproval[],
  mode: ApprovalMode,
  minApprovalCount?: number
): ApprovalResult {
  const stats = getApprovalStats(approvals);

  if (stats.rejected > 0) {
    return {
      canTransition: true,
      transitionAction: 'reject',
      reason: `已收到 ${stats.rejected} 个驳回意见`,
      stats,
    };
  }

  if (mode === 'any') {
    if (stats.approved > 0) {
      return {
        canTransition: true,
        transitionAction: 'approve',
        reason: `或签模式：已有 ${stats.approved} 人通过`,
        stats,
      };
    }
    return {
      canTransition: false,
      transitionAction: null,
      reason: `或签模式：等待至少 1 人通过`,
      stats,
    };
  }

  if (mode === 'all') {
    const threshold = minApprovalCount ?? stats.total;

    if (minApprovalCount !== undefined && minApprovalCount > 0) {
      if (stats.approved >= threshold) {
        return {
          canTransition: true,
          transitionAction: 'approve',
          reason: `会签模式：已满足最少通过人数 ${threshold}/${stats.total}`,
          stats,
        };
      }
      return {
        canTransition: false,
        transitionAction: null,
        reason: `会签模式：还需 ${threshold - stats.approved} 人通过 (当前 ${stats.approved}/${threshold})`,
        stats,
      };
    }

    if (stats.approved >= stats.total && stats.total > 0) {
      return {
        canTransition: true,
        transitionAction: 'approve',
        reason: `会签模式：全部 ${stats.total} 人已通过`,
        stats,
      };
    }
    return {
      canTransition: false,
      transitionAction: null,
      reason: `会签模式：等待全部 ${stats.total} 人通过 (当前 ${stats.approved}/${stats.total})`,
      stats,
    };
  }

  return {
    canTransition: false,
    transitionAction: null,
    reason: '未知审批模式',
    stats,
  };
}

export function canSubmitApproval(
  approvals: StageApproval[],
  reviewerId: string,
  reviewerRole: string
): { allowed: boolean; reason?: string } {
  const existing = approvals.find(
    (a) => a.reviewerId === reviewerId && a.reviewerRole === reviewerRole
  );
  if (existing && existing.decision !== 'pending') {
    return { allowed: false, reason: '您已提交过审批意见，如需修改请联系管理员' };
  }
  return { allowed: true };
}

export function formatApprovalMode(mode: ApprovalMode, minCount?: number): string {
  if (mode === 'any') return '或签（任意一人通过即可）';
  if (minCount !== undefined && minCount > 0) return `会签（至少 ${minCount} 人通过）`;
  return '会签（所有人通过）';
}
