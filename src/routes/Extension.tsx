import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Download, Chrome } from "lucide-react";
import { PublicShell } from "../components/layout/PublicShell";
import { Button } from "../components/ui/Button";
import { EXTENSION_STORE_URL, EXTENSION_ZIP_PATH } from "../config/extension";

function Step({ n, title, children }: { n: number; title: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
        {n}
      </span>
      <div className="min-w-0 text-sm text-slate-700">
        <div className="font-medium text-slate-900">{title}</div>
        {children && <div className="mt-0.5 text-slate-600">{children}</div>}
      </div>
    </li>
  );
}

export function Extension() {
  return (
    <PublicShell>
      <article className="mx-auto max-w-2xl pt-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">
          Save jobs from LinkedIn and Indeed in one click
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The Ascend extension for Chrome copies the job title, company and description from the posting you&apos;re
          looking at, so you don&apos;t retype it. It lands in your Roles list with a link back to the posting, ready to
          analyse against your resume.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {EXTENSION_STORE_URL ? (
            <>
              <a href={EXTENSION_STORE_URL} target="_blank" rel="noreferrer">
                <Button variant="primary">
                  <span className="inline-flex items-center gap-2">
                    <Chrome size={16} />
                    Add to Chrome
                  </span>
                </Button>
              </a>
              <a href={EXTENSION_ZIP_PATH} download className="text-sm text-slate-600 underline hover:text-slate-900">
                Or install it by hand
              </a>
            </>
          ) : (
            <a href={EXTENSION_ZIP_PATH} download>
              <Button variant="primary">
                <span className="inline-flex items-center gap-2">
                  <Download size={16} />
                  Download for Chrome
                </span>
              </Button>
            </a>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">Chrome and other Chromium browsers (Edge, Brave). Free.</p>

        {!EXTENSION_STORE_URL && (
          <section className="mt-9">
            <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Install it (2 minutes)</h2>
            <p className="mt-1 text-sm text-slate-500">
              It isn&apos;t in the Chrome Web Store yet, so you add it yourself. This is safe and Chrome will remind you
              it&apos;s a developer extension.
            </p>
            <ol className="mt-4 space-y-3">
              <Step n={1} title="Download and unzip the file">
                Right-click the zip and choose <strong>Extract all</strong> (on a Mac, double-click it). You get a
                folder.
              </Step>
              <Step n={2} title="Open Chrome's extensions page">
                Type <code className="rounded bg-slate-100 px-1">chrome://extensions</code> in the address bar, then
                turn on <strong>Developer mode</strong> in the top right.
              </Step>
              <Step n={3} title="Load the folder">
                Click <strong>Load unpacked</strong> and choose the folder you just unzipped, the one that contains{" "}
                <code className="rounded bg-slate-100 px-1">manifest.json</code>.
              </Step>
              <Step n={4} title="Pin it">
                Click the puzzle-piece icon in Chrome&apos;s toolbar and pin <strong>Ascend</strong>.
              </Step>
            </ol>
          </section>
        )}

        <section className="mt-9">
          <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Using it</h2>
          <ol className="mt-4 space-y-3">
            <Step n={1} title="Open a job on LinkedIn or Indeed" />
            <Step n={2} title="Click the Ascend icon">
              Sign in once with your Ascend email and password. Check the company, role and description it filled in,
              fix anything that&apos;s wrong, and press <strong>Save to Ascend</strong>.
            </Step>
            <Step n={3} title="Open it in Ascend">
              It&apos;s in your Roles list as a Wishlist role with a link to the original posting. Open it and run the
              analysis.
            </Step>
          </ol>
        </section>

        <section className="mt-9 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <h2 className="font-medium text-slate-900">Signed up with Google?</h2>
          <p className="mt-1">
            The extension signs in with an email and password. If you only ever used &ldquo;Sign in with Google&rdquo;,
            go to the{" "}
            <Link to="/forgot-password" className="underline hover:text-slate-900">
              forgot password page
            </Link>{" "}
            and enter your Google email. You&apos;ll get a link to set a password, and you can still use Google on the
            website afterwards.
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <h2 className="font-medium text-slate-900">What it can see</h2>
          <p className="mt-1">
            It only runs on LinkedIn and Indeed job pages, and reads the job details on the page you have open to fill
            in the form. Nothing leaves your browser until you press Save, and it never reads other sites or your
            browsing history. Details are in the{" "}
            <Link to="/privacy" className="underline hover:text-slate-900">
              privacy policy
            </Link>
            .
          </p>
          <p className="mt-2">
            Job sites change their pages often. If a field comes up empty, just type it in. That always works.
          </p>
        </section>
      </article>
    </PublicShell>
  );
}
