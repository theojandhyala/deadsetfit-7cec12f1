import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "DEADSET — Privacy Policy" },
      { name: "description", content: "How DEADSET collects, uses, and protects your personal data." },
      { property: "og:title", content: "DEADSET — Privacy Policy" },
      { property: "og:description", content: "How DEADSET collects, uses, and protects your personal data." },
      { property: "og:url", content: "https://deadsetfit.org/privacy" },
      { name: "twitter:title", content: "DEADSET — Privacy Policy" },
      { name: "twitter:description", content: "How DEADSET collects, uses, and protects your personal data." },
    ],
    links: [{ rel: "canonical", href: "https://deadsetfit.org/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="June 3, 2026">
      <p>
        DEADSET ("we", "us") provides a fitness tracking and social training app. This
        policy explains what we collect, why, and your rights. By using DEADSET you
        agree to this policy.
      </p>

      <H>1. Data we collect</H>
      <ul>
        <li><b>Account:</b> email, password (hashed), optional Google or Apple ID, username, display name, avatar.</li>
        <li><b>Profile & training:</b> age, gender, height, weight, goal, experience, equipment, injuries, workouts, sets, reps, PRs, streaks, scores.</li>
        <li><b>Social:</b> posts, comments, likes, follows, reports you file, users you block.</li>
        <li><b>Technical:</b> device type, OS, app version, IP address, crash logs.</li>
      </ul>

      <H>2. How we use it</H>
      <ul>
        <li>Provide and personalize the app (training plans, PRs, leaderboard).</li>
        <li>Authenticate you and keep your account secure.</li>
        <li>Show your public stats to other athletes (only fields you choose to share).</li>
        <li>Detect abuse, enforce our Terms, and respond to reports.</li>
        <li>Improve the product through aggregated, non-identifying analytics.</li>
      </ul>

      <H>3. Sharing</H>
      <p>
        We do <b>not</b> sell your personal data. We share data only with: (a) infrastructure
        providers that host the app (Supabase / Lovable Cloud); (b) authentication
        providers you choose (Google, Apple); (c) authorities when legally required.
      </p>

      <H>4. Public data</H>
      <p>
        Your username, display name, avatar, public stats, posts, and comments are visible
        to other DEADSET users. Sensitive fields (email, weight history, injuries, goal,
        body measurements) stay private to your account.
      </p>

      <H>5. Your rights</H>
      <ul>
        <li><b>Access & export:</b> contact <a href="mailto:privacy@deadsetfit.org" className="text-accent-red underline">privacy@deadsetfit.org</a>.</li>
        <li><b>Deletion:</b> use Profile → "Delete My Account" to permanently erase your account, profile, posts, comments, follows, and training data.</li>
        <li><b>Correction:</b> update profile data in-app at any time.</li>
        <li><b>Withdraw consent:</b> sign out and delete your account.</li>
      </ul>

      <H>6. Children</H>
      <p>DEADSET is not for users under 13. We do not knowingly collect data from children.</p>

      <H>7. Retention</H>
      <p>
        We keep account data while your account exists. After deletion, data is removed
        within 30 days, except where retention is legally required.
      </p>

      <H>8. Security</H>
      <p>
        Data is transmitted over HTTPS and stored in access-controlled databases with
        row-level security. No method is 100% secure; report suspected incidents to{" "}
        <a href="mailto:security@deadsetfit.org" className="text-accent-red underline">security@deadsetfit.org</a>.
      </p>

      <H>9. Changes</H>
      <p>We may update this policy. Material changes will be announced in-app.</p>

      <H>10. Contact</H>
      <p>DEADSET — <a href="mailto:privacy@deadsetfit.org" className="text-accent-red underline">privacy@deadsetfit.org</a></p>
    </LegalShell>
  );
}

export function LegalShell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-grit text-grit px-5 py-10" style={{ paddingTop: "calc(env(safe-area-inset-top) + 32px)" }}>
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="label-cap text-grit-dim">← Back</Link>
        <h1 className="display text-4xl font-extrabold uppercase mt-4 mb-1">{title}</h1>
        <p className="label-cap text-grit-dim mb-8">Last updated: {updated}</p>
        <div className="space-y-3 text-sm leading-relaxed">{children}</div>
        <div className="mt-10 flex gap-4 label-cap text-grit-dim">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/disclaimer">Disclaimer</Link>
        </div>
      </div>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="display text-lg font-extrabold uppercase text-grit mt-6 mb-1">{children}</h2>;
}
