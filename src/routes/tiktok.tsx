import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  Smartphone,
  Trophy,
} from "lucide-react";
import { trackWhopEvent } from "@/lib/whop";

const appStoreUrl = import.meta.env.VITE_APP_STORE_URL?.trim() || "https://apps.apple.com/";

export const Route = createFileRoute("/tiktok")({
  head: () => ({
    meta: [
      { title: "DEADSET — Train like it counts." },
      {
        name: "description",
        content: "The gym tracker for people who train with intent.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TikTokCreative,
});

const slides = [
  {
    kicker: "01 / THE HOOK",
    title: (
      <>
        YOUR TRAINING
        <br />
        <span className="text-[#e63222]">
          DESERVES A<br />
          RECORD.
        </span>
      </>
    ),
    body: "Not another fitness feed. A place to log the work, see the pattern, and get stronger on purpose.",
    type: "hero",
  },
  {
    kicker: "02 / LOG THE WORK",
    title: (
      <>
        EVERY SET.
        <br />
        <span className="text-[#e63222]">ZERO GUESSWORK.</span>
      </>
    ),
    body: "Build the session. Track weight, reps and rest. Walk out knowing exactly what to beat next time.",
    type: "logger",
  },
  {
    kicker: "03 / SEE THE PROOF",
    title: (
      <>
        PROGRESS ISN'T
        <br />
        <span className="text-[#e63222]">A FEELING.</span>
      </>
    ),
    body: "Your PRs, volume and consistency—finally visible in one clear picture.",
    type: "progress",
  },
  {
    kicker: "04 / STAY IN IT",
    title: (
      <>
        TRAIN WITH
        <br />
        <span className="text-[#e63222]">INTENT.</span>
      </>
    ),
    body: "Plans, nutrition, recovery and your training history—built around the lift, not the noise.",
    type: "close",
  },
] as const;

function StoreButton({ className = "" }: { className?: string }) {
  return (
    <a
      className={`inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[#e63222] px-6 text-sm font-black uppercase tracking-[0.08em] text-white shadow-[0_16px_36px_rgba(230,50,34,0.32)] transition hover:bg-[#f04332] active:scale-[0.99] ${className}`}
      href={appStoreUrl}
      data-tiktok-cta="app-store"
      onClick={() => trackWhopEvent("app_store_click")}
    >
      <Smartphone size={22} aria-hidden="true" /> Get DEADSET{" "}
      <ArrowRight size={19} aria-hidden="true" />
    </a>
  );
}

function Phone({ screen, alt }: { screen: string; alt: string }) {
  return (
    <div className="relative mx-auto w-[58%] max-w-[260px] rounded-[2.15rem] border-[7px] border-[#303035] bg-black p-1.5 shadow-[0_28px_70px_rgba(0,0,0,0.55)]">
      <div className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-[#303035]" />
      <img
        src={screen}
        alt={alt}
        className="aspect-[0.46] w-full rounded-[1.65rem] object-cover object-top"
      />
    </div>
  );
}

function SlideVisual({ type }: { type: (typeof slides)[number]["type"] }) {
  if (type === "hero")
    return (
      <div className="absolute inset-0 overflow-hidden bg-[#080809]">
        <img
          src="/screenshots/train.webp"
          alt=""
          aria-hidden="true"
          className="h-full w-full scale-110 object-cover object-top opacity-45 blur-[1px]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black" />
      </div>
    );
  if (type === "logger")
    return <Phone screen="/screenshots/logger.webp" alt="DEADSET workout logger" />;
  if (type === "progress")
    return <Phone screen="/screenshots/profile.webp" alt="DEADSET progress profile" />;
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {[
        { icon: Dumbbell, label: "Train" },
        { icon: Flame, label: "Build" },
        { icon: Trophy, label: "Become" },
      ].map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="grid aspect-square place-items-center border border-white/15 bg-white/[0.04] px-2"
        >
          <div>
            <Icon className="mx-auto text-[#e63222]" size={25} />
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.12em] text-white/65">
              {label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TikTokCreative() {
  const [connected, setConnected] = useState(
    () => new URLSearchParams(window.location.search).get("connected") === "1",
  );
  const [creator, setCreator] = useState<{
    creator_nickname?: string;
    creator_username?: string;
    privacy_level_options?: string[];
    comment_disabled?: boolean;
  } | null>(null);
  const [description, setDescription] = useState(
    "Your training deserves a record. #gymtok #workout #fitness #deadset",
  );
  const [privacy, setPrivacy] = useState("");
  const [allowComments, setAllowComments] = useState(false);
  const [autoAddMusic, setAutoAddMusic] = useState(false);
  const [commercial, setCommercial] = useState(false);
  const [ownBrand, setOwnBrand] = useState(false);
  const [brandedContent, setBrandedContent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const photos = useMemo(
    () =>
      [1, 2, 3, 4].map((number) => `https://deadsetfit.org/tiktok-carousel/01/01-${number}.png`),
    [],
  );

  useEffect(() => {
    if (!connected) return;
    fetch("/api/tiktok/creator-info")
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            (await response.json()).error || "Could not load TikTok account details.",
          );
        return response.json();
      })
      .then((data) => setCreator(data))
      .catch((error) =>
        setResult(
          error instanceof Error ? error.message : "Could not load TikTok account details.",
        ),
      );
  }, [connected]);

  async function publish() {
    if (!confirmed || !privacy || (commercial && !ownBrand && !brandedContent)) return;
    setPosting(true);
    setResult(null);
    try {
      const response = await fetch("/api/tiktok/photo-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          post_mode: "DIRECT_POST",
          photo_images: photos,
          photo_cover_index: 0,
          title: "Train like it counts.",
          description,
          privacy_level: privacy,
          disable_comment: !allowComments,
          auto_add_music: autoAddMusic,
          brand_content_toggle: commercial && brandedContent,
          brand_organic_toggle: commercial && ownBrand,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "TikTok rejected the post.");
      setResult(`TikTok accepted the carousel. Publish ID: ${body.publish_id || "received"}`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "TikTok rejected the post.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[#070708] text-[#f5f5f0]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#070708]/95 px-5 py-3 backdrop-blur">
        <span className="display text-2xl font-bold uppercase leading-none">
          <span>DEAD</span>
          <span className="text-[#e63222]">SET</span>
        </span>
        <StoreButton className="min-h-10 rounded-xl px-4 text-[11px]" />
      </header>

      <section className="border-b border-white/10 px-5 py-5 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/50">
          Carousel creative · swipe to preview
        </p>
        <p className="mt-2 text-sm text-white/70">Four posts. One point: make the work count.</p>
        <ArrowDown
          className="mx-auto mt-3 animate-bounce text-[#e63222]"
          size={19}
          aria-hidden="true"
        />
      </section>

      <section
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 py-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="DEADSET social swipe post preview"
      >
        {slides.map((slide) => (
          <article
            key={slide.kicker}
            className="relative flex h-[min(74vh,700px)] min-h-[540px] w-[min(82vw,390px)] shrink-0 snap-center flex-col overflow-hidden border border-white/10 bg-[#111214] p-6 shadow-2xl"
          >
            {slide.type === "hero" && (
              <>
                <SlideVisual type={slide.type} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/90" />
              </>
            )}
            <div className="relative z-10 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em] text-white/60">
              <span>{slide.kicker}</span>
              <span>DEADSET</span>
            </div>
            <div className={`relative z-10 ${slide.type === "hero" ? "mt-auto" : "mt-10"}`}>
              <h1 className="display text-[2.65rem] font-bold uppercase leading-[0.88] tracking-[0.015em]">
                {slide.title}
              </h1>
              <p className="mt-4 max-w-[30ch] text-sm leading-6 text-white/72">{slide.body}</p>
            </div>
            {slide.type !== "hero" && (
              <div className="relative z-10 my-auto">
                <SlideVisual type={slide.type} />
              </div>
            )}
            <div className="relative z-10 mt-5 flex items-center justify-between border-t border-white/15 pt-4">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">
                Train. Build. Become.
              </span>
              <ChevronRight size={16} className="text-[#e63222]" />
            </div>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-xl px-5 pb-12 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#e63222]">
          Ready when you are
        </p>
        <h2 className="display mt-3 text-4xl font-bold uppercase leading-none">
          Stop scrolling.
          <br />
          Start tracking.
        </h2>
        <div className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm text-white/65">
          {["Log every set", "See your progress", "Build a stronger week"].map((benefit) => (
            <p key={benefit} className="flex items-center gap-3">
              <Check size={16} className="text-[#e63222]" /> {benefit}
            </p>
          ))}
        </div>
        <StoreButton className="mt-7 w-full max-w-sm" />
        <p className="mt-3 text-xs text-white/40">Free to download on the App Store.</p>
      </section>

      <section
        className="mx-auto max-w-xl border-t border-white/10 px-5 py-12"
        aria-label="Export a Photo Mode carousel to TikTok"
      >
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#e63222]">
          Creator export
        </p>
        <h2 className="display mt-3 text-4xl font-bold uppercase leading-none">
          Post this carousel
          <br />
          to TikTok.
        </h2>
        {!connected ? (
          <a
            className="mt-6 inline-flex min-h-14 items-center justify-center rounded-2xl bg-white px-6 text-sm font-black uppercase tracking-[0.08em] text-black"
            href="/api/tiktok/connect"
          >
            Connect TikTok
          </a>
        ) : (
          <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left">
            <p className="text-sm text-white/75">
              Connected as{" "}
              <b>{creator?.creator_nickname || creator?.creator_username || "TikTok creator"}</b>.
              TikTok’s current posting choices are shown below.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {photos.map((src, index) => (
                <img
                  key={src}
                  src={src}
                  alt={`Carousel card ${index + 1}`}
                  className="aspect-[9/16] border border-white/10 object-cover"
                />
              ))}
            </div>
            <label className="block text-xs font-bold uppercase tracking-[0.12em] text-white/65">
              Caption and hashtags
              <textarea
                className="mt-2 min-h-24 w-full rounded-xl border border-white/15 bg-black/30 p-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[#e63222]"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={4000}
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-[0.12em] text-white/65">
              Who can view
              <select
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[#e63222]"
                value={privacy}
                onChange={(event) => setPrivacy(event.target.value)}
              >
                <option value="" disabled>
                  Select privacy status
                </option>
                {(creator?.privacy_level_options || []).map((option) => (
                  <option key={option} value={option}>
                    {option.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/75">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/65">
                Post settings
              </p>
              <label className="flex items-start gap-3">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={allowComments}
                  disabled={creator?.comment_disabled === true}
                  onChange={(event) => setAllowComments(event.target.checked)}
                />{" "}
                Allow comments{" "}
                {creator?.comment_disabled === true ? "(disabled in your TikTok settings)" : ""}
              </label>
              <label className="flex items-start gap-3">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={autoAddMusic}
                  onChange={(event) => setAutoAddMusic(event.target.checked)}
                />{" "}
                Let TikTok add music
              </label>
              <label className="flex items-start gap-3">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={commercial}
                  onChange={(event) => {
                    setCommercial(event.target.checked);
                    if (!event.target.checked) {
                      setOwnBrand(false);
                      setBrandedContent(false);
                    }
                  }}
                />{" "}
                This post promotes a brand, product, or service
              </label>
              {commercial && (
                <div className="space-y-2 border-l-2 border-[#e63222] pl-3 text-xs">
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={ownBrand}
                      onChange={(event) => setOwnBrand(event.target.checked)}
                    />{" "}
                    My own brand — TikTok will label this Promotional content
                  </label>
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={brandedContent}
                      onChange={(event) => setBrandedContent(event.target.checked)}
                    />{" "}
                    A third-party brand — TikTok will label this Paid partnership
                  </label>
                </div>
              )}
            </div>
            <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">
              For Direct Post, only creator-selected original content without promotional overlays
              can be sent through TikTok’s API. Branded DEADSET ads should be posted manually in the
              TikTok app.
            </p>
            <label className="flex items-start gap-3 text-sm text-white/75">
              <input
                className="mt-1"
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />{" "}
              By posting, I agree to TikTok&apos;s Music Usage Confirmation and confirm that I want
              to post these selected images with the caption and privacy setting above.
            </label>
            <button
              type="button"
              disabled={
                !confirmed || !privacy || (commercial && !ownBrand && !brandedContent) || posting
              }
              onClick={publish}
              className="w-full rounded-xl bg-[#e63222] px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {posting ? "Sending to TikTok…" : "Direct post Photo Mode carousel"}
            </button>
            {result && (
              <p className="text-sm text-white/75" role="status">
                {result}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
