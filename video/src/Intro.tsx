import { loadFont } from "@remotion/google-fonts/Geist";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

const { fontFamily } = loadFont("normal", {
  weights: ["500", "600"],
  subsets: ["latin"],
});

const PAPER = "#F6F5F1";
const INK = "#121412";
const QUIET = "#3E4144";

const WORD = "steward";
const BEATS = [
  { at: 70, text: "Sees it." },
  { at: 86, text: "Fixes it." },
  { at: 102, text: "Sees it. Fixes it. Remembers it." },
];

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

function ease(frame: number, start: number, end: number, from: number, to: number) {
  const t = interpolate(frame, [start, end], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  return from + (to - from) * t;
}

function settle(frame: number, start: number, from: number, overshoot: number, to: number) {
  if (frame < start) return from;
  if (frame < start + 8) return ease(frame, start, start + 8, from, overshoot);
  return ease(frame, start + 8, start + 13, overshoot, to);
}

function Mark({ scale, y, opacity }: { scale: number; y: number; opacity: number }) {
  return (
    <div
      style={{
        width: 168,
        height: 168,
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
      }}
    >
      <svg width="168" height="168" viewBox="0 0 128 128" fill="none">
        <defs>
          <linearGradient id="stewardTile" x1="0" y1="0" x2="0" y2="128" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="0.45" stopColor="#F5F0D6" />
            <stop offset="1" stopColor="#E9F37E" />
          </linearGradient>
        </defs>
        <rect width="128" height="128" rx="34" fill="url(#stewardTile)" />
        <g transform="translate(32 32)" fill={INK}>
          <path d="M17.92 0H46.08C50.8327 0 55.3907 1.88799 58.7514 5.24865C62.112 8.6093 64 13.1673 64 17.92V46.08C64 50.8327 62.112 55.3907 58.7514 58.7514C55.3907 62.112 50.8327 64 46.08 64H44.8V32C44.8 28.6052 43.4514 25.3495 41.051 22.949C38.6505 20.5486 35.3948 19.2 32 19.2C28.6052 19.2 25.3495 20.5486 22.949 22.949C20.5486 25.3495 19.2 28.6052 19.2 32V64H17.92C13.1673 64 8.6093 62.112 5.24865 58.7514C1.88799 55.3907 0 50.8327 0 46.08L0 17.92C0 13.1673 1.88799 8.6093 5.24865 5.24865C8.6093 1.88799 13.1673 0 17.92 0Z" />
          <path d="M32 40.32C35.8881 40.32 39.04 37.1681 39.04 33.28C39.04 29.3919 35.8881 26.24 32 26.24C28.1119 26.24 24.96 29.3919 24.96 33.28C24.96 37.1681 28.1119 40.32 32 40.32Z" />
        </g>
      </svg>
    </div>
  );
}

export const Intro = () => {
  const frame = useCurrentFrame();

  const markOpacity = ease(frame, 4, 12, 0, 1);
  const markScale =
    frame < 20
      ? settle(frame, 4, 0.9, 1.145, 1.12)
      : frame < 34
        ? 1.12
        : ease(frame, 34, 48, 1.12, 1);
  const markY = frame < 34 ? 96 : settle(frame, 34, 96, -5, 0);
  const beat = BEATS.reduce((current, next) => (frame >= next.at ? next : current));
  const tagOpacity = frame < BEATS[0].at ? 0 : ease(frame, beat.at, beat.at + 5, 0, 1);
  const tagY = frame < BEATS[0].at ? 10 : settle(frame, beat.at, 10, -1.5, 0);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: PAPER,
        fontFamily,
        color: INK,
      }}
    >
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Mark scale={markScale} y={markY} opacity={markOpacity} />
          <div style={{ height: 36 }} />
          <div
            style={{
              fontWeight: 600,
              fontSize: 108,
              letterSpacing: "-0.045em",
              lineHeight: 0.9,
              height: 108,
            }}
          >
            {WORD.split("").map((char, index) => {
              const start = 46 + index * 2;
              const opacity = ease(frame, start, start + 5, 0, 1);
              const y = settle(frame, start, 16, -2, 0);
              return (
                <span
                  key={`${char}-${index}`}
                  style={{
                    display: "inline-block",
                    opacity,
                    transform: `translateY(${y}px)`,
                  }}
                >
                  {char}
                </span>
              );
            })}
          </div>
          <div style={{ height: 28 }} />
          <div
            style={{
              fontWeight: 500,
              fontSize: 34,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: QUIET,
              height: 40,
              opacity: tagOpacity,
              transform: `translateY(${tagY}px)`,
            }}
          >
            {beat.text}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
