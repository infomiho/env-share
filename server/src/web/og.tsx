import { Hono } from "hono";
import { ImageResponse } from "hono-og";

const og = new Hono();

async function loadFont(): Promise<ArrayBuffer> {
  const css = await fetch(
    "https://fonts.googleapis.com/css2?family=Inter:wght@700&subset=latin",
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
      },
    }
  ).then((r) => r.text());
  const fontUrl = css.match(
    /src: url\((.+)\) format\('(opentype|truetype)'\)/
  )?.[1];
  if (!fontUrl) throw new Error("Could not find font URL");
  return fetch(fontUrl).then((r) => r.arrayBuffer());
}

let fontCache: ArrayBuffer | null = null;
let imageCache: Uint8Array | null = null;

const RESPONSE_HEADERS = {
  "Content-Type": "image/png",
  "Cache-Control": "public, immutable, no-transform, max-age=31536000",
} as const;

og.get("/og", async (c) => {
  if (imageCache) {
    return c.body(imageCache, 200, RESPONSE_HEADERS);
  }

  if (!fontCache) fontCache = await loadFont();

  const response = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#09090b",
          color: "#fafafa",
          fontFamily: "Inter",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#a1a1aa"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            marginTop: 24,
            letterSpacing: "-0.025em",
          }}
        >
          env-share
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#a1a1aa",
            marginTop: 12,
          }}
        >
          Self-hosted encrypted .env sharing for teams
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "Inter", data: fontCache, weight: 700, style: "normal" }],
    }
  );

  imageCache = new Uint8Array(await response.arrayBuffer());
  return c.body(imageCache, 200, RESPONSE_HEADERS);
});

export { og };
