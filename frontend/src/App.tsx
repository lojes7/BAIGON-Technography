import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import T from "./constants/tokens";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import LoginPage from "./auth/LoginPage";
import { Sidebar, AppHeader, NotificationPanel } from "./components/layout";

// Pages
import DashboardPage from "./pages/Dashboard";
import AIExtractionPage from "./pages/AIExtraction";
import ReviewWorkbenchPage from "./pages/ReviewWorkbench";
import SkillDictionaryPage from "./pages/SkillDictionary";
import GraphBrowserPage from "./pages/GraphBrowser";
import EvolutionTrendsPage from "./pages/EvolutionTrends";
import GapAnalysisPage from "./pages/GapAnalysis";
import ResponseLagPage from "./pages/ResponseLag";
import RecommendationsPage from "./pages/Recommendations";
import DataExportPage from "./pages/DataExport";
import ImportWizardPage from "./pages/ImportWizard";
import RawRecordsPage from "./pages/RawRecords";
import AutoImportPage from "./pages/AutoImport";
import MyStudentsPage from "./pages/MyStudents";
import SkillAnalysisPage from "./pages/SkillAnalysis";
import ProcessingErrorsPage from "./pages/ProcessingErrors";
import AiAnalysesPage from "./pages/AiAnalyses";
import JobDictPage from "./pages/JobDict";
import JobAnalysisPage from "./pages/JobAnalysis";
import JobsPage from "./pages/Jobs";
import GraphSnapshotsPage from "./pages/GraphSnapshots";
import RelationEvidencePage from "./pages/RelationEvidence";
import EvolutionEventsPage from "./pages/EvolutionEvents";
import SkillCombosPage from "./pages/SkillCombos";
import ProgramsPage from "./pages/Programs";
import CourseEvidencePage from "./pages/CourseEvidence";
import ExportHistoryPage from "./pages/ExportHistory";
import ParamsPage from "./pages/Params";
import UsersPage from "./pages/Users";
import AuditLogPage from "./pages/AuditLog";
import TaxonomyPage from "./pages/Taxonomy";
import DisciplineCategoriesPage from "./pages/DisciplineCategories";
import UserProfilePage from "./pages/UserProfile";
import MyResume from "./pages/MyResume";
import MySkills from "./pages/MySkills";
import AccountSettings from "./pages/AccountSettings";
import SkillCompare from "./pages/SkillCompare";
import GapReport from "./pages/GapReport";
import LearningPath from "./pages/LearningPath";
import TeacherManagement from "./pages/TeacherManagement";
import StudentManagement from "./pages/StudentManagement";
import GradeImport from "./pages/GradeImport";

function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: T.bg,
      fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif' }}>
      <Sidebar collapsed={sidebarCollapsed} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AppHeader
          onToggle={() => setSidebarCollapsed(v => !v)}
          onNotif={() => setNotifOpen(v => !v)}
          notifOpen={notifOpen}
        />
        <main className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: "thin" }}>
          <div className="mx-auto w-full min-h-full max-w-[1280px]">
            <Outlet />
          </div>
        </main>
      </div>
      {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { fontSize: 13, fontFamily: '"PingFang SC", sans-serif', borderRadius: 8 },
        }}
      />
    </div>
  );
}

function ProtectedRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

function AdminAuditLogRoute() {
  const { user } = useAuth();
  // 页面级纵深校验：普通用户即使手工输入地址也不能进入审计页面。
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return <AuditLogPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="extraction-tasks" element={<AIExtractionPage />} />
            <Route path="review-queue" element={<ReviewWorkbenchPage />} />
            <Route path="skill-dict" element={<SkillDictionaryPage />} />
            <Route path="graph-browser" element={<GraphBrowserPage />} />
            <Route path="evolution-trends" element={<EvolutionTrendsPage />} />
            <Route path="gap-analysis" element={<GapAnalysisPage />} />
            <Route path="response-lag" element={<ResponseLagPage />} />
            <Route path="recommendations" element={<RecommendationsPage />} />
            <Route path="export-tasks" element={<DataExportPage />} />
            <Route path="import-batches" element={<ImportWizardPage />} />
            <Route path="raw-records" element={<RawRecordsPage />} />
            <Route path="auto-import" element={<AutoImportPage />} />
            <Route path="processing-errors" element={<ProcessingErrorsPage />} />
            <Route path="ai-analyses" element={<AiAnalysesPage />} />
            <Route path="job-analysis" element={<JobAnalysisPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="job-dict" element={<JobDictPage />} />
            <Route path="graph-snapshots" element={<GraphSnapshotsPage />} />
            <Route path="relation-evidence" element={<RelationEvidencePage />} />
            <Route path="evolution-events" element={<EvolutionEventsPage />} />
            <Route path="skill-combos" element={<SkillCombosPage />} />
            <Route path="programs" element={<ProgramsPage />} />
            <Route path="course-evidence" element={<CourseEvidencePage />} />
            <Route path="export-history" element={<ExportHistoryPage />} />
            <Route path="params" element={<ParamsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="audit-log" element={<AdminAuditLogRoute />} />
            <Route path="taxonomy" element={<TaxonomyPage />} />
            <Route path="discipline" element={<DisciplineCategoriesPage />} />
            <Route path="profile" element={<UserProfilePage />} />
            {/* 学生专属路由 */}
            <Route path="my-resume" element={<MyResume />} />
            <Route path="my-skills" element={<MySkills />} />
            <Route path="account-settings" element={<AccountSettings />} />
            <Route path="skill-compare" element={<SkillCompare />} />
            <Route path="gap-report" element={<GapReport />} />
            <Route path="learning-path" element={<LearningPath />} />
            <Route path="teacher-management" element={<TeacherManagement />} />
            <Route path="student-management" element={<StudentManagement />} />
            <Route path="grade-import" element={<GradeImport />} />
            <Route path="my-students" element={<MyStudentsPage />} />
            <Route path="skill-analysis" element={<SkillAnalysisPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
