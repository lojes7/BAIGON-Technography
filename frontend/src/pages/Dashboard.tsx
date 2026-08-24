import { useAuth } from "../auth/AuthContext";
import AdminDashboard from "./AdminDashboard";
import StudentDashboard from "./StudentDashboard";
import TeacherDashboard from "./TeacherDashboard";
import StudentAffairsDashboard from "./StudentAffairsDashboard";
import AnalystDashboard from "./AnalystDashboard";
import ReviewerDashboard from "./ReviewerDashboard";

export default function DashboardPage() {
  const { user } = useAuth();
  if (user?.role === "student") return <StudentDashboard />;
  if (user?.role === "teacher") return <TeacherDashboard />;
  if (user?.role === "student_affair") return <StudentAffairsDashboard />;
  if (user?.role === "analyst") return <AnalystDashboard />;
  if (user?.role === "reviewer") return <ReviewerDashboard />;
  return <AdminDashboard />;
}
