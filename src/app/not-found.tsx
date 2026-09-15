import Link from "next/link";
import { Icon } from "@/components/icons";

export default function NotFound() {
  return (
    <section className="card empty-leaderboard system-screen">
      <span className="empty-icon empty-icon-coral"><Icon name="spade" size={28} /></span>
      <div className="eyebrow page-eyebrow">404 · Folded</div>
      <strong>This hand isn&apos;t on the table.</strong>
      <p>The night, player or payment you&apos;re looking for doesn&apos;t exist or was removed.</p>
      <Link href="/" className="btn btn-primary btn-cta mt-5">Back to your table</Link>
    </section>
  );
}
