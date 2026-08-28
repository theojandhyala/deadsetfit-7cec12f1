import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "./privacy";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "DEADSET — Terms of Service" },
      { name: "description", content: "The rules for using DEADSET." },
      { property: "og:title", content: "DEADSET — Terms of Service" },
      { property: "og:description", content: "The rules for using DEADSET." },
      { property: "og:url", content: "https://deadsetfit.org/terms" },
      { name: "twitter:title", content: "DEADSET — Terms of Service" },
      { name: "twitter:description", content: "The rules for using DEADSET." },
    ],
    links: [{ rel: "canonical", href: "https://deadsetfit.org/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="August 28, 2026">
      <p>
        By creating an account or using DEADSET, you agree to these Terms. If you do not agree, do
        not use the app.
      </p>

      <H>1. Eligibility</H>
      <p>You must be at least 13 years old and able to form a binding contract.</p>

      <H>2. Your account</H>
      <p>
        You're responsible for your credentials and all activity on your account. Keep your password
        private and notify us at{" "}
        <a href="mailto:support@deadsetfit.org" className="text-accent-red underline">
          support@deadsetfit.org
        </a>{" "}
        of any unauthorized use.
      </p>

      <H>3. Acceptable use</H>
      <p>You agree not to:</p>
      <ul>
        <li>Post content that is illegal, hateful, harassing, sexual, violent, or infringing.</li>
        <li>Impersonate others, scrape data, reverse-engineer the app, or abuse our APIs.</li>
        <li>Harass, bully, threaten, or target other users.</li>
        <li>Upload malware or attempt to disrupt the service.</li>
      </ul>
      <p>
        We enforce a <b>zero-tolerance policy</b> for objectionable content and abusive users. We
        may remove content and suspend or delete accounts at our discretion, without notice. Reports
        filed in-app are reviewed within 24 hours.
      </p>

      <H>4. User content</H>
      <p>
        You keep ownership of content you post. You grant DEADSET a worldwide, royalty-free license
        to host, display, and distribute it inside the service so we can operate the app.
      </p>

      <H>5. Health & fitness disclaimer</H>
      <p>
        DEADSET is an information and tracking tool, not medical advice. See our{" "}
        <a href="/disclaimer" className="text-accent-red underline">
          Disclaimer
        </a>{" "}
        before training.
      </p>

      <H>6. Subscriptions & payments</H>
      <p>
        New subscriptions are sold as monthly or annual auto-renewing memberships in the iPhone app
        and are processed by Apple. Eligible new subscribers receive the seven-day introductory
        trial shown on Apple&apos;s purchase confirmation; after that, the selected membership
        renews at £5.99 per month or £39.99 per year in the UK, or the exact local price Apple
        displays. If your Apple Account is not eligible for an introductory offer, billing starts
        when you confirm. Subscriptions renew automatically unless cancelled at least 24 hours
        before the end of the current period and can be managed in your App Store account. Any
        legacy website subscription remains subject to the terms shown when it was purchased.
        Membership access remains available through any active trial or paid period.
      </p>

      <H>7. Termination</H>
      <p>
        You may delete your account at any time from Profile → "Delete My Account". Deleting your
        DEADSET account does not cancel an App Store subscription; cancel it through Apple&apos;s
        subscription management first if you no longer want it to renew. We may suspend or terminate
        accounts that violate these Terms.
      </p>

      <H>8. Disclaimer of warranties</H>
      <p>
        DEADSET is provided "as is" without warranties of any kind, express or implied, to the
        maximum extent permitted by law.
      </p>

      <H>9. Limitation of liability</H>
      <p>
        To the maximum extent permitted by law, DEADSET is not liable for indirect, incidental, or
        consequential damages, or for any injury arising from training decisions you make.
      </p>

      <H>10. Governing law</H>
      <p>
        These Terms are governed by the laws of the user's country of residence where required by
        mandatory law, otherwise by Swedish law.
      </p>

      <H>11. Changes</H>
      <p>We may update these Terms. Continued use after changes means you accept them.</p>

      <H>12. Contact</H>
      <p>
        <a href="mailto:support@deadsetfit.org" className="text-accent-red underline">
          support@deadsetfit.org
        </a>
      </p>
    </LegalShell>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="display text-lg font-extrabold uppercase text-grit mt-6 mb-1">{children}</h2>
  );
}
