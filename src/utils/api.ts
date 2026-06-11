import type {
  DocumentMeta,
  ParsedDocument,
  Annotation,
  ReviewSummary,
  AnnotationStatus,
  WorkflowConfig,
  WorkflowInstance,
  WorkflowProgress,
  WorkflowTransitionRecord,
  AuditLogEntry,
  WorkflowNotification,
  ReviewerRole,
} from '../types';

const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export const documentsApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: form,
    }).then((r) => r.json() as Promise<DocumentMeta>);
  },
  list: () => request<DocumentMeta[]>('/documents'),
  get: (id: string) => request<DocumentMeta>(`/documents/${id}`),
  remove: (id: string) =>
    request<{ ok: true }>(`/documents/${id}`, { method: 'DELETE' }),
  getParsed: (id: string) => request<ParsedDocument>(`/documents/${id}/parsed`),
  createShare: (id: string) =>
    request<{ shareToken: string }>(`/documents/${id}/share`, { method: 'POST' }),
};

export const shareApi = {
  getReviewData: (token: string) =>
    request<{ document: DocumentMeta; parsed: ParsedDocument; annotations: Annotation[] }>(`/share/${token}`),
};

export const annotationsApi = {
  create: (data: {
    documentId: string;
    paragraphId: string;
    type: 'comment' | 'suggestion';
    reviewerName: string;
    reviewerEmail?: string;
    content: string;
    suggestedText?: string;
    originalText?: string;
  }) => request<Annotation>('/annotations', { method: 'POST', body: JSON.stringify(data) }),
  list: (docId: string) => request<Annotation[]>(`/annotations/${docId}`),
  updateStatus: (id: string, status: AnnotationStatus, ownerNote?: string) =>
    request<Annotation>(`/annotations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ownerNote }),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/annotations/${id}`, { method: 'DELETE' }),
};

export const reviewApi = {
  summary: (docId: string) => request<ReviewSummary>(`/review/${docId}/summary`),
};

export const exportApi = {
  markdown: (docId: string) =>
    fetch(`${API_BASE}/export/${docId}`).then(async (r) => ({
      filename:
        r.headers.get('Content-Disposition')?.match(/filename="?([^"]+)/)?.[1] ||
        'document.md',
      text: await r.text(),
    })),
};

export const workflowApi = {
  listConfigs: () => request<WorkflowConfig[]>('/workflow/configs'),
  getDefaultConfig: () => request<WorkflowConfig>('/workflow/configs/default'),
  listRoles: () => request<ReviewerRole[]>('/workflow/roles'),

  createInstance: (data: { docId: string; initiatorId: string; initiatorName: string; configId?: string }) =>
    request<WorkflowInstance>('/workflow/instances', { method: 'POST', body: JSON.stringify(data) }),
  listInstances: () => request<WorkflowInstance[]>('/workflow/instances'),
  getInstance: (id: string) => request<WorkflowInstance>(`/workflow/instances/${id}`),
  getInstanceByDocId: (docId: string) => request<WorkflowInstance>(`/workflow/instances/by-doc/${docId}`),
  getProgress: (instanceId: string) => request<WorkflowProgress>(`/workflow/instances/${instanceId}/progress`),
  getTransitions: (instanceId: string) =>
    request<WorkflowTransitionRecord[]>(`/workflow/instances/${instanceId}/transitions`),
  getAuditLog: (instanceId: string) =>
    request<AuditLogEntry[]>(`/workflow/instances/${instanceId}/audit-log`),

  submitForReview: (instanceId: string, data: { operatorId: string; operatorName: string; comment?: string }) =>
    request<WorkflowInstance>(`/workflow/instances/${instanceId}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  approve: (
    instanceId: string,
    data: {
      reviewerId: string;
      reviewerName: string;
      reviewerEmail?: string;
      reviewerRole: string;
      comment?: string;
    }
  ) =>
    request<WorkflowInstance>(`/workflow/instances/${instanceId}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  reject: (
    instanceId: string,
    data: {
      reviewerId: string;
      reviewerName: string;
      reviewerEmail?: string;
      reviewerRole: string;
      comment?: string;
    }
  ) =>
    request<WorkflowInstance>(`/workflow/instances/${instanceId}/reject`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  rollback: (instanceId: string, data: { operatorId: string; operatorName: string; comment?: string }) =>
    request<WorkflowInstance>(`/workflow/instances/${instanceId}/rollback`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  verifyAuditLog: () => request<{ valid: boolean; invalidIndex?: number; message: string }>('/workflow/audit-log/verify'),
  listAuditLogs: () => request<AuditLogEntry[]>('/workflow/audit-log'),

  listNotifications: (recipientId?: string) =>
    request<WorkflowNotification[]>(`/workflow/notifications${recipientId ? `?recipientId=${encodeURIComponent(recipientId)}` : ''}`),
  markNotificationRead: (id: string) =>
    request<{ success: boolean }>(`/workflow/notifications/${id}/read`, { method: 'POST' }),
};
