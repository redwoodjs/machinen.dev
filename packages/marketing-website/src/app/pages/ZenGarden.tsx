"use client";

import { useEffect, useRef } from "react";
import { useInView } from "motion/react";

// Low-res backing buffer, roughly Sierra/EGA proportions (8:5). The canvas
// is scaled up with image-rendering: pixelated, so everything is chunky
// 8-bit pixels — and the heavy dithering reads as an old adventure-game
// screen rather than flat vector art.
const W = 256;
const H = 160;

// A ¾ view of a wooden sand tray: a tall back rim up at the horizon, two
// side rims, and a near rim along the bottom. The sand floor sits inside
// them and recedes away from the camera.
const HORIZON = 34; // bottom edge of the back rim
const FRAME = 12; // thickness of the side and front rims

// The sand is a single height field the emboss reads. Raking spikes it;
// every frame it eases back toward `restPattern` — the garden's designed
// raking — so it's always rakeable and always settles into the rings.
const RECOVER = 0.04; // how fast a disturbance eases back to rest
const EMBOSS = 0.5; // how hard the height field's gradient shades the sand

// Rake head: 5 tines, 3px apart, dragged along the cursor's path.
const TINES = 5;
const TINE_GAP = 3;
const HALF = ((TINES - 1) * TINE_GAP) / 2; // half the rake head's width
const FLATTEN_TARGET = 0.4; // the rake smooths the sand between its tines

// Ordered dither: a 4x4 Bayer matrix. Used everywhere to band between tone
// tiers the way EGA art did.
const BAYER = [
  0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5,
];
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)] / 16;

type RGB = [number, number, number];

// Quantize a continuous lightness value into a tone ramp.
const tier = (v: number, len: number) => {
  let t = Math.round(v * (len - 1));
  if (t < 0) t = 0;
  else if (t > len - 1) t = len - 1;
  return t;
};

// Sand tone ramp, darkest → lightest.
const SAND_RAMP: RGB[] = [
  [120, 102, 72],
  [160, 140, 100],
  [196, 173, 126],
  [221, 201, 156],
  [240, 228, 196],
];

// Wooden tray, light pine. Scene lighting + grain pick a tier per pixel.
const WOOD_RAMP: RGB[] = [
  [92, 64, 38],
  [138, 102, 62],
  [178, 140, 94],
  [212, 176, 128],
  [236, 208, 166],
];

// Rock tone ramp, darkest → lightest. Plenty of tiers so the sphere
// shading reads as a rounded volume rather than a flat patch.
const ROCK_RAMP: RGB[] = [
  [44, 42, 52],
  [68, 66, 78],
  [94, 92, 104],
  [120, 118, 132],
  [150, 148, 162],
  [188, 186, 200],
];

// Pebble clusters scattered on the sand — the reference is small clustered
// stones, not big boulders. The resting raking pattern rings each of these.
const CLUSTERS = [
  { x: 78, y: 90 },
  { x: 152, y: 62 },
  { x: 200, y: 104 },
  { x: 116, y: 124 },
  { x: 56, y: 128 },
];

// Expand each cluster into 2–3 individual pebbles huddled together.
const ROCKS: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  seed: number;
}[] = [];
CLUSTERS.forEach((c, ci) => {
  const n = 2 + (ci % 2);
  for (let p = 0; p < n; p++) {
    const a = ci * 1.7 + p * 2.3;
    const dist = p === 0 ? 0 : 4 + p;
    ROCKS.push({
      cx: c.x + Math.round(Math.cos(a) * dist),
      cy: c.y + Math.round(Math.sin(a) * dist * 0.6),
      rx: 5 - p,
      ry: 4 - p * 0.7,
      seed: a,
    });
  }
});

// Cast-shadow offset — light comes from the top-left-front. Small, because
// the pebbles are small.
const SHADOW_DX = 2;
const SHADOW_DY = 2;

// Light direction + Blinn half-vector (camera at 0,0,1), both unit length.
// These drive a real per-pixel sphere shade — that's what makes the
// pebbles read as 3D volumes instead of flat shaded discs.
const LX = -0.506;
const LY = -0.658;
const LZ = 0.557;
const HX = -0.287;
const HY = -0.373;
const HZ = 0.883;

// Precomputed once at module load — W, H and ROCKS are all constant.
const rockMask = new Uint8Array(W * H);
const rockShade = new Float32Array(W * H);
const shadowMask = new Float32Array(W * H);

for (const r of ROCKS) {
  const bx = Math.ceil(r.rx * 1.3);
  const by = Math.ceil(r.ry * 1.3);
  for (let y = Math.max(0, r.cy - by); y < Math.min(H, r.cy + by + 1); y++) {
    for (let x = Math.max(0, r.cx - bx); x < Math.min(W, r.cx + bx + 1); x++) {
      const nx = (x - r.cx) / r.rx;
      const ny = (y - r.cy) / r.ry;
      // Irregular silhouette: wobble the radius by angle.
      const ang = Math.atan2(ny, nx);
      const wob =
        1 +
        0.14 * Math.sin(ang * 3 + r.seed) +
        0.08 * Math.sin(ang * 5 - r.seed * 2);
      const ux = nx / wob;
      const uy = ny / wob;
      const u2 = ux * ux + uy * uy;
      if (u2 > 1) continue;
      const idx = y * W + x;
      rockMask[idx] = 1;
      // Treat the pebble as a dome: nz is the bulge toward the camera.
      // Lambert diffuse + a tight Blinn specular for a stone glint.
      const nz = Math.sqrt(1 - u2);
      const diff = Math.max(0, ux * LX + uy * LY + nz * LZ);
      const spec = Math.pow(Math.max(0, ux * HX + uy * HY + nz * HZ), 20);
      rockShade[idx] = 0.16 + diff * 0.85 + spec * 0.7;
    }
  }
  // Cast shadow: the pebble's footprint, offset toward bottom-right.
  for (
    let y = Math.max(0, r.cy + SHADOW_DY - r.ry);
    y < Math.min(H, r.cy + SHADOW_DY + r.ry + 1);
    y++
  ) {
    for (
      let x = Math.max(0, r.cx + SHADOW_DX - r.rx);
      x < Math.min(W, r.cx + SHADOW_DX + r.rx + 1);
      x++
    ) {
      const nx = (x - r.cx - SHADOW_DX) / r.rx;
      const ny = (y - r.cy - SHADOW_DY) / r.ry;
      const d = nx * nx + ny * ny;
      if (d <= 1) {
        const idx = y * W + x;
        shadowMask[idx] = Math.max(shadowMask[idx], 0.3 * (1 - d));
      }
    }
  }
}

// The resting raking pattern: concentric rings around every cluster that
// melt into flowing parallel lines in the open sand between them. Built as
// a phase field — distance-to-cluster near a cluster, a gently wavy
// horizontal coordinate far from them all, blended by proximity weight.
// The emboss turns the field's ripple into grooves.
const restPattern = new Float32Array(W * H);
{
  const SPACING = 5.2; // pixels between groove crests
  const REST_AMP = 0.4; // ripple amplitude of the resting pattern
  const RING_FLATTEN = 1.35; // squashes rings vertically for the ¾ view
  const FALLOFF = 24; // how far a cluster's rings reach
  const BG_WEIGHT = 0.42; // pull of the open-sand flowing lines
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let wsum = BG_WEIGHT;
      let psum = BG_WEIGHT * (y + Math.sin(x * 0.06) * 5);
      for (const c of CLUSTERS) {
        const dx = x - c.x;
        const dy = (y - c.y) * RING_FLATTEN;
        const d = Math.sqrt(dx * dx + dy * dy);
        const w = 1 / (1 + (d / FALLOFF) * (d / FALLOFF));
        wsum += w;
        psum += w * d;
      }
      const phase = psum / wsum;
      restPattern[y * W + x] =
        0.5 + REST_AMP * Math.sin((phase / SPACING) * Math.PI * 2);
    }
  }
}

export function ZenGarden() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inView = useInView(containerRef, { amount: 0.3 });

  // The live height field starts as a copy of the resting pattern.
  const fieldRef = useRef<Float32Array | null>(null);
  if (fieldRef.current === null) fieldRef.current = restPattern.slice();
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!inView) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const field = fieldRef.current!;
    const img = ctx.createImageData(W, H);
    const data = img.data;
    let raf = 0;

    const frame = () => {
      // Ease the whole field back toward the resting pattern.
      for (let i = 0; i < field.length; i++) {
        field[i] += (restPattern[i] - field[i]) * RECOVER;
      }

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const idx = y * W + x;
          let col: RGB;

          if (y < HORIZON) {
            // Back rim: the inner face of the far board, in light pine.
            // Brighter toward the bottom where it catches floor-light,
            // with a touch of horizontal grain.
            const t = y / HORIZON;
            const grain = Math.sin(x * 0.7 + y * 0.3) * 0.11;
            const wl = 0.34 + t * 0.5 + grain + (bayer(x, y) - 0.5) * 0.3;
            col = WOOD_RAMP[tier(wl, WOOD_RAMP.length)];
          } else if (y === HORIZON) {
            // Crisp shadow line where the back rim meets the sand.
            col = WOOD_RAMP[0];
          } else if (y >= H - FRAME) {
            // Near rim: the top surface of the front board, well lit.
            const grain = Math.sin(x * 0.6) * 0.1;
            const wl = 0.74 + grain + (bayer(x, y) - 0.5) * 0.26;
            col = WOOD_RAMP[tier(wl, WOOD_RAMP.length)];
          } else if (x < FRAME) {
            // Left rim: inner face, catching the light.
            const grain = Math.sin(y * 0.8) * 0.1;
            const wl = 0.6 + grain + (bayer(x, y) - 0.5) * 0.3;
            col = WOOD_RAMP[tier(wl, WOOD_RAMP.length)];
          } else if (x >= W - FRAME) {
            // Right rim: inner face, in shadow.
            const grain = Math.sin(y * 0.8) * 0.1;
            const wl = 0.3 + grain + (bayer(x, y) - 0.5) * 0.3;
            col = WOOD_RAMP[tier(wl, WOOD_RAMP.length)];
          } else if (rockMask[idx]) {
            const l = rockShade[idx] + (bayer(x, y) - 0.5) * 0.16;
            col = ROCK_RAMP[tier(l, ROCK_RAMP.length)];
          } else {
            // Sand floor. Build a continuous lightness value, then quantize
            // it into the tone ramp with a dither — that banding is the
            // look.

            // Depth: 0 at the horizon (far), 1 at the near rim. The near
            // floor catches more light than the receding far end.
            const depth = (y - HORIZON) / (H - FRAME - HORIZON);
            let lv = 0.42 + depth * 0.3;
            // Horizontal vignette — depth handles the vertical.
            const vx = x / W - 0.5;
            lv -= vx * vx * 0.45;
            // Ambient occlusion tucking the floor under the back rim.
            lv -= Math.max(0, 1 - depth * 6) * 0.16;
            // Pebble cast shadow.
            lv -= shadowMask[idx];

            // Emboss: shade by the gradient of the height field, so every
            // groove — raked or resting — gets a highlight wall and a
            // shadow wall. Sand is always well inside the frame, so idx±1
            // / idx±W are in-bounds.
            const emb =
              -(
                field[idx + 1] -
                field[idx - 1] +
                (field[idx + W] - field[idx - W])
              ) * EMBOSS;
            lv += emb;
            // Dither.
            lv += (bayer(x, y) - 0.5) * 0.16;

            col = SAND_RAMP[tier(lv, SAND_RAMP.length)];
          }

          const p = idx * 4;
          data[p] = col[0];
          data[p + 1] = col[1];
          data[p + 2] = col[2];
          data[p + 3] = 255;
        }
      }

      ctx.putImageData(img, 0, 0);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [inView]);

  const toBuffer = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  // Drag the rake head along the path: the tines cut fresh grooves (field
  // spiked to 1), and the sand between them is smoothed flat — so a stroke
  // wipes the old pattern and lays down its own, just like a real rake.
  const rake = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    perpX: number,
    perpY: number,
  ) => {
    const field = fieldRef.current!;
    const dx = bx - ax;
    const dy = by - ay;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = ax + dx * t;
      const cy = ay + dy * t;
      for (let o = -HALF - 1; o <= HALF + 1; o++) {
        const px = Math.round(cx + perpX * o);
        const py = Math.round(cy + perpY * o);
        if (px < FRAME || px >= W - FRAME || py <= HORIZON || py >= H - FRAME)
          continue;
        const idx = py * W + px;
        if (rockMask[idx]) continue;
        const m = ((o % TINE_GAP) + TINE_GAP) % TINE_GAP;
        if (m === 0 && Math.abs(o) <= HALF) {
          field[idx] = 1; // a tine groove
        } else {
          field[idx] = field[idx] * 0.55 + FLATTEN_TARGET * 0.45; // smoothed
        }
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pos = toBuffer(e);
    const last = lastPosRef.current;
    if (!last) {
      lastPosRef.current = pos;
      return;
    }
    const dx = pos.x - last.x;
    const dy = pos.y - last.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;

    // Perpendicular to travel — the rake head spreads its tines across it.
    rake(last.x, last.y, pos.x, pos.y, -dy / len, dx / len);
    lastPosRef.current = pos;
  };

  const startStroke = (e: React.PointerEvent) => {
    lastPosRef.current = toBuffer(e);
  };
  const endStroke = () => {
    lastPosRef.current = null;
  };

  return (
    <div ref={containerRef} style={{ margin: "2rem 0" }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerEnter={startStroke}
        onPointerDown={startStroke}
        onPointerMove={onPointerMove}
        onPointerLeave={endStroke}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          imageRendering: "pixelated",
          touchAction: "none",
          cursor: "crosshair",
          boxShadow: "0 2px 18px -6px rgba(0,0,0,0.35)",
        }}
      />
      <div
        style={{
          textAlign: "center",
          marginTop: "0.6rem",
          fontSize: 12,
          color: "#999",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        drag across the sand to rake it — it settles back into the rings
      </div>
    </div>
  );
}
