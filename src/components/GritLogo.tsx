export function GritLogo({ className = "" }: { className?: string; compact?: boolean }) {
  return (
    <img
      src="/brand/deadset-lockup.png"
      alt="DEADSET — Forge Your Body"
      width={810}
      height={360}
      className={`block h-auto w-32 object-contain ${className}`}
    />
  );
}
