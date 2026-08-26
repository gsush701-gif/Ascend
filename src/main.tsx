import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { ToastProvider } from "./components/ui/ToastProvider";
import { AuthProvider } from "./context/AuthContext";

// Sentry-ready observability, with graceful no-op: only initializes (and
// only pulls the @sentry/react bundle via this dynamic import) when
// VITE_SENTRY_DSN is set. The project owner doesn't have a Sentry account
// set up yet — activate later by setting VITE_SENTRY_DSN (see .env.example).
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn: sentryDsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.1,
      });
    })
    .catch((e) => {
      console.warn("[sentry] failed to initialize, continuing without it:", e);
    });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
