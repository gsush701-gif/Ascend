import { Link } from "react-router-dom";
import { LegalBullets, LegalPage, LegalSection } from "../components/legal/LegalLayout";
import { CONTACT_EMAIL, REFUND_WINDOW_DAYS, REFUNDS_UPDATED } from "../config/legal";

export function Refunds() {
  return (
    <LegalPage
      title="Refund Policy"
      updated={REFUNDS_UPDATED}
      intro={
        <>
          Ascend is free to try, so you can see whether it helps before you pay. This page explains how cancelling and
          refunds work for the paid Pro plan. Paid plans are not open for purchase yet. This is how they will work when
          they are.
        </>
      }
    >
      <LegalSection title="Cancelling">
        <LegalBullets
          items={[
            "You can cancel any time from Plan & billing in your account. You don't need to contact us.",
            "Cancelling stops the next monthly renewal. You keep Pro until the end of the month you've already paid for.",
            "Deleting your account also cancels your subscription straight away.",
          ]}
        />
      </LegalSection>

      <LegalSection title={`Money-back within ${REFUND_WINDOW_DAYS} days`}>
        <p>
          If you decide Pro isn&apos;t for you, tell us within <strong className="text-slate-800">{REFUND_WINDOW_DAYS} days
          of your first payment</strong> and we&apos;ll refund that payment in full. No explanation needed.
        </p>
      </LegalSection>

      <LegalSection title="After that">
        <LegalBullets
          items={[
            "Later monthly payments aren't refunded for the part of the month already used, but you can cancel so you aren't charged again.",
            "If you were charged by mistake, charged twice, or a technical fault stopped you from using something you paid for, contact us and we'll put it right, usually with a refund.",
            "Where the law gives you a right to a refund, you keep that right.",
          ]}
        />
      </LegalSection>

      <LegalSection title="How to ask">
        {CONTACT_EMAIL ? (
          <p>
            Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-cyan-700 underline">
              {CONTACT_EMAIL}
            </a>{" "}
            from the address on your account, and say you&apos;d like a refund. We aim to reply within 3 working days, and
            refunds go back to the original card through Stripe, which can take a few days to show on your statement.
          </p>
        ) : (
          <p>
            Contact us through the Ascend website from the address on your account. Refunds go back to the original card
            through Stripe, which can take a few days to show on your statement.
          </p>
        )}
        <p>
          See also our{" "}
          <Link to="/terms" className="underline hover:text-slate-900">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline hover:text-slate-900">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
