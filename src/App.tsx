import { Routes, Route, Navigate } from "react-router-dom";

import { Landing } from "./routes/Landing";
import { PublicProfile } from "./routes/PublicProfile";
import { Dashboard } from "./routes/Dashboard";
import { Analyzer } from "./routes/Analyzer";
import { Grok } from "./routes/Grok";
import { Roles } from "./routes/Roles";
import { Contacts } from "./routes/Contacts";
import { Goals } from "./routes/Goals";
import { Analytics } from "./routes/Analytics";
import { Companies } from "./routes/Companies";
import { Jobs } from "./routes/Jobs";
import { Report } from "./routes/Report";
import { RoleDetail } from "./routes/RoleDetail";
import { CoverLetter } from "./routes/CoverLetter";
import { InterviewPrep } from "./routes/InterviewPrep";
import { VoiceInterview } from "./routes/VoiceInterview";
// TEMPORARILY DISABLED — Profile page access is turned off for now (see the
// /profile route below). Restore by uncommenting this import and the real
// route. The implementation itself (src/routes/Profile.tsx) is untouched —
// the independent account menu (src/components/layout/TopNav.tsx) covers
// Edit Profile / Change Password / etc. in the meantime.
// import { Profile } from "./routes/Profile";
import { Admin } from "./routes/Admin";
import { ResumeLab } from "./routes/ResumeLab";
import { Resumes } from "./routes/Resumes";
import { ResumeEditor } from "./routes/ResumeEditor";
import { Login } from "./routes/Login";
import { Signup } from "./routes/Signup";
import { ForgotPassword } from "./routes/ForgotPassword";
import { ResetPassword } from "./routes/ResetPassword";
import { NotFound } from "./routes/NotFound";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Public shareable profile — see src/routes/PublicProfile.tsx and
          supabase/migrations/017_public_profiles.sql. Replaces the old
          /{slug}?d=<base64> mechanism entirely (no more reserved-segment
          disambiguation needed since this is a real, fixed route prefix). */}
      <Route path="/u/:slug" element={<PublicProfile />} />
      {/* Private (app) — requires login */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/roles" element={<ProtectedRoute><Roles /></ProtectedRoute>} />
      <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
      <Route path="/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
      <Route path="/companies" element={<ProtectedRoute><Companies /></ProtectedRoute>} />
      <Route path="/companies/:companyName" element={<ProtectedRoute><Companies /></ProtectedRoute>} />
      <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
      <Route path="/roles/:id" element={<ProtectedRoute><RoleDetail /></ProtectedRoute>} />
      <Route path="/roles/:id/cover-letter" element={<ProtectedRoute><CoverLetter /></ProtectedRoute>} />
      <Route path="/roles/:id/interview-prep" element={<ProtectedRoute><InterviewPrep /></ProtectedRoute>} />
      <Route path="/roles/:id/voice-interview" element={<ProtectedRoute><VoiceInterview /></ProtectedRoute>} />
      <Route path="/analyzer" element={<ProtectedRoute><Analyzer /></ProtectedRoute>} />
      <Route path="/grok" element={<ProtectedRoute><Grok /></ProtectedRoute>} />
      <Route path="/tracker" element={<Navigate to="/roles" replace />} />
      {/* TEMPORARILY DISABLED — redirects to /dashboard instead of rendering
          the Profile page. Restore by deleting this line and uncommenting
          the real route + import above. Still wrapped in ProtectedRoute so
          an unauthenticated visit keeps redirecting to
          /login?next=/profile exactly as before. */}
      <Route path="/profile" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
      {/* <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} /> */}
      {/* Requires login (ProtectedRoute) but the real admin gate is entirely
          server-side — see server/middleware/requireAdmin.js. A logged-in
          non-admin sees a clean "Not authorized" state driven by the actual
          403 from GET /api/admin/overview (src/routes/Admin.tsx), not a
          client-side guess. */}
      <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      <Route path="/resume-lab" element={<ProtectedRoute><ResumeLab /></ProtectedRoute>} />
      <Route path="/resumes" element={<ProtectedRoute><Resumes /></ProtectedRoute>} />
      <Route path="/resumes/:id/edit" element={<ProtectedRoute><ResumeEditor /></ProtectedRoute>} />
      <Route path="/insights" element={<Navigate to="/dashboard" replace />} />
      <Route path="/settings" element={<Navigate to="/profile" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
