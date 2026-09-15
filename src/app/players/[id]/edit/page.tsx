import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/form";
import { PlayerForm } from "@/components/player-form";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { deletePlayer, updatePlayer } from "@/lib/actions";
import { getPlayer } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Player profile"
        title={`Edit ${player.name}`}
        subtitle="Renaming carries every result and ledger row across with them"
      />
      <Card className="max-w-2xl">
        <CardHeader title="Player details" />
        <PlayerForm action={updatePlayer} defaults={player} submitLabel="Save changes" />
      </Card>

      <Card className="mt-5 max-w-2xl border-[var(--down)]">
        <CardHeader
          title="Group membership"
          subtitle="Removing them from this roster keeps their historical nights and ledger entries intact."
        />
        <form action={deletePlayer} className="px-4 py-3">
          <input type="hidden" name="id" value={id} />
          <ConfirmButton
            message={`Remove ${player.name} from this group? Their history will be preserved.`}
            className="btn btn-danger"
          >
            Remove from group
          </ConfirmButton>
        </form>
      </Card>
    </>
  );
}
