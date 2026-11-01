import { Link } from "react-router-dom";
import { LegalBullets, LegalPage, LegalSection } from "../components/legal/LegalLayout";
import { CONTACT_EMAIL, GOVERNING_LAW, REFUND_WINDOW_DAYS, TERMS_UPDATED } from "../config/legal";

export function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      updated={TERMS_UPDATED}
      intro={
        <>
          These are the rules for using Ascend, in plain language. By creating an account or using Ascend, including its
          Chrome extension, you agree to them. If you don&apos;t agree, please don&apos;t use it.
        </>
      }
    >
      <div className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50/60 p-4">
        <h2 className="text-sm font-semibold text-slate-900">The short version</h2>
        <div className="mt-2 text-sm text-slate-600">
          <LegalBullets
            items={[
              "Ascend is a tool to help you prepare job applications. It can't promise you interviews or offers.",
              "AI suggestions can be wrong. Check everything, and only put true things on your resume.",
              "Your resume and data stay yours. You can delete your account any time.",
              "Be fair: no abuse, no sharing accounts, no getting around limits.",
            ]}
          />
        </div>
      </div>

      <LegalSection title="1. Who these terms are with">
        <p>
          &ldquo;Ascend&rdquo;, &ldquo;we&rdquo; and &ldquo;us&rdquo; mean the people who run Ascend at
          ascendcareers.app. &ldquo;You&rdquo; means the person using it. You must be at least 16 to use Ascend. How we
          handle your information is explained in our{" "}
          <Link to="/privacy" className="underline hover:text-slate-900">
            Privacy Policy
          </Link>
          , which is part of these terms.
        </p>
      </LegalSection>

      <LegalSection title="2. Your account">
        <LegalBullets
          items={[
            "Give accurate details and keep your password and sign-in methods secure. You are responsible for what happens under your account.",
            "One account is for one person. Don't share it or sell access to it.",
            "Tell us if you think someone else has got into your account.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. What Ascend does, and what it doesn't">
        <p>
          Ascend compares your resume with job postings, tracks your applications, and uses AI to help you write and
          practise. Please understand its limits:
        </p>
        <LegalBullets
          items={[
            <>
              <strong className="text-slate-800">Scores and advice are estimates.</strong> A fit score is how well your
              resume shows what a posting asks for. It is not a prediction of whether you will be hired.
            </>,
            <>
              <strong className="text-slate-800">AI can be wrong.</strong> Suggestions, rewrites, cover letters and
              interview feedback may be inaccurate or incomplete. Read and edit everything before you use it.
            </>,
            <>
              <strong className="text-slate-800">You are responsible for your applications.</strong> Only include
              experience, skills and results that are true. Where Ascend leaves a blank for you to fill in, fill it in
              honestly or remove it.
            </>,
            <>
              <strong className="text-slate-800">We are not a recruiter or a career counsellor.</strong> Ascend does not
              find you a job, represent you to employers, or guarantee any result.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Your content">
        <p>
          Your resumes, job descriptions, notes, answers and other content stay yours. To run Ascend for you, you give us
          permission to store and process that content, including sending the relevant text to the AI and voice providers
          listed in the Privacy Policy, only to give you the features you ask for. We don&apos;t use your content to train
          our own models.
        </p>
        <p>
          Only upload things you have the right to use. Don&apos;t upload someone else&apos;s resume or personal details
          without their permission.
        </p>
      </LegalSection>

      <LegalSection title="5. Using Ascend fairly">
        <p>You agree not to:</p>
        <LegalBullets
          items={[
            "break the law, or use Ascend to harass, deceive or harm anyone;",
            "put false information on an application, or use Ascend to impersonate another person;",
            "try to get around usage limits, paid features or security, or share paid access with others;",
            "copy, scrape, resell or reverse engineer Ascend, or send automated or excessive requests to it;",
            "upload files that contain malware, or content you have no right to share;",
            "interfere with other people's use of Ascend.",
          ]}
        />
        <p>We may limit or suspend an account that breaks these rules, and we will say why where we can.</p>
      </LegalSection>

      <LegalSection title="6. Free and paid plans">
        <p>
          Ascend has a free plan with monthly usage limits. Some features, such as voice interview practice, are planned
          as part of a paid Pro plan. Plans, prices and limits are shown in the app, and we may change them. If we change
          something that affects a plan you are paying for, we will tell you before it applies to you.
        </p>
        <p>When paid plans are available:</p>
        <LegalBullets
          items={[
            "Pro is a subscription that renews every month until you cancel. The price is shown at checkout, before you pay, and taxes may be added.",
            "Payments are handled by Stripe. We never see or store your full card number.",
            "You can cancel at any time from Plan & billing in your account. Cancelling stops the next renewal, and you keep Pro until the end of the period you've paid for.",
            <>
              Refunds are covered in our{" "}
              <Link to="/refunds" className="underline hover:text-slate-900">
                Refund Policy
              </Link>
              . In short: if you ask within {REFUND_WINDOW_DAYS} days of your first payment, we refund it.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="7. The Chrome extension and other websites">
        <p>
          The Ascend extension works with LinkedIn and Indeed pages that you open yourself. Those sites have their own
          terms, and you are responsible for following them when you use any tool alongside them. Ascend is an
          independent product and is not affiliated with, endorsed by, or sponsored by LinkedIn, Indeed, or any employer.
        </p>
      </LegalSection>

      <LegalSection title="8. Ending your use of Ascend">
        <p>
          You can stop using Ascend at any time and delete your account from the account menu, which also cancels any
          subscription. We may suspend or end an account that seriously or repeatedly breaks these terms. When an account
          ends, your content is deleted as described in the Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection title="9. No guarantees, and limits on our responsibility">
        <p>
          Ascend is provided &ldquo;as is&rdquo;. We work hard to keep it accurate and available, but we can&apos;t
          promise that it will be uninterrupted, error-free, or that any result or advice is right for you.
        </p>
        <p>
          To the extent the law allows, we are not responsible for indirect or consequential losses, including missed
          job opportunities, rejected applications, or lost data you chose not to keep elsewhere. Our total responsibility
          to you for anything connected to Ascend is limited to the amount you paid us in the 12 months before the issue
          arose, or US$50 if you paid nothing. Nothing in these terms limits any right you have by law that cannot be
          limited.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to these terms">
        <p>
          We may update these terms as Ascend grows. We will change the date at the top and, for significant changes, tell
          you in the app or by email. If you keep using Ascend after a change takes effect, you accept the new terms.
        </p>
      </LegalSection>

      {GOVERNING_LAW && (
        <LegalSection title="11. Governing law">
          <p>These terms are governed by the laws of {GOVERNING_LAW}.</p>
        </LegalSection>
      )}

      <LegalSection title={GOVERNING_LAW ? "12. Contact" : "11. Contact"}>
        {CONTACT_EMAIL ? (
          <p>
            Questions about these terms:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-cyan-700 underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        ) : (
          <p>For questions about these terms, contact us through the Ascend website.</p>
        )}
      </LegalSection>
    </LegalPage>
  );
}
