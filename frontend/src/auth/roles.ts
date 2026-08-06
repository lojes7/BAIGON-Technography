export type RoleKey = "admin" | "reviewer" | "analyst" | "teacher" | "student" | "student_affair";

export interface Role {
  key: RoleKey;
  labelKey: string;
}

// 移除 engineer/DATA_ENGINEER 角色（新版后端已去除）
export const ROLES: Role[] = [
  { key: "admin", labelKey: "roles.admin" },
  { key: "reviewer", labelKey: "roles.reviewer" },
  { key: "analyst", labelKey: "roles.analyst" },
  { key: "teacher", labelKey: "roles.teacher" },
  { key: "student", labelKey: "roles.student" },
  { key: "student_affair", labelKey: "roles.student_affair" },
];

type PermissionKey = string;

export const PAGE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  admin: [
    "dashboard", "data-sources", "import-batches", "auto-import", "raw-records",
    "job-dict", "skill-dict", "taxonomy",
    "graph-browser", "graph-snapshots", "relation-evidence",
    "evolution-trends", "evolution-events", "skill-combos",
    "programs", "course-evidence", "gap-analysis", "response-lag", "recommendations",
    "export-tasks", "export-history",
    "params", "users", "audit-log",
    "extraction-tasks", "review-queue", "ai-analyses", "processing-errors",
  ],
  reviewer: [
    "dashboard", "review-queue", "ai-analyses", "processing-errors",
    "job-dict", "skill-dict", "taxonomy", "account-settings",
  ],
  analyst: [
    "dashboard",
    "graph-browser", "graph-snapshots", "relation-evidence",
    "evolution-trends", "evolution-events", "skill-combos", "account-settings",
  ],
  teacher: [
    "dashboard",
    "graph-browser", "evolution-trends",
    "programs", "course-evidence", "gap-analysis", "response-lag", "recommendations",
    "my-students", "account-settings",
  ],
  student: [
    "dashboard",
    "my-resume", "account-settings",
    "graph-browser", "evolution-trends",
    "skill-analysis", "skill-compare", "gap-report", "learning-path",
  ],
  student_affair: [
    "dashboard",
    "teacher-management", "student-management",
    "grade-import", "account-settings",
  ],
};

export const OPERATION_PERMISSIONS: Record<string, RoleKey[]> = {
  "graph:export": ["admin", "analyst"],
  "graph:edit": ["admin"],
  "graph:use-as-target": ["student"],
  "evolution:export": ["admin", "analyst"],
  "evolution:edit": ["admin"],
};

export function canAccessPage(role: RoleKey, pageId: string): boolean {
  return PAGE_PERMISSIONS[role]?.includes(pageId) ?? false;
}

export function canOperate(role: RoleKey, operation: string): boolean {
  return OPERATION_PERMISSIONS[operation]?.includes(role) ?? false;
}
