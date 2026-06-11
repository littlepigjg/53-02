export type FileType = 'markdown' | 'docx';
export type ParagraphType = 'heading' | 'paragraph' | 'list' | 'code' | 'quote' | 'table';
export type AnnotationType = 'comment' | 'suggestion';
export type AnnotationStatus = 'pending' | 'accepted' | 'rejected';

export type WorkflowStageType = 'draft' | 'first_review' | 'second_review' | 'final_review' | 'completed' | 'rejected';
export type ApprovalMode = 'all' | 'any';
export type TransitionAction = 'submit' | 'approve' | 'reject' | 'rollback';
export type AuditActionType = 'stage_transition' | 'approval_submit' | 'instance_create' | 'config_update';

export interface ReviewerRole {
  id: string;
  name: string;
  description?: string;
}

export interface WorkflowStageConfig {
  id: string;
  stageType: WorkflowStageType;
  name: string;
  description?: string;
  order: number;
  reviewerRoles: string[];
  approvalMode: ApprovalMode;
  minApprovalCount?: number;
}

export interface WorkflowTransition {
  fromStage: WorkflowStageType;
  toStage: WorkflowStageType;
  action: TransitionAction;
  requiredConditions?: string[];
}

export interface WorkflowConfig {
  id: string;
  name: string;
  description?: string;
  version: number;
  stages: WorkflowStageConfig[];
  transitions: WorkflowTransition[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StageApproval {
  id: string;
  reviewerId: string;
  reviewerName: string;
  reviewerEmail?: string;
  reviewerRole: string;
  decision: 'approved' | 'rejected' | 'pending';
  comment?: string;
  decidedAt?: string;
}

export interface WorkflowInstanceStage {
  stageType: WorkflowStageType;
  stageName: string;
  approvals: StageApproval[];
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowTransitionRecord {
  id: string;
  instanceId: string;
  fromStage: WorkflowStageType;
  toStage: WorkflowStageType;
  action: TransitionAction;
  operatorId: string;
  operatorName: string;
  comment?: string;
  timestamp: string;
}

export interface WorkflowInstance {
  id: string;
  docId: string;
  configId: string;
  configVersion: number;
  currentStage: WorkflowStageType;
  currentStageName: string;
  stages: WorkflowInstanceStage[];
  status: 'running' | 'completed' | 'terminated';
  initiatorId: string;
  initiatorName: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: AuditActionType;
  entityType: 'workflow_instance' | 'workflow_config' | 'stage_approval';
  entityId: string;
  operatorId: string;
  operatorName: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  comment?: string;
  previousHash?: string;
  hash: string;
}

export interface WorkflowNotification {
  id: string;
  instanceId: string;
  docId: string;
  recipientId: string;
  recipientName: string;
  recipientEmail?: string;
  type: 'stage_assigned' | 'approval_completed' | 'workflow_completed' | 'workflow_rejected';
  message: string;
  stageType?: WorkflowStageType;
  stageName?: string;
  read: boolean;
  createdAt: string;
  readAt?: string;
}

export interface WorkflowProgress {
  instanceId: string;
  currentStage: WorkflowStageType;
  currentStageName: string;
  totalStages: number;
  completedStages: number;
  progressPercentage: number;
  stages: {
    stageType: WorkflowStageType;
    stageName: string;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
    order: number;
    approvals: StageApproval[];
  }[];
}

export interface DocumentMeta {
  id: string;
  title: string;
  originalFileName: string;
  fileType: FileType;
  createdAt: string;
  updatedAt: string;
  shareToken?: string;
  sharePassword?: string | null;
  shareExpiresAt?: string | null;
  annotationCount: number;
  reviewerCount: number;
  workflowInstanceId?: string;
  workflowStatus?: WorkflowStageType;
}

export interface Paragraph {
  id: string;
  index: number;
  type: ParagraphType;
  level?: number;
  content: string;
  rawHtml?: string;
}

export interface ParsedDocument {
  docId: string;
  paragraphs: Paragraph[];
}

export interface Annotation {
  id: string;
  docId: string;
  paragraphId: string;
  type: AnnotationType;
  reviewerName: string;
  reviewerEmail?: string;
  content: string;
  suggestedText?: string;
  originalText?: string;
  status: AnnotationStatus;
  ownerNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummary {
  docId: string;
  totalAnnotations: number;
  pendingCount: number;
  acceptedCount: number;
  rejectedCount: number;
  commentCount: number;
  suggestionCount: number;
  byReviewer: { name: string; count: number }[];
  byParagraph: { paragraphId: string; count: number }[];
}
