import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PublicShell } from "../components/layout/PublicShell";
import { CONTACT_EMAIL, PRIVACY_POLICY_UPDATED } from "../config/legal";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

const PROCESSORS: { name: string; role: string; data: string }[] = [
  {
    name: "Supabase",
    role: "Accounts, database and file storage",
    data: "Your account, everything you save in Ascend, and your uploaded PDFs",
  },
  {
    name: "Groq",
    role: "AI text generation",
    data: "The text of your resume, job descriptions, and your interview answers, sent when you use an AI feature",
  },
  {
    name: "ElevenLabs",
    role: "The interviewer's spoken voice",
    data: "The text of the interviewer's lines (which can refer to things you said). Your voice is never sent to them",
  },
  {
    name: "Stripe",
    role: "Payments for Pro",
    data: "Your payment details, entered on Stripe's own page. We never see or store your card number",
  },
  {
    name: "Render",
    role: "Hosting",
    data: "Our servers run on Render, so requests pass through it",
  },
  {
    name: "Resend",
    role: "Email",
    data: "Your email address and the text of service emails we send you",
  },
  {
    name: "Google and GitHub",
    role: "Optional sign-in",
    data: "If you choose to sign in with them, we receive your email and basic profile details",
  },
  {
    name: "Sentry",
    role: "Error monitoring (if enabled)",
    data: "Technical details about errors, such as the request and error message, not your documents",
  },
];

export function Privacy() {
  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl pt-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">Privacy Policy</h1>
        <p className="mt-1 text-xs text-slate-500">Last updated {PRIVACY_POLICY_UPDATED}</p>

        <p className="mt-5 text-sm leading-relaxed text-slate-600">
          Ascend helps students and new graduates analyse their resume against job descriptions, track
          applications, and practise interviews. To do that we handle personal information, including your
          resume. This page explains what we collect, why, who helps us process it, and what control you have.
        </p>

        <div className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50/60 p-4">
          <h2 className="text-sm font-semibold text-slate-900">The short version</h2>
          <Bullets
            items={[
              "We store what you give us (your account, resumes, roles, notes, interview results) to run Ascend for you.",
              "We do not sell your personal information, and we do not show ads.",
              "When you use an AI feature, the text involved is sent to our AI provider to produce the result. We do not use your content to train our own models.",
              "Your camera preview and your voice are not recorded or uploaded by us.",
              "You can delete your account and everything in it yourself, any time, from the account menu.",
            ]}
          />
        </div>

        <Section title="1. What we collect">
          <p>
            <strong className="text-slate-800">Account details.</strong> Your email address, a password (stored as a
            secure hash, never in plain text), and any name or profile details you add. If you sign in with Google or
            GitHub we receive your email and basic profile information from them.
          </p>
          <p>
            <strong className="text-slate-800">Content you add.</strong> Resumes (the PDF file and its extracted
            text), job descriptions, the roles you track with their notes, deadlines and cover letters, contacts you
            enter, career goals, and the transcripts and scores of your practice interviews. If you connect GitHub,
            we also store basic details about your repositories and an encrypted access token.
          </p>
          <p>
            <strong className="text-slate-800">Payment information.</strong> Payments are handled by Stripe. We keep
            your plan, subscription status and a Stripe customer reference, never your card number.
          </p>
          <p>
            <strong className="text-slate-800">Usage and technical data.</strong> Which features you use and when,
            AI request details (the type of request, model, response time, token counts and estimated cost, never the
            content), error logs, and your IP address for security and rate limiting.
          </p>
        </Section>

        <Section title="2. How we use it">
          <Bullets
            items={[
              "To provide Ascend: analyse your resume, generate cover letters and interview questions, run practice interviews and score them.",
              "To take payment for Pro and apply your plan's limits.",
              "To keep the service secure, prevent abuse, fix bugs and understand how features are used in aggregate.",
              "To send service emails such as account confirmation and notifications you've asked for.",
            ]}
          />
          <p>We do not sell your personal information, and we do not use it for advertising.</p>
        </Section>

        <Section title="3. Who processes it for us">
          <p>
            We rely on the providers below. They handle data only to provide their service to us, under their own
            terms and privacy policies, which also apply to that processing. They may process data in the United
            States and other countries.
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="px-3 py-2 font-medium">Provider</th>
                  <th className="px-3 py-2 font-medium">What it does</th>
                  <th className="px-3 py-2 font-medium">What it receives</th>
                </tr>
              </thead>
              <tbody>
                {PROCESSORS.map((p) => (
                  <tr key={p.name} className="border-b border-slate-100 align-top last:border-0">
                    <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                    <td className="px-3 py-2">{p.role}</td>
                    <td className="px-3 py-2">{p.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            We may also disclose information if the law requires it, or to protect the safety and rights of our users
            and the service.
          </p>
        </Section>

        <Section title="4. Voice interview, microphone and camera">
          <Bullets
            items={[
              "Your answers are turned into text by your browser's built-in speech recognition. In Chrome and Edge that means your browser sends your audio to its own provider (Google or Microsoft) to transcribe it. We never receive or store the audio, only the resulting text.",
              "The interviewer's voice is generated from text by ElevenLabs and played back to you.",
              "The optional camera preview is shown only on your device. It is not recorded, uploaded or sent to us or anyone else, and it switches off when the interview ends.",
            ]}
          />
        </Section>

        <Section title="5. How long we keep it, and deleting it">
          <p>
            We keep your information while your account is open. Deleting a resume inside Ascend removes it from your
            lists, but the underlying file stays until you delete your account or ask us to remove it sooner.
          </p>
          <p>
            When your account is deleted, we delete your account, your saved content, and your uploaded files.
            Technical records such as usage and error logs are detached from you. Copies held in provider backups or
            logs are removed on those providers' normal schedules.
          </p>
          <p>
            If you create a public profile, what you choose to publish is visible to anyone with its link until you
            take it down.
          </p>
        </Section>

        <Section title="6. Your choices">
          <p>
            You can view and edit most of your information inside Ascend. You can delete your account yourself from
            the account menu (Delete account), which also cancels any Pro subscription. You can also ask us to give
            you a copy of your data or to correct it. We aim to respond within 30 days.
            Depending on where you live you may have further rights under local law, and we will honour them where
            they apply.
          </p>
        </Section>

        <Section title="7. Security">
          <p>
            We protect your information with encrypted connections, per-user access controls in our database, and
            encryption of integration tokens. A small number of authorised people can view account and application
            records where needed to run and support the service. No system is perfectly secure, so please use a
            strong, unique password and turn on two-factor authentication in your account menu.
          </p>
        </Section>

        <Section title="8. Age">
          <p>Ascend is not intended for anyone under 16, and we do not knowingly collect their information.</p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>
            If we change this policy we will update the date at the top, and tell you in the app if the change is
            significant.
          </p>
        </Section>

        <Section title="10. Contact">
          {CONTACT_EMAIL ? (
            <p>
              Questions, or a request to access, correct or delete your data:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-cyan-700 underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          ) : (
            <p>For questions or requests about your data, contact us through the Ascend website.</p>
          )}
        </Section>

        <p className="mt-10 text-xs text-slate-400">
          <Link to="/" className="underline hover:text-slate-600">
            Back to Ascend
          </Link>
        </p>
      </article>
    </PublicShell>
  );
}
