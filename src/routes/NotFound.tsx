import { Link } from "react-router-dom";
import { PublicShell } from "../components/layout/PublicShell";
import { Button } from "../components/ui/Button";
import { card } from "../lib/ui";
import { cn } from "../lib/cn";

export function NotFound() {
  return (
    <PublicShell>
      <div className={cn("mx-auto max-w-md space-y-4 p-10 text-center", card)}>
        <div className="font-display gradient-text text-5xl font-semibold tracking-tight">
          404
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
        <p className="text-sm text-slate-500">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <Link to="/" className="block">
          <Button variant="primary" className="w-full">
            Back to home
          </Button>
        </Link>
      </div>
    </PublicShell>
  );
}
