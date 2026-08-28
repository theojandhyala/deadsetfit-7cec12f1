import { useCheckInSrc } from "@/hooks/useCheckInSrc";
import type { CheckIn } from "@/lib/types";

/**
 * A check-in photo, wherever its bytes happen to live.
 *
 * A signature that fails degrades to an empty frame rather than a broken-image
 * icon — these sit in grids, and one missing object should not look like the
 * app lost somebody's photos.
 */
export function CheckInImage({
  checkIn,
  className,
  alt = "",
}: {
  checkIn: CheckIn;
  className?: string;
  alt?: string;
}) {
  const src = useCheckInSrc(checkIn);
  if (!src) return <span className={className} style={{ background: "#141518" }} aria-hidden />;
  return <img src={src} alt={alt} className={className} />;
}
