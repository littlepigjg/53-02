import { useState, useMemo } from 'react';
import {
  Send,
  CheckCircle2,
  XCircle,
  Undo2,
  User,
  Shield,
  AlertCircle,
  Loader2,
  PlayCircle,
  Info,
} from 'lucide-react';
import type { WorkflowInstance, WorkflowProgress, ReviewerRole } from '../types';
import { useWorkflowStore } from '../store/workflowStore';
import { useReviewStore } from '../store/reviewStore';
import {
  getStageName,
  formatApprovalMode,
  formatTime,
} from '../utils/workflowUtils';

interface WorkflowControlPanelProps {
  instance: WorkflowInstance;
  progress: WorkflowProgress;
  roles: ReviewerRole[];
}

export function WorkflowControlPanel({ instance, progress, roles }: WorkflowControlPanelProps) {
  const { submitForReview, approve, reject, rollback, loading, error } = useWorkflowStore();
  const reviewerName = useReviewStore((s) => s.reviewerName);
  const reviewerEmail = useReviewStore((s) => s.reviewerEmail);

  const [comment, setComment] = useState('');
  const [reviewerRole, setReviewerRole] = useState('');
  const [actionType, setActionType] = useState<'none' | 'submit' | 'approve' | 'reject' | 'rollback'>('none');

  const currentStage = useMemo(
    () => progress.stages.find((s) => s.stageType === instance.currentStage),
    [progress, instance.currentStage]
  );

  const stageConfig = useMemo(() => {
    const stage = progress.stages.find((s) => s.stageType === instance.currentStage);
    return {
      reviewerRoles: currentStage?.stageType === 'draft'
        ? ['author']
        : currentStage?.stageType === 'first_review'
        ? ['reviewer_l1']
        : currentStage?.stageType === 'second_review'
        ? ['reviewer_l2']
        : currentStage?.stageType === 'final_review'
        ? ['reviewer_final']
        : [],
      minApprovalCount: currentStage?.stageType === 'second_review' ? 1 : undefined,
    };
  }, [instance.currentStage, progress, currentStage]);

  const isDraft = instance.currentStage === 'draft';
  const isCompleted = instance.status === 'completed';
  const canRollback = ['first_review', 'second_review', 'final_review'].includes(instance.currentStage);

  const roleMap = useMemo(() => {
    const m: Record<string, ReviewerRole> = {};
    roles.forEach((r) => (m[r.id] = r));
    return m;
  }, [roles]);

  const handleSubmit = async () => {
    if (!reviewerName.trim()) {
      alert('请先在右侧审阅面板填写您的姓名');
      return;
    }
    try {
      await submitForReview(instance.id, {
        operatorId: `user_${reviewerName}`,
        operatorName: reviewerName,
        comment: comment.trim() || undefined,
      });
      setComment('');
      setActionType('none');
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleApprove = async () => {
    if (!validateApproval()) return;
    try {
      await approve(instance.id, {
        reviewerId: `user_${reviewerName}`,
        reviewerName,
        reviewerEmail: reviewerEmail.trim() || undefined,
        reviewerRole,
        comment: comment.trim() || undefined,
      });
      setComment('');
      setActionType('none');
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleReject = async () => {
    if (!validateApproval()) return;
    if (!comment.trim()) {
      alert('驳回请填写原因');
      return;
    }
    try {
      await reject(instance.id, {
        reviewerId: `user_${reviewerName}`,
        reviewerName,
        reviewerEmail: reviewerEmail.trim() || undefined,
        reviewerRole,
        comment: comment.trim(),
      });
      setComment('');
      setActionType('none');
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleRollback = async () => {
    if (!reviewerName.trim()) {
      alert('请先填写您的姓名');
      return;
    }
    if (!comment.trim()) {
      alert('回退请填写原因');
      return;
    }
    try {
      await rollback(instance.id, {
        operatorId: `user_${reviewerName}`,
        operatorName: reviewerName,
        comment: comment.trim(),
      });
      setComment('');
      setActionType('none');
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const validateApproval = (): boolean => {
    if (!reviewerName.trim()) {
      alert('请先在右侧审阅面板填写您的姓名');
      return false;
    }
    if (!reviewerRole) {
      alert('请选择您的审批角色');
      return false;
    }
    return true;
  };

  if (isCompleted) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 size={20} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-emerald-800">审批流程已完成</h3>
            <p className="text-xs text-emerald-600">文档已通过所有阶段的审批</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-[#1e3a5f]" />
          <h3 className="text-sm font-semibold text-slate-800">审批操作</h3>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-[#1e3a5f]/10 px-2.5 py-1">
          <PlayCircle size={12} className="text-[#1e3a5f]" />
          <span className="text-xs font-medium text-[#1e3a5f]">{instance.currentStageName}</span>
        </div>
      </div>

      {currentStage && (
        <div className="mb-4 rounded-lg bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">当前阶段审批信息</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400">阶段：</span>
              <span className="font-medium text-slate-700">{getStageName(currentStage.stageType)}</span>
            </div>
            <div>
              <span className="text-slate-400">审批模式：</span>
              <span className="font-medium text-slate-700">
                {formatApprovalMode(stageConfig?.minApprovalCount !== undefined ? 'all' : 'any', stageConfig?.minApprovalCount)}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400">审批角色：</span>
              <span className="font-medium text-slate-700">
                {stageConfig?.reviewerRoles.map((r) => roleMap[r]?.name || r).join('、') || '—'}
              </span>
            </div>
          </div>
          {currentStage.approvals.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3">
              <p className="text-xs font-medium text-slate-500">当前阶段审批意见</p>
              {currentStage.approvals.map((a) => (
                <div key={a.id} className="flex items-start gap-2 rounded bg-white p-2">
                  <div
                    className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                      a.decision === 'approved'
                        ? 'bg-emerald-100'
                        : a.decision === 'rejected'
                        ? 'bg-red-100'
                        : 'bg-slate-100'
                    }`}
                  >
                    {a.decision === 'approved' ? (
                      <CheckCircle2 size={10} className="text-emerald-600" />
                    ) : a.decision === 'rejected' ? (
                      <XCircle size={10} className="text-red-600" />
                    ) : (
                      <Info size={10} className="text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-slate-700">{a.reviewerName}</span>
                      <span className="text-slate-400">({roleMap[a.reviewerRole]?.name || a.reviewerRole})</span>
                      <span
                        className={`rounded px-1 py-0.5 text-[10px] ${
                          a.decision === 'approved'
                            ? 'bg-emerald-50 text-emerald-700'
                            : a.decision === 'rejected'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-slate-50 text-slate-500'
                        }`}
                      >
                        {a.decision === 'approved' ? '通过' : a.decision === 'rejected' ? '驳回' : '待处理'}
                      </span>
                    </div>
                    {a.comment && <p className="mt-0.5 text-xs text-slate-500">{a.comment}</p>}
                    {a.decidedAt && (
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {formatTime(a.decidedAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red-500" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {!isDraft && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
              <User size={10} /> 姓名
            </label>
            <input
              value={reviewerName}
              onChange={(e) => useReviewStore.getState().setReviewerName(e.target.value)}
              placeholder="您的姓名"
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
              <Shield size={10} /> 审批角色 *
            </label>
            <select
              value={reviewerRole}
              onChange={(e) => setReviewerRole(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
            >
              <option value="">请选择角色</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-slate-600">
          {actionType === 'reject' || actionType === 'rollback' ? '原因 *' : '意见（可选）'}
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={
            actionType === 'reject'
              ? '请填写驳回原因…'
              : actionType === 'rollback'
              ? '请填写回退原因…'
              : '填写审批意见…'
          }
          className="w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none"
          rows={2}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {isDraft && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            onFocus={() => setActionType('submit')}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#2e4e7a] disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            提交审核
          </button>
        )}

        {!isDraft && (
          <>
            <button
              onClick={handleApprove}
              disabled={loading}
              onFocus={() => setActionType('approve')}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              通过
            </button>
            <button
              onClick={handleReject}
              disabled={loading}
              onFocus={() => setActionType('reject')}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              驳回
            </button>
          </>
        )}

        {canRollback && (
          <button
            onClick={handleRollback}
            disabled={loading}
            onFocus={() => setActionType('rollback')}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
          >
            <Undo2 size={14} />
            回退
          </button>
        )}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <Info size={10} />
          <span>
            流程发起人：{instance.initiatorName} · 创建于{' '}
            {formatTime(instance.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
