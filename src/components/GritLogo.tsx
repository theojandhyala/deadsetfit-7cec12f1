export function GritLogo({ className = "" }: { className?: string; compact?: boolean }) {
  return (
    <span
      className={`display font-extrabold text-2xl tracking-wider ${className}`}
      style={{ fontStyle: "italic" }}
    >
      <span style={{ color: "#f5f5f0" }}>DEAD</span>
      <span style={{ color: "#e63222" }}>SET</span>
    </span>
  );
}
