import { TransactionForm } from "@/components/transaction-form";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { createTransaction } from "@/lib/actions";
import { isTxType } from "@/lib/ledger";
import { getPlayers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ playerId?: string; type?: string }>;
}) {
  const [sp, players] = await Promise.all([searchParams, getPlayers()]);

  return (
    <>
      <PageHeader
        eyebrow="Every payment"
        title="Record payment"
        subtitle="Log payments in INR, on the date they actually moved"
      />
      <p className="mb-4 text-xs leading-5 text-[var(--text-dim)]">For live game buy-ins and repayments, use that game’s bank controls. They update outstanding debts and add the payment here automatically.</p>
      <Card className="max-w-3xl">
        <CardHeader title="Transaction" />
        <TransactionForm
          action={createTransaction}
          players={players}
          defaults={{
            playerId: sp.playerId,
            type: sp.type && isTxType(sp.type) ? sp.type : undefined,
          }}
        />
      </Card>
    </>
  );
}
