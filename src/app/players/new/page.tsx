import { PlayerForm } from "@/components/player-form";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { createPlayer } from "@/lib/actions";

export default function NewPlayerPage() {
  return (
    <>
      <PageHeader
        eyebrow="New to the table"
        title="Add player"
        subtitle="Put someone on the roster before seating them at a night"
      />
      <Card className="max-w-2xl">
        <CardHeader title="Player details" />
        <PlayerForm action={createPlayer} submitLabel="Add player" />
      </Card>
    </>
  );
}
