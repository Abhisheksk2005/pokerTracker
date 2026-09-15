import { Suspense } from "react";
import { StatsTabs } from "@/components/stats-tabs";
import { getLeagueView } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function StatsLayout({ children }: { children: React.ReactNode }) {
  const view = await getLeagueView("all");

  return (
    <>
      <h1 className="sr-only">Stats</h1>
      <Suspense fallback={<StatsTabs seasons={view.seasons} static />}>
        <StatsTabs seasons={view.seasons} />
      </Suspense>
      {children}
    </>
  );
}
