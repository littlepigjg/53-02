import { create } from 'zustand';
import type {
  WorkflowInstance,
  WorkflowProgress,
  WorkflowTransitionRecord,
  AuditLogEntry,
  WorkflowNotification,
  ReviewerRole,
} from '../types';
import { workflowApi } from '../utils/api';

interface WorkflowState {
  instance: WorkflowInstance | null;
  progress: WorkflowProgress | null;
  transitions: WorkflowTransitionRecord[];
  auditLogs: AuditLogEntry[];
  notifications: WorkflowNotification[];
  roles: ReviewerRole[];
  loading: boolean;
  error: string | null;

  fetchInstanceByDocId: (docId: string) => Promise<WorkflowInstance | null>;
  fetchInstance: (id: string) => Promise<void>;
  fetchProgress: (instanceId: string) => Promise<void>;
  fetchTransitions: (instanceId: string) => Promise<void>;
  fetchAuditLogs: (instanceId: string) => Promise<void>;
  fetchRoles: () => Promise<void>;
  fetchNotifications: (recipientId?: string) => Promise<void>;

  createInstance: (params: { docId: string; initiatorId: string; initiatorName: string }) => Promise<WorkflowInstance>;
  submitForReview: (instanceId: string, params: { operatorId: string; operatorName: string; comment?: string }) => Promise<void>;
  approve: (instanceId: string, params: {
    reviewerId: string;
    reviewerName: string;
    reviewerEmail?: string;
    reviewerRole: string;
    comment?: string;
  }) => Promise<void>;
  reject: (instanceId: string, params: {
    reviewerId: string;
    reviewerName: string;
    reviewerEmail?: string;
    reviewerRole: string;
    comment?: string;
  }) => Promise<void>;
  rollback: (instanceId: string, params: { operatorId: string; operatorName: string; comment?: string }) => Promise<void>;

  markNotificationRead: (id: string) => Promise<void>;
  clear: () => void;
  setError: (err: string | null) => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  instance: null,
  progress: null,
  transitions: [],
  auditLogs: [],
  notifications: [],
  roles: [],
  loading: false,
  error: null,

  fetchInstanceByDocId: async (docId: string) => {
    set({ loading: true, error: null });
    try {
      const instance = await workflowApi.getInstanceByDocId(docId);
      set({ instance, loading: false });
      return instance;
    } catch (e) {
      set({ error: (e as Error).message, loading: false, instance: null });
      return null;
    }
  },

  fetchInstance: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const instance = await workflowApi.getInstance(id);
      set({ instance, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  fetchProgress: async (instanceId: string) => {
    try {
      const progress = await workflowApi.getProgress(instanceId);
      set({ progress });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchTransitions: async (instanceId: string) => {
    try {
      const transitions = await workflowApi.getTransitions(instanceId);
      set({ transitions });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchAuditLogs: async (instanceId: string) => {
    try {
      const auditLogs = await workflowApi.getAuditLog(instanceId);
      set({ auditLogs });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchRoles: async () => {
    try {
      const roles = await workflowApi.listRoles();
      set({ roles });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchNotifications: async (recipientId?: string) => {
    try {
      const notifications = await workflowApi.listNotifications(recipientId);
      set({ notifications });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  createInstance: async (params) => {
    set({ loading: true, error: null });
    try {
      const instance = await workflowApi.createInstance(params);
      set({ instance, loading: false });
      return instance;
    } catch (e) {
      const errMsg = (e as Error).message;
      set({ error: errMsg, loading: false });
      throw new Error(errMsg);
    }
  },

  submitForReview: async (instanceId, params) => {
    set({ loading: true, error: null });
    try {
      const instance = await workflowApi.submitForReview(instanceId, params);
      set({ instance, loading: false });
      await get().fetchProgress(instanceId);
      await get().fetchTransitions(instanceId);
    } catch (e) {
      const errMsg = (e as Error).message;
      set({ error: errMsg, loading: false });
      throw new Error(errMsg);
    }
  },

  approve: async (instanceId, params) => {
    set({ loading: true, error: null });
    try {
      const instance = await workflowApi.approve(instanceId, params);
      set({ instance, loading: false });
      await get().fetchProgress(instanceId);
      await get().fetchTransitions(instanceId);
    } catch (e) {
      const errMsg = (e as Error).message;
      set({ error: errMsg, loading: false });
      throw new Error(errMsg);
    }
  },

  reject: async (instanceId, params) => {
    set({ loading: true, error: null });
    try {
      const instance = await workflowApi.reject(instanceId, params);
      set({ instance, loading: false });
      await get().fetchProgress(instanceId);
      await get().fetchTransitions(instanceId);
    } catch (e) {
      const errMsg = (e as Error).message;
      set({ error: errMsg, loading: false });
      throw new Error(errMsg);
    }
  },

  rollback: async (instanceId, params) => {
    set({ loading: true, error: null });
    try {
      const instance = await workflowApi.rollback(instanceId, params);
      set({ instance, loading: false });
      await get().fetchProgress(instanceId);
      await get().fetchTransitions(instanceId);
    } catch (e) {
      const errMsg = (e as Error).message;
      set({ error: errMsg, loading: false });
      throw new Error(errMsg);
    }
  },

  markNotificationRead: async (id: string) => {
    try {
      await workflowApi.markNotificationRead(id);
      set((s) => ({
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }));
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  clear: () =>
    set({
      instance: null,
      progress: null,
      transitions: [],
      auditLogs: [],
      loading: false,
      error: null,
    }),

  setError: (err) => set({ error: err }),
}));
