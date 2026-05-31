export function GritLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`display font-extrabold tracking-wider ${className}`} style={{ fontStyle: "italic" }}>
      <span style={{ color: "#f5f5f0" }}>GR</span>
      <span style={{ color: "#e63222" }}>I</span>
      <span style={{ color: "#f5f5f0" }}>T</span>
    </span>
  );
}
