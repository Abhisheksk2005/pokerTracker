import { ImageResponse } from "next/og";

const SPADE =
  "M12 3.2c2.6 4 6.4 6 6.4 9.6a4.1 4.1 0 0 1-5.5 3.9c.2 1.6.7 2.7 1.7 3.6h-5.2c1-.9 1.5-2 1.7-3.6a4.1 4.1 0 0 1-5.5-3.9C5.6 9.2 9.4 7.2 12 3.2Z";

/**
 * The app mark from the design: a dark spade on the coral gradient tile.
 * `maskable` keeps the glyph inside the 80% safe zone Android may crop to.
 */
export function brandIcon(size: number, { rounded = true, maskable = false } = {}) {
  const glyph = Math.round(size * (maskable ? 0.46 : 0.58));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #FF8B6A, #F35C36)",
          borderRadius: rounded ? Math.round(size * 0.22) : 0,
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 24 24">
          <path d={SPADE} fill="#1a0d08" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
