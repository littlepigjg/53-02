import { ArrowRight, History, CheckCircle, XCircle, Send, Undo2, User } from 'lucide-react';
import type { WorkflowTransitionRecord } from '../types';

interface WorkflowHistoryProps {
  transitions: WorkflowTransitionRecord[];
}

const STAGE_NAMES: Record<string, string> = {
  draft: '草稿',
  first_review: '初审',
  second_review: '复审',
  final_review: '终审',
  completed: '已完成',
  rejected: '已驳回',
};

const ACTION_LABELS: Record<string, { label: string; icon: typeof Send; color: string; bg: string }> = {
  submit: { label: '提交审核', icon: Send, color: 'text-[#1e3a5f]', bg: 'bg-[#1e3a5f]/10' },
  approve: { label: '审批通过', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  reject: { label: '审批驳回', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  rollback: { label: '手动回退', icon: Undo2, color: 'text-amber-600', bg: 'bg-amber-50' },
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function WorkflowHistory({ transitions }: WorkflowHistoryProps) {
  const sorted = [...transitions].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <History size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800">流转历史</h3>
        </div>
        <div className="py-8 text-center">
          <History size={32} className="mx-auto mb-2 text-slate-200" />
          <p className="text-sm text-slate-400">暂无流转记录</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800">流转历史</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
          {sorted.length} 条记录
        </span>
      </div>

      <div className="space-y-4">
        {sorted.map((record, idx) => {
          const actionConfig = ACTION_LABELS[record.action] || ACTION_LABELS.submit;
          const ActionIcon = actionConfig.icon;
          return (
            <div key={record.id} className="relative flex gap-3">
              {idx < sorted.length - 1 && (
                <div className="absolute left-[15px] top-8 h-[calc(100%+8px)] w-px bg-slate-100" />
              )}
              <div className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${actionConfig.bg}`}>
                <ActionIcon size={14} className={actionConfig.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="font-medium text-slate-800">{record.operatorName}</span>
                  <span className={`${actionConfig.color} font-medium`}>{actionConfig.label}</span>
                  <span className="text-slate-400">：</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                    {STAGE_NAMES[record.fromStage] || record.fromStage}
                  </span>
                  <ArrowRight size={12} className="text-slate-300" />
                  <span className="rounded bg-[#1e3a5f]/10 px-1.5 py-0.5 text-xs font-medium text-[#1e3a5f]">
                    {STAGE_NAMES[record.toStage] || record.toStage}
                  </span>
                </div>
                {record.comment && (
                  <p className="mt-1 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                    {record.comment}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <User size={10} />
                  <span>操作人 ID：{record.operatorId}</span>
                  <span>·</span>
                  <span>{formatTime(record.timestamp)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
