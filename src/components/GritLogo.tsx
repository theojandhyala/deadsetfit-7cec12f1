import logoAsset from "@/assets/deadset-logo.png.asset.json";

export function GritLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="DEADSET"
      className={`inline-block h-12 w-auto select-none ${className}`}
      draggable={false}
    />
  );
}
