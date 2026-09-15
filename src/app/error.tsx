"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/icons";

export default function ErrorScreen({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="card empty-leaderboard system-screen" role="alert">
      <span className="empty-icon empty-icon-coral"><Icon name="close" size={28} /></span>
      <div className="eyebrow page-eyebrow">Misdeal</div>
      <strong>Something went wrong.</strong>
      <p>Nothing was saved twice — every money action is checked before it lands. Try again, and if it keeps happening quote the reference below.</p>
      {error.digest ? <p className="mono mt-2 text-[11px]">Ref {error.digest}</p> : null}
      <button type="button" onClick={() => retry()} className="btn btn-primary btn-cta mt-5">Try again</button>
      <Link href="/" className="btn mt-3 w-full">Back to your table</Link>
    </section>
  );
}
