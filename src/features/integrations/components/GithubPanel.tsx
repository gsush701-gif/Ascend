import { useState } from "react";
import { Github, Loader2, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../components/ui/toast";
import { useGithubConnection } from "../hooks/useGithubConnection";
import { useGithubRepos } from "../hooks/useGithubRepos";

/**
 * GitHub integration panel (Phase 7 Task 9). Renders one of three states:
 *   1. Not connected, integration not configured on the server — a plain,
 *      honest explanation (this is the real state today: no GitHub OAuth
 *      App is registered for this project yet).
 *   2. Not connected, integration configured — a real "Connect GitHub"
 *      button plus the explicit "include private repositories" opt-in.
 *   3. Connected — shows the linked GitHub username, a "Sync repositories"
 *      action, the repo list with select/deselect checkboxes, and a
 *      "Disconnect" action.
 */
export function GithubPanel() {
  const { connection, loading: connectionLoading, busy, startConnect, disconnect } = useGithubConnection();
  const connected = Boolean(connection);
  const { repos, loading: reposLoading, syncing, sync, setSelected } = useGithubRepos(connected);
  const [includePrivate, setIncludePrivate] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    const result = await startConnect(includePrivate);
    setConnecting(false);
    if (!result.ok) {
      if (result.reason === "not_configured") {
        setNotConfigured(true);
        return;
      }
      toast.error({ title: "Couldn't start GitHub connection", description: result.message });
      return;
    }
    window.location.href = result.authorizeUrl;
  };

  const handleDisconnect = async () => {
    const { error } = await disconnect();
    if (error) {
      toast.error({ title: "Couldn't disconnect GitHub", description: error });
      return;
    }
    toast.success({ title: "GitHub disconnected" });
  };

  const handleSync = async () => {
    const { error } = await sync();
    if (error) {
      toast.error({ title: "Couldn't sync repositories", description: error });
      return;
    }
    toast.success({ title: "Repositories synced" });
  };

  if (connectionLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (connected && connection) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-dash-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-slate-700" />
            <div>
              <div className="text-sm font-medium text-slate-900">
                Connected as <span className="font-semibold">@{connection.githubUsername}</span>
              </div>
              <div className="text-xs text-slate-500">
                Connected {new Date(connection.connectedAt).toLocaleDateString()}
                {connection.scopes ? ` · scope: ${connection.scopes}` : ""}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span className="ml-1.5">{syncing ? "Syncing…" : "Sync repositories"}</span>
            </Button>
            <Button type="button" variant="dangerOutline" onClick={handleDisconnect} disabled={busy}>
              Disconnect
            </Button>
          </div>
        </div>

        {reposLoading ? (
          <p className="text-sm text-slate-500">Loading repositories…</p>
        ) : repos.length === 0 ? (
          <p className="text-sm text-slate-500">
            No repositories synced yet. Click "Sync repositories" to pull in your GitHub repos.
          </p>
        ) : (
          <div>
            <p className="mb-2 text-xs text-slate-500">
              Select the repos that best represent your work — selected repos are matched against skill gaps
              found in your job analyses (see "Close your skill gaps" on the Analyzer).
            </p>
            <ul className="max-h-80 space-y-1.5 overflow-y-auto">
              {repos.map((repo) => (
                <li
                  key={repo.id}
                  className="flex items-start gap-2 rounded-lg border border-slate-200 bg-[#FFFFFF] px-3 py-2"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    checked={repo.isSelected}
                    onChange={(e) => setSelected(repo.id, e.target.checked)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">{repo.name}</span>
                      {repo.isPrivate && (
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                          Private
                        </span>
                      )}
                    </div>
                    {repo.description && <p className="truncate text-xs text-slate-500">{repo.description}</p>}
                    {repo.topics.length > 0 && (
                      <p className="mt-0.5 text-xs text-slate-400">{repo.topics.join(", ")}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (notConfigured) {
    return (
      <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3">
        <p className="text-sm font-medium text-amber-900">GitHub connection isn't set up yet</p>
        <p className="mt-1 text-xs text-amber-800">
          Ascend's GitHub integration is fully built, but no GitHub OAuth App has been registered for this
          project yet, so connecting isn't available right now. This isn't a bug on your end — check back once
          it's configured.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Connect your GitHub account to import your repositories. Once connected, you can select which repos
        represent your work, and Ascend will match them against skill gaps found in your job analyses —
        surfacing "your GitHub project already covers this" instead of only suggesting a brand-new project idea.
      </p>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={includePrivate}
          onChange={(e) => setIncludePrivate(e.target.checked)}
        />
        Include private repositories
      </label>
      <p className="text-xs text-slate-500">
        By default, only your public repos are requested. Checking this box asks GitHub for access to your
        private repos too — you'll see exactly this on GitHub's own consent screen before anything is granted.
      </p>
      <Button type="button" onClick={handleConnect} disabled={connecting} variant="primary">
        <Github className="h-4 w-4" />
        <span className="ml-1.5">{connecting ? "Connecting…" : "Connect GitHub"}</span>
      </Button>
    </div>
  );
}
