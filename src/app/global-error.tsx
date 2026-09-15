"use client"; // Replaces the root layout when it fails, so it must render its own document.

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0b0b0d", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 24 }}>
        <main style={{ maxWidth: 360, textAlign: "center" }}>
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: 2.4, color: "rgba(255,255,255,.4)" }}>MISDEAL</p>
          <h1 style={{ fontSize: 28, margin: "8px 0" }}>The table didn&apos;t load.</h1>
          <p style={{ color: "rgba(255,255,255,.5)", lineHeight: 1.4 }}>Please try again in a moment.{error.digest ? ` Ref ${error.digest}` : ""}</p>
          <button type="button" onClick={() => retry()} style={{ marginTop: 20, width: "100%", minHeight: 52, border: 0, borderRadius: 20, background: "linear-gradient(140deg,#ff8a66,#f4603a)", color: "#1a0d08", fontSize: 16, fontWeight: 800 }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
