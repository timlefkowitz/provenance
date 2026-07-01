"use client";

import { useState } from "react";
import { collectiblesPath } from "~/lib/main-app";

/**
 * Verify box: sends the certificate number to the main app's verify page,
 * which performs the lookup and renders the result / certificate.
 */
export function VerifyBox() {
  const [cert, setCert] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = cert.trim();
    if (!trimmed) return;
    console.log("[Collectibles] verify redirect", { cert: trimmed });
    window.location.href = collectiblesPath(`/verify?cert=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2 max-w-md mx-auto">
      <input
        type="text"
        value={cert}
        onChange={(e) => setCert(e.target.value)}
        placeholder="Enter certificate number..."
        className="flex-1 rounded-md border border-wine/30 bg-white/50 px-4 py-2 text-sm placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-wine/30"
      />
      <button
        type="submit"
        className="rounded-md bg-wine px-6 py-2 text-sm font-medium text-white hover:bg-wine/90 transition-colors"
      >
        Verify
      </button>
    </form>
  );
}
