import { CheckCircle2, Circle, Clock } from 'lucide-react';
import type { WorkflowProgress } from '../types';

interface WorkflowProgressBarProps {
  progress: WorkflowProgress;
}

const stageColors: Record<string, { bg: string; text: string; border: string; line: string }> = {
  completed: { bg: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-500', line: 'bg-emerald-500' },
  in_progress: { bg: 'bg-[#1e3a5f]', text: 'text-[#1e3a5f]', border: 'border-[#1e3a5f]', line: 'bg-slate-200' },
  pending: { bg: 'bg-slate-300', text: 'text-slate-500', border: 'border-slate-300', line: 'bg-slate-200' },
  skipped: { bg: 'bg-slate-200', text: 'text-slate-400', border: 'border-slate-200', line: 'bg-slate-200' },
};

export function WorkflowProgressBar({ progress }: WorkflowProgressBarProps) {
  const sortedStages = [...progress.stages].sort((a, b) => a.order - b.order);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">审批进度</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            当前阶段：<span className="font-medium text-[#1e3a5f]">{progress.currentStageName}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-[#1e3a5f]">{progress.progressPercentage}%</p>
          <p className="text-xs text-slate-500">
            {progress.completedStages} / {progress.totalStages} 阶段完成
          </p>
        </div>
      </div>

      <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#1e3a5f] to-emerald-500 transition-all duration-500"
          style={{ width: `${progress.progressPercentage}%` }}
        />
      </div>

      <div className="relative flex items-start justify-between">
        {sortedStages.map((stage, idx) => {
          const colors = stageColors[stage.status];
          const isLast = idx === sortedStages.length - 1;
          return (
            <div key={stage.stageType} className="relative flex flex-1 flex-col items-center">
              {!isLast && (
                <div className="absolute left-1/2 top-4 h-0.5 w-full -translate-y-1/2">
                  <div
                    className={`h-full transition-all duration-500 ${
                      stage.status === 'completed' ? stageColors.completed.line : 'bg-slate-200'
                    }`}
                  />
                </div>
              )}
              <div className="relative z-10 flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white transition-all ${
                    stage.status === 'completed'
                      ? colors.border
                      : stage.status === 'in_progress'
                      ? `${colors.border} ring-4 ring-[#1e3a5f]/10`
                      : colors.border
                  }`}
                >
                  {stage.status === 'completed' ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : stage.status === 'in_progress' ? (
                    <Clock size={14} className="text-[#1e3a5f] animate-pulse" />
                  ) : (
                    <Circle size={14} className="text-slate-300" />
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={`text-xs font-medium ${
                      stage.status === 'completed'
                        ? 'text-emerald-700'
                        : stage.status === 'in_progress'
                        ? 'text-[#1e3a5f]'
                        : 'text-slate-400'
                    }`}
                  >
                    {stage.stageName}
                  </p>
                  {stage.approvals.length > 0 && (
                    <div className="mt-1 flex items-center justify-center gap-1">
                      {stage.approvals.map((a) => (
                        <span
                          key={a.id}
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            a.decision === 'approved'
                              ? 'bg-emerald-50 text-emerald-700'
                              : a.decision === 'rejected'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-slate-50 text-slate-500'
                          }`}
                        >
                          {a.reviewerName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
