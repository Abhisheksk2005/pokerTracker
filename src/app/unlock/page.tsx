import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Icon } from "@/components/icons";
import { UnlockForm } from "@/components/unlock-form";
import { authMode, safeNextPath } from "@/lib/auth";

export const metadata: Metadata = { title: "Unlock" };
export const dynamic = "force-dynamic";

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const mode = authMode();
  const next = safeNextPath((await searchParams).next);
  if (mode === "open") redirect(next);

  return (
    <section className="unlock-screen">
      <span className="group-spade unlock-mark">
        <Icon name="spade" size={26} />
      </span>
      <div className="eyebrow page-eyebrow mt-6">Good company. Great nights.</div>
      <h1>{mode === "passcode" ? "Unlock your table." : "Set a passcode first."}</h1>
      {mode === "passcode" ? (
        <>
          <p className="section-caption">
            Enter the passcode your group shares to see nights, balances and the ledger.
          </p>
          <UnlockForm next={next} />
        </>
      ) : (
        <p className="section-caption mt-3">
          This production server has no <code className="mono">APP_PASSCODE</code>. Set it, plus a
          long random <code className="mono">AUTH_SECRET</code>, in the server environment and
          restart. Money records stay locked until then.
        </p>
      )}
    </section>
  );
}
