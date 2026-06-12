export function GritLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`display font-extrabold text-2xl tracking-wider ${className}`}
      style={{ fontStyle: "italic" }}
    >
      <span style={{ color: "#f5f5f0" }}>DEAD</span>
      <span style={{ color: "#E10600" }}>SET</span>
    </span>
  );
}
