import { useState } from 'react';
import { Loader2, AlertCircle, Plus } from 'lucide-react';
import { WorkflowProgressBar } from './WorkflowProgressBar';
import { WorkflowHistory } from './WorkflowHistory';
import { WorkflowControlPanel } from './WorkflowControlPanel';
import { useWorkflow } from '../hooks/useWorkflow';
import { useReviewStore } from '../store/reviewStore';

interface WorkflowPanelProps {
  docId: string;
}

export function WorkflowPanel({ docId }: WorkflowPanelProps) {
  const {
    instance,
    progress,
    transitions,
    roles,
    loading,
    error,
    createInstance,
    clearAll,
    clearError,
  } = useWorkflow({ docId, autoLoad: true });

  const reviewerName = useReviewStore((s) => s.reviewerName);
  const setReviewerName = useReviewStore((s) => s.setReviewerName);
  const [creating, setCreating] = useState(false);
  const [localName, setLocalName] = useState('');

  const handleCreate = async () => {
    const name = reviewerName.trim() || localName.trim();
    if (!name) {
      alert('请先填写您的姓名');
      return;
    }
    if (!reviewerName.trim() && localName.trim()) {
      setReviewerName(localName.trim());
    }
    setCreating(true);
    clearError();
    try {
      await createInstance({
        docId,
        initiatorId: `user_${name}`,
        initiatorName: name,
      });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (loading && !instance) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">加载工作流…</span>
        </div>
      </div>
    );
  }

  if (error && !instance) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <AlertCircle size={24} className="mb-2 text-amber-500" />
          <p className="text-sm text-slate-600">暂无审批流程</p>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#2e4e7a] disabled:opacity-60"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            启动审批流程
          </button>
        </div>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-slate-800">尚未启动审批流程</h3>
          <p className="mt-1 text-xs text-slate-500">启动后将进入「草稿」阶段，可提交审核</p>
          {!reviewerName.trim() && (
            <div className="mt-4 w-full max-w-xs">
              <label className="mb-1 block text-left text-xs font-medium text-slate-600">您的姓名 *</label>
              <input
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder="请输入您的姓名"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none"
              />
            </div>
          )}
          <button
            onClick={handleCreate}
            disabled={creating}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#2e4e7a] disabled:opacity-60"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            启动审批流程
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {progress && <WorkflowProgressBar progress={progress} />}
      <WorkflowControlPanel instance={instance} progress={progress!} roles={roles} />
      <WorkflowHistory transitions={transitions} />
    </div>
  );
}
