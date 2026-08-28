import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Check, Dumbbell, Sparkles } from "lucide-react";
import { DEADSET_APP_STORE_URL } from "@/components/Landing";
import { trackWhopEvent } from "@/lib/whop";

export const Route = createFileRoute("/creator")({
  head: () => ({
    meta: [
      { title: "DEADSET Creator Access" },
      {
        name: "description",
        content: "Creator access for lifters who make clear, honest training content.",
      },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "https://deadsetfit.org/creator" }],
  }),
  component: CreatorPage,
});

function CreatorPage() {
  const subject = encodeURIComponent("DEADSET Creator Access");
  const body = encodeURIComponent(
    "Hi DEADSET,\n\nMy creator handle: \nA recent training post: \nWhy my audience would care about Deadset: \n\nI understand this is an access request, not a paid sponsorship.",
  );

  return (
    <main className="min-h-screen bg-[#080808] px-5 py-10 text-[#f4f3ef] sm:px-8">
      <div className="mx-auto max-w-2xl">
        <img
          src="/brand/deadset-lockup.png"
          alt="DEADSET — Forge Your Body"
          width={810}
          height={360}
          className="h-auto w-40"
        />
        <div className="mt-16 rounded-3xl border border-accent-red/45 bg-[#121011] p-7 shadow-[0_22px_70px_rgba(0,0,0,.38)] sm:p-10">
          <Sparkles size={22} className="text-accent-red" />
          <p className="label-cap mt-5 text-[10px] text-accent-red">Creator access</p>
          <h1 className="display mt-2 text-4xl font-extrabold uppercase leading-none sm:text-5xl">
            Make training content people can use.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/65">
            We give a small number of training creators early Pro access and a referral link for
            their audience. We care about useful gym content—not follower count or fake
            transformations.
          </p>
          <div className="mt-7 space-y-3 text-sm text-white/78">
            {[
              "Show a real gym problem and a practical fix.",
              "Use your own footage and your own voice.",
              "No guaranteed results, fake testimonials or spam.",
            ].map((item) => (
              <p key={item} className="flex gap-3">
                <Check size={17} className="mt-0.5 shrink-0 text-accent-red" />
                {item}
              </p>
            ))}
          </div>
          <a
            href={`mailto:support@deadsetfit.org?subject=${subject}&body=${body}`}
            className="btn-grit mt-8 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl text-sm"
          >
            Request creator access <ArrowUpRight size={17} />
          </a>
          <a
            href={DEADSET_APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackWhopEvent("app_store_click")}
            className="mt-3 flex min-h-11 items-center justify-center gap-2 text-xs font-bold text-white/60"
          >
            <Dumbbell size={14} /> Try Deadset first
          </a>
        </div>
      </div>
    </main>
  );
}
