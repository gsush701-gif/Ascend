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
//
// Privacy: a report carries the page address and a trail of what happened
// before the error. Sign-in secrets in the address bar, console output and
// personal details are removed before anything is sent (src/lib/scrubReport.ts).
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Promise.all([import("@sentry/react"), import("./lib/scrubReport")])
    .then(([Sentry, { scrubEvent, scrubBreadcrumb }]) => {
      Sentry.init({
        dsn: sentryDsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.1,
        sendDefaultPii: false,
        beforeSend: (event) => scrubEvent(event),
        beforeSendTransaction: (event) => scrubEvent(event),
        beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
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
