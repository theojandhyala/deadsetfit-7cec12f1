import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) { onDone(); return; }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, onDone]);
  return (
    <div className="fixed inset-x-0 bottom-20 z-40 mx-auto max-w-md p-4">
      <div className="bg-grit-card border border-accent-red p-4 flex items-center justify-between">
        <div>
          <div className="label-cap text-accent-red">REST</div>
          <div className="display text-4xl font-extrabold text-grit">{left}s</div>
        </div>
        <button onClick={onDone} className="btn-ghost"><X size={16} className="mr-2" />Skip</button>
      </div>
    </div>
  );
}
