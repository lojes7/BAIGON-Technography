import {
  Database, Sparkles, BookOpen, Network, Activity,
  GraduationCap, PackageOpen, Settings,
  Home, User, Search, ClipboardCheck, Users,
} from "lucide-react";
import type { NavSection } from "../types";

const mkChild = (id: string, labelKey: string) => ({ id, labelKey });
const mk = (id: string, labelKey: string, icon: any, children?: ReturnType<typeof mkChild>[]) =>
  ({ id, labelKey, icon, children, single: !children });

export const ADMIN_NAV: NavSection[] = [
  mk("dashboard", "nav.dashboard", Home, undefined),
  mk("data-center", "nav.dataCenter", Database, [
    mkChild("data-sources", "nav.dataSources"),
    mkChild("import-batches", "nav.importBatches"),
    mkChild("auto-import", "nav.autoImport"),
    mkChild("raw-records", "nav.rawRecords"),
  ]),
  mk("ai-processing", "nav.aiProcessing", Sparkles, [
    mkChild("extraction-tasks", "nav.extractionTasks"),
    mkChild("review-queue", "nav.reviewQueue"),
    mkChild("processing-errors", "nav.processingErrors"),
  ]),
  mk("dictionaries", "nav.dictionaries", BookOpen, [
    mkChild("job-dict", "nav.jobDict"),
    mkChild("skill-dict", "nav.skillDict"),
    mkChild("taxonomy", "nav.taxonomy"),
  ]),
  mk("graph", "nav.graph", Network, [
    mkChild("graph-browser", "nav.graphBrowser"),
    mkChild("graph-snapshots", "nav.graphSnapshots"),
    mkChild("relation-evidence", "nav.relationEvidence"),
  ]),
  mk("evolution", "nav.evolution", Activity, [
    mkChild("evolution-trends", "nav.evolutionTrends"),
    mkChild("evolution-events", "nav.evolutionEvents"),
    mkChild("skill-combos", "nav.skillCombos"),
  ]),
  mk("curriculum", "nav.curriculum", GraduationCap, [
    mkChild("programs", "nav.programs"),
    mkChild("course-evidence", "nav.courseEvidence"),
    mkChild("gap-analysis", "nav.gapAnalysis"),
    mkChild("response-lag", "nav.responseLag"),
    mkChild("recommendations", "nav.recommendations"),
  ]),
  mk("delivery", "nav.delivery", PackageOpen, [
    mkChild("export-tasks", "nav.dataExport"),
    mkChild("export-history", "nav.exportHistory"),
  ]),
  mk("admin", "nav.admin", Settings, [
    mkChild("params", "nav.params"),
    mkChild("users", "nav.users"),
    mkChild("audit-log", "nav.auditLog"),
  ]),
];

export const STUDENT_NAV: NavSection[] = [
  mk("dashboard", "nav.dashboard", Home, undefined),
  mk("profile", "nav.personalCenter", User, [
    mkChild("my-resume", "nav.myResume"),
    mkChild("account-settings", "nav.accountSettings"),
  ]),
  mk("explore", "nav.jobExplore", Search, [
    mkChild("graph-browser", "nav.jobGraphBrowser"),
    mkChild("evolution-trends", "nav.evolutionOverview"),
  ]),
  mk("diagnosis", "nav.abilityDiagnosis", ClipboardCheck, [
    mkChild("skill-analysis", "nav.skillAnalysis"),
    mkChild("skill-compare", "nav.skillCompare"),
    mkChild("gap-report", "nav.gapReport"),
    mkChild("learning-path", "nav.learningPath"),
  ]),
];

export const TEACHER_NAV: NavSection[] = [
  mk("dashboard", "nav.dashboard", Home, undefined),
  mk("insight", "nav.jobInsight", Search, [
    mkChild("graph-browser", "nav.jobGraphBrowser"),
    mkChild("evolution-trends", "nav.evolutionOverview"),
  ]),
  mk("curriculum", "nav.curriculum", GraduationCap, [
    mkChild("programs", "nav.programs"),
    mkChild("course-evidence", "nav.courseEvidence"),
    mkChild("gap-analysis", "nav.gapAnalysis"),
    mkChild("response-lag", "nav.responseLag"),
    mkChild("recommendations", "nav.recommendations"),
  ]),
  mk("profile", "nav.personalCenter", User, [
    mkChild("my-students", "nav.myStudents"),
    mkChild("account-settings", "nav.accountSettings"),
  ]),
];

export const ANALYST_NAV: NavSection[] = [
  mk("dashboard", "nav.dashboard", Home, undefined),
  mk("graph", "nav.graph", Network, [
    mkChild("graph-browser", "nav.graphBrowser"),
    mkChild("graph-snapshots", "nav.graphSnapshots"),
    mkChild("relation-evidence", "nav.relationEvidence"),
  ]),
  mk("evolution", "nav.evolution", Activity, [
    mkChild("evolution-trends", "nav.evolutionTrends"),
    mkChild("evolution-events", "nav.evolutionEvents"),
    mkChild("skill-combos", "nav.skillCombos"),
  ]),
  mk("profile", "nav.personalCenter", User, [
    mkChild("account-settings", "nav.accountSettings"),
  ]),
];

export const REVIEWER_NAV: NavSection[] = [
  mk("dashboard", "nav.dashboard", Home, undefined),
  mk("ai-processing", "nav.aiProcessing", Sparkles, [
    mkChild("review-queue", "nav.reviewQueue"),
    mkChild("ai-analyses", "nav.aiAnalyses"),
    mkChild("processing-errors", "nav.processingErrors"),
  ]),
  mk("dictionaries", "nav.dictionaries", BookOpen, [
    mkChild("job-dict", "nav.jobDict"),
    mkChild("skill-dict", "nav.skillDict"),
    mkChild("taxonomy", "nav.taxonomy"),
  ]),
  mk("profile", "nav.personalCenter", User, [
    mkChild("account-settings", "nav.accountSettings"),
  ]),
];

export const STUDENT_AFFAIRS_NAV: NavSection[] = [
  mk("dashboard", "nav.dashboard", Home, undefined),
  mk("personnel", "nav.personnel", Users, [
    mkChild("teacher-management", "nav.teacherManagement"),
    mkChild("student-management", "nav.studentManagement"),
  ]),
  mk("grades", "nav.grades", GraduationCap, [
    mkChild("grade-import", "nav.gradeImport"),
  ]),
  mk("profile", "nav.personalCenter", User, [
    mkChild("account-settings", "nav.accountSettings"),
  ]),
];
