import { useEffect, useState } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import type { SharedProfileData } from "./types/analyzer";

import { ProfileView } from "./components/ProfileView";
import { Landing } from "./routes/Landing";
import { Dashboard } from "./routes/Dashboard";
import { Analyzer } from "./routes/Analyzer";
import { Roles } from "./routes/Roles";
import { Contacts } from "./routes/Contacts";
import { RoleDetail } from "./routes/RoleDetail";
import { InterviewPrep } from "./routes/InterviewPrep";
import { Profile } from "./routes/Profile";
import { ResumeLab } from "./routes/ResumeLab";
import { Resumes } from "./routes/Resumes";
import { Login } from "./routes/Login";
import { Signup } from "./routes/Signup";
import { ForgotPassword } from "./routes/ForgotPassword";
import { ResetPassword } from "./routes/ResetPassword";
import { NotFound } from "./routes/NotFound";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

export default function App() {
  const [sharedProfileView, setSharedProfileView] = useState<{
    username: string;
    data: SharedProfileData;
  } | null>(null);

  const location = useLocation();

  useEffect(() => {
    const pathname = window.location.pathname.replace(/\/$/, "") || "/";
    const segment = pathname.slice(1).split("/")[0];
    const params = new URLSearchParams(window.location.search);
    const d = params.get("d");
    const isReserved =
      segment === "analyzer" ||
      segment === "tracker" ||
      segment === "insights";
    if (segment && d && !isReserved) {
      try {
        const decoded = JSON.parse(atob(d)) as SharedProfileData;
        if (
          decoded &&
          Array.isArray(decoded.skills) &&
          typeof decoded.strength === "number" &&
          Array.isArray(decoded.history)
        ) {
          setSharedProfileView({ username: segment, data: decoded });
          return;
        }
      } catch {
        // ignore
      }
    }
    setSharedProfileView(null);
  }, [location.pathname, location.search]);

  const mainContent = sharedProfileView ? (
    <ProfileView
      username={sharedProfileView.username}
      data={sharedProfileView.data}
      onBack={() => {
        setSharedProfileView(null);
        window.history.replaceState(null, "", "/");
      }}
    />
  ) : (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Private (app) — requires login */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/roles" element={<ProtectedRoute><Roles /></ProtectedRoute>} />
      <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
      <Route path="/roles/:id" element={<ProtectedRoute><RoleDetail /></ProtectedRoute>} />
      <Route path="/roles/:id/interview-prep" element={<ProtectedRoute><InterviewPrep /></ProtectedRoute>} />
      <Route path="/analyzer" element={<ProtectedRoute><Analyzer /></ProtectedRoute>} />
      <Route path="/tracker" element={<Navigate to="/roles" replace />} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/resume-lab" element={<ProtectedRoute><ResumeLab /></ProtectedRoute>} />
      <Route path="/resumes" element={<ProtectedRoute><Resumes /></ProtectedRoute>} />
      <Route path="/insights" element={<Navigate to="/dashboard" replace />} />
      <Route path="/settings" element={<Navigate to="/profile" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );

  return <>{mainContent}</>;
}
