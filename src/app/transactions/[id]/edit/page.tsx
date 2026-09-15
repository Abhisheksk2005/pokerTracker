import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/form";
import { TransactionForm } from "@/components/transaction-form";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { deleteTransaction, updateTransaction } from "@/lib/actions";
import { getTransaction, isTxType } from "@/lib/ledger";
import { getPlayers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tx, players] = await Promise.all([
    getTransaction(id),
    getPlayers(),
  ]);
  if (!tx) notFound();
  if (tx.operationId) return <><PageHeader title="Game bank payment" subtitle="This payment stays linked to its chip movement." /><Link href={`/games/${tx.gameId}`} className="btn btn-primary">Open game bank to review or correct →</Link></>;

  return (
    <>
      <PageHeader
        eyebrow="Every payment"
        title="Edit transaction"
        subtitle={tx.game ? `Posted from ${tx.game.name}` : "Standalone ledger entry"}
      />
      <Card className="max-w-3xl">
        <CardHeader title="Transaction" />
        <TransactionForm
          action={updateTransaction}
          players={players}
          submitLabel="Save changes"
          defaults={{
            id: tx.id,
            playerId: tx.playerId,
            date: tx.date,
            type: isTxType(tx.type) ? tx.type : undefined,
            amount: tx.amount,
            method: tx.method,
            note: tx.note,
          }}
        />
      </Card>

      {tx.game ? (
        <p className="mt-3 max-w-3xl text-xs text-[var(--text-faint)]">
          Heads up: re-running “Post to ledger” on{" "}
          <Link href={`/games/${tx.game.id}`} className="link">
            {tx.game.name}
          </Link>{" "}
          rebuilds its rows and will discard edits made here.
        </p>
      ) : null}

      <Card className="mt-5 max-w-3xl border-[var(--down)]">
        <CardHeader title="Danger zone" />
        <form action={deleteTransaction} className="px-4 py-4">
          <input type="hidden" name="id" value={tx.id} />
          <input type="hidden" name="redirectTo" value="/transactions" />
          <ConfirmButton message="Delete this transaction?" className="btn btn-danger">
            Delete transaction
          </ConfirmButton>
        </form>
      </Card>
    </>
  );
}
