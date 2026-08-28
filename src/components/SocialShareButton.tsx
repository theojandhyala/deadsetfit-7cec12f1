import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { getInviteUrl } from "@/lib/referral";

type SocialShareButtonProps = {
  text: string;
  className?: string;
};

/**
 * Shares a small, human-written achievement update. The browser/native share
 * sheet is preferred; copying is a useful fallback on desktop and older webviews.
 */
export function SocialShareButton({ text, className = "" }: SocialShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = await getInviteUrl();
    try {
      if (navigator.share) {
        await navigator.share({ title: "DEADSET", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      // A dismissed native share sheet is an expected outcome, not a reason to
      // write to the clipboard.
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        // Sharing is intentionally optional, so a blocked clipboard is silent.
      }
    }
  }

  return (
    <button type="button" onClick={share} className={className}>
      {copied ? <Check size={15} /> : <Share2 size={15} />}
      {copied ? "Copied" : "Share win"}
    </button>
  );
}
