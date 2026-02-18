import { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import type { SharedProfileData } from "./types/analyzer";
import { ProfileView } from "./components/ProfileView";
import { Landing } from "./routes/Landing";
import { Analyzer } from "./routes/Analyzer";
import { Tracker } from "./routes/Tracker";

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
    const isReserved = segment === "analyzer" || segment === "tracker";
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

  if (sharedProfileView) {
    return (
      <ProfileView
        username={sharedProfileView.username}
        data={sharedProfileView.data}
        onBack={() => {
          setSharedProfileView(null);
          window.history.replaceState(null, "", "/");
        }}
      />
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/analyzer" element={<Analyzer />} />
      <Route path="/tracker" element={<Tracker />} />
    </Routes>
  );
}
