import { useEffect, useCallback, useMemo } from 'react';
import type {
  WorkflowInstance,
  WorkflowProgress,
  WorkflowTransitionRecord,
  ReviewerRole,
  WorkflowNotification,
} from '../types';
import { useWorkflowStore } from '../store/workflowStore';
import { getStageName, formatApprovalMode, getApprovalStatusText } from '../utils/workflowUtils';

export interface UseWorkflowOptions {
  autoLoad?: boolean;
  docId?: string;
  instanceId?: string;
}

export interface UseWorkflowResult {
  instance: WorkflowInstance | null;
  progress: WorkflowProgress | null;
  transitions: WorkflowTransitionRecord[];
  roles: ReviewerRole[];
  notifications: WorkflowNotification[];
  loading: boolean;
  error: string | null;

  currentStageName: string;
  currentStatusText: string;
  approvalModeText: string;
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canRollback: boolean;
  isCompleted: boolean;
  isRunning: boolean;

  loadInstanceByDocId: (docId: string) => Promise<WorkflowInstance | null>;
  loadInstance: (id: string) => Promise<void>;
  loadProgress: () => Promise<void>;
  loadTransitions: () => Promise<void>;
  loadRoles: () => Promise<void>;
  loadNotifications: (recipientId?: string) => Promise<void>;
  refreshAll: () => Promise<void>;

  createInstance: (params: {
    docId: string;
    initiatorId: string;
    initiatorName: string;
  }) => Promise<WorkflowInstance>;

  submitForReview: (params: {
    operatorId: string;
    operatorName: string;
    comment?: string;
  }) => Promise<void>;

  approve: (params: {
    reviewerId: string;
    reviewerName: string;
    reviewerEmail?: string;
    reviewerRole: string;
    comment?: string;
  }) => Promise<void>;

  reject: (params: {
    reviewerId: string;
    reviewerName: string;
    reviewerEmail?: string;
    reviewerRole: string;
    comment?: string;
  }) => Promise<void>;

  rollback: (params: {
    operatorId: string;
    operatorName: string;
    comment?: string;
  }) => Promise<void>;

  markNotificationRead: (id: string) => Promise<void>;
  clearError: () => void;
  clearAll: () => void;
}

export function useWorkflow(options: UseWorkflowOptions = {}): UseWorkflowResult {
  const { autoLoad = true, docId, instanceId } = options;

  const store = useWorkflowStore();

  const {
    instance,
    progress,
    transitions,
    roles,
    notifications,
    loading,
    error,
    fetchInstanceByDocId,
    fetchInstance,
    fetchProgress,
    fetchTransitions,
    fetchRoles,
    fetchNotifications,
    createInstance,
    markNotificationRead,
    clear,
    setError,
  } = store;

  useEffect(() => {
    if (autoLoad && docId) {
      fetchInstanceByDocId(docId);
      fetchRoles();
    } else if (autoLoad && instanceId) {
      fetchInstance(instanceId);
      fetchRoles();
    }
  }, [autoLoad, docId, instanceId, fetchInstanceByDocId, fetchInstance, fetchRoles]);

  useEffect(() => {
    if (instance) {
      fetchProgress(instance.id);
      fetchTransitions(instance.id);
    }
  }, [instance, fetchProgress, fetchTransitions]);

  const loadInstanceByDocId = useCallback(async (id: string) => {
    return fetchInstanceByDocId(id);
  }, [fetchInstanceByDocId]);

  const loadInstance = useCallback(async (id: string) => {
    await fetchInstance(id);
  }, [fetchInstance]);

  const loadProgress = useCallback(async () => {
    if (instance) await fetchProgress(instance.id);
  }, [instance, fetchProgress]);

  const loadTransitions = useCallback(async () => {
    if (instance) await fetchTransitions(instance.id);
  }, [instance, fetchTransitions]);

  const loadRoles = useCallback(async () => {
    await fetchRoles();
  }, [fetchRoles]);

  const loadNotifications = useCallback(async (recipientId?: string) => {
    await fetchNotifications(recipientId);
  }, [fetchNotifications]);

  const refreshAll = useCallback(async () => {
    if (!instance) return;
    await Promise.all([
      fetchInstance(instance.id),
      fetchProgress(instance.id),
      fetchTransitions(instance.id),
    ]);
  }, [instance, fetchInstance, fetchProgress, fetchTransitions]);

  const submitForReview = useCallback(async (params: {
    operatorId: string;
    operatorName: string;
    comment?: string;
  }) => {
    if (!instance) throw new Error('工作流实例不存在');
    await useWorkflowStore.getState().submitForReview(instance.id, params);
  }, [instance]);

  const approve = useCallback(async (params: {
    reviewerId: string;
    reviewerName: string;
    reviewerEmail?: string;
    reviewerRole: string;
    comment?: string;
  }) => {
    if (!instance) throw new Error('工作流实例不存在');
    await useWorkflowStore.getState().approve(instance.id, params);
  }, [instance]);

  const reject = useCallback(async (params: {
    reviewerId: string;
    reviewerName: string;
    reviewerEmail?: string;
    reviewerRole: string;
    comment?: string;
  }) => {
    if (!instance) throw new Error('工作流实例不存在');
    await useWorkflowStore.getState().reject(instance.id, params);
  }, [instance]);

  const rollback = useCallback(async (params: {
    operatorId: string;
    operatorName: string;
    comment?: string;
  }) => {
    if (!instance) throw new Error('工作流实例不存在');
    await useWorkflowStore.getState().rollback(instance.id, params);
  }, [instance]);

  const currentStageName = instance ? getStageName(instance.currentStage) : '';

  const currentStatusText = useMemo(() => {
    if (!instance || !progress) return '';
    const currentStageProgress = progress.stages.find(
      (s) => s.stageType === instance.currentStage
    );
    if (!currentStageProgress) return '';
    return getApprovalStatusText(
      currentStageProgress.approvals,
      'any',
      undefined
    );
  }, [instance, progress]);

  const approvalModeText = (() => {
    if (!instance || !progress) return '';
    const currentStageProgress = progress.stages.find(
      (s) => s.stageType === instance.currentStage
    );
    if (!currentStageProgress) return '';
    const hasMinCount = currentStageProgress.approvals.length > 1;
    return formatApprovalMode(hasMinCount ? 'all' : 'any', hasMinCount ? 2 : undefined);
  })();

  const canSubmit = instance?.currentStage === 'draft' && instance.status === 'running';
  const canApprove = instance?.status === 'running' && instance.currentStage !== 'draft' && instance.currentStage !== 'completed';
  const canReject = instance?.status === 'running' && instance.currentStage !== 'draft' && instance.currentStage !== 'completed';
  const canRollback = instance?.status === 'running' && instance.currentStage !== 'draft' && instance.currentStage !== 'first_review';
  const isCompleted = instance?.status === 'completed';
  const isRunning = instance?.status === 'running';

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const clearAll = useCallback(() => {
    clear();
  }, [clear]);

  return {
    instance,
    progress,
    transitions,
    roles,
    notifications,
    loading,
    error,
    currentStageName,
    currentStatusText,
    approvalModeText,
    canSubmit,
    canApprove,
    canReject,
    canRollback,
    isCompleted,
    isRunning,
    loadInstanceByDocId,
    loadInstance,
    loadProgress,
    loadTransitions,
    loadRoles,
    loadNotifications,
    refreshAll,
    createInstance,
    submitForReview,
    approve,
    reject,
    rollback,
    markNotificationRead,
    clearError,
    clearAll,
  };
}
