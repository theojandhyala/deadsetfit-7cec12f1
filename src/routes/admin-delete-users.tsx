import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminDeleteAllUsers } from "@/lib/account.functions";

export const Route = createFileRoute("/admin-delete-users")({
  component: AdminDeleteUsers,
});

function AdminDeleteUsers() {
  const _delete = useServerFn(adminDeleteAllUsers);
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!secret) return;
    setBusy(true);
    try {
      const r = await _delete({ data: { secret } });
      setResult(`Deleted ${r.deleted} account(s) successfully.`);
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-grit flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="display font-extrabold text-grit text-2xl">Delete All Users</h1>
        <p className="text-sm text-grit-dim">
          Enter the ADMIN_DELETE_SECRET from your server environment to delete all accounts.
        </p>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Admin secret"
          className="input-grit w-full"
        />
        <button
          onClick={run}
          disabled={busy || !secret}
          className="btn-grit w-full py-3 label-cap"
        >
          {busy ? "Deleting…" : "Delete All Accounts"}
        </button>
        {result && (
          <p className={`text-sm ${result.includes("Deleted") ? "text-green-400" : "text-accent-red"}`}>
            {result}
          </p>
        )}
      </div>
    </div>
  );
}
