import type {
  ContinuityCheckStatus,
  ContinuityRuleType,
  ProductionMilestoneStatus,
  QcReviewStatus,
  QcReviewType,
  QcSeverity,
} from "@/lib/db/schema";

export interface CreateQcReviewInput {
  projectId: string;
  contentItemId?: string | null;
  sceneId?: string | null;
  shotId?: string | null;
  assetVersionId?: string | null;
  videoOutputId?: string | null;
  reviewType: QcReviewType;
  severity: QcSeverity;
  issue: string;
  action?: string;
  reviewer?: string;
  notes?: string;
}

export interface UpdateQcReviewInput {
  reviewType?: QcReviewType;
  status?: QcReviewStatus;
  severity?: QcSeverity;
  issue?: string;
  action?: string;
  reviewer?: string;
  notes?: string;
  resolvedAt?: Date | null;
}

export interface QcReviewFilters {
  projectId: string;
  contentItemId?: string;
  sceneId?: string;
  shotId?: string;
  assetVersionId?: string;
  videoOutputId?: string;
  reviewType?: QcReviewType;
  status?: QcReviewStatus;
  severity?: QcSeverity;
}

export interface CreateContinuityRuleInput {
  projectId?: string | null;
  ruleType: ContinuityRuleType;
  name: string;
  description?: string;
  severity?: QcSeverity;
  enabled?: boolean;
}

export interface CreateContinuityCheckInput {
  projectId: string;
  contentItemId: string;
  sceneId?: string | null;
  shotId: string;
  referenceShotId: string;
  ruleId: string;
  severity: QcSeverity;
  finding: string;
}

export interface ContinuityCheckFilters {
  projectId: string;
  contentItemId?: string;
  shotId?: string;
  status?: ContinuityCheckStatus;
  severity?: QcSeverity;
}

export interface ContinuityAiFinding {
  ruleType: ContinuityRuleType;
  severity: QcSeverity;
  finding: string;
  referenceShotCode: string;
  proposedAction: string;
}

export interface ScriptChangeImpact {
  type: "SCRIPT_CHANGE";
  sceneCode: string;
  blockType: string;
  description: string;
  affectedShotIds: string[];
  affectedShotCodes: string[];
}

export interface AssetChangeImpact {
  type: "ASSET_CHANGE";
  assetCode: string;
  assetName: string;
  versionLabel: string;
  description: string;
  affectedShotIds: string[];
  affectedShotCodes: string[];
}

export interface PromptChangeImpact {
  type: "PROMPT_CHANGE";
  shotCode: string;
  promptVersionLabel: string;
  description: string;
  affectedFlowQueueItemIds: string[];
  affectedJobDirectories: string[];
}

export interface AttentionItem {
  id: string;
  category: "MISSING_FILE" | "CRITICAL_QC" | "MAJOR_QC" | "CONTINUITY" | "CHANGED_ASSET" | "AFFECTED_SHOT" | "FAILED_FLOW_JOB";
  severity: QcSeverity;
  title: string;
  description: string;
  shotId?: string;
  shotCode?: string;
  contentItemId?: string;
  linkHref?: string;
}

export interface ProductionDashboardMetrics {
  shotCounts: Record<string, number>; // by status: NOT_STARTED, IN_PROGRESS, NEEDS_REVISION, APPROVED, FINAL, BLOCKED
  totalShots: number;
  videoCounts: {
    total: number;
    approved: number;
    needsRevision: number;
    inProgress: number;
    final: number;
  };
  assetHealth: {
    total: number;
    approved: number;
    missingOnDisk: number;
    locked: number;
  };
  qcHealth: {
    total: number;
    openCritical: number;
    openMajor: number;
    openMinor: number;
    resolved: number;
    waived: number;
  };
  continuityHealth: {
    total: number;
    open: number;
    reviewed: number;
    resolved: number;
    waived: number;
  };
  attentionItems: AttentionItem[];
}

export interface FinalReviewEvaluation {
  contentItemId: string;
  contentCode: string;
  contentTitle: string;
  currentStatus: string;
  audioStatus: ProductionMilestoneStatus;
  editStatus: ProductionMilestoneStatus;
  canApprove: boolean;
  blockingReasons: string[];
  warnings: string[];
  checks: {
    scriptLocked: boolean;
    allShotsApprovedOrFinal: boolean;
    allVideosRegistered: boolean;
    noMissingAssets: boolean;
    noOpenCriticalQc: boolean;
    noOpenMajorQc: boolean;
  };
  stats: {
    totalShots: number;
    approvedOrFinalShots: number;
    totalVideos: number;
    missingAssetsCount: number;
    openCriticalQcCount: number;
    openMajorQcCount: number;
    openMinorQcCount: number;
  };
}
