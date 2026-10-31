export interface Look {
  key: string;
  label: string;
  css: string;
  matrix: number[];
}

const LUM_R = 0.2126;
const LUM_G = 0.7152;
const LUM_B = 0.0722;

function saturate(amount: number): number[] {
  const r = (1 - amount) * LUM_R;
  const g = (1 - amount) * LUM_G;
  const b = (1 - amount) * LUM_B;
  return [
    r + amount, g, b, 0, 0,
    r, g + amount, b, 0, 0,
    r, g, b + amount, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function brighten(amount: number): number[] {
  return [
    1, 0, 0, 0, amount,
    0, 1, 0, 0, amount,
    0, 0, 1, 0, amount,
    0, 0, 0, 1, 0,
  ];
}

function contrast(amount: number): number[] {
  const shift = 127.5 * (1 - amount);
  return [
    amount, 0, 0, 0, shift,
    0, amount, 0, 0, shift,
    0, 0, amount, 0, shift,
    0, 0, 0, 1, 0,
  ];
}

function tint(r: number, g: number, b: number, amount: number): number[] {
  const keep = 1 - amount;
  const tones = [r, g, b];
  const luma = [LUM_R, LUM_G, LUM_B];
  const out: number[] = [];
  for (let channel = 0; channel < 3; channel++) {
    const pull = (amount * tones[channel]) / 255;
    for (let source = 0; source < 3; source++) {
      out.push((channel === source ? keep : 0) + pull * luma[source]);
    }
    out.push(0, 0);
  }
  return [...out, 0, 0, 0, 1, 0];
}

function temperature(amount: number): number[] {
  return [
    1 + amount * 0.22, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1 - amount * 0.22, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function after(first: number[], second: number[]): number[] {
  const out = new Array<number>(20).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += second[row * 5 + k] * first[k * 5 + col];
      }
      out[row * 5 + col] =
        col === 4 ? sum + second[row * 5 + 4] : sum;
    }
  }
  return out;
}

const PLAIN = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

export const LOOKS: Look[] = [
  { key: "original", label: "Original", css: "none", matrix: PLAIN },
  {
    key: "glow",
    label: "Glow",
    css: "brightness(1.07) contrast(0.93) saturate(1.1) sepia(0.06)",
    matrix: after(
      after(brighten(10), temperature(0.35)),
      after(saturate(1.08), contrast(0.94)),
    ),
  },
  {
    key: "mono",
    label: "Mono",
    css: "grayscale(1) contrast(1.12) brightness(1.02)",
    matrix: after(saturate(0), contrast(1.12)),
  },
  {
    key: "soft",
    label: "Soft",
    css: "brightness(1.06) contrast(0.88) saturate(0.92) sepia(0.04)",
    matrix: after(
      after(brighten(14), temperature(0.16)),
      after(saturate(0.96), contrast(0.9)),
    ),
  },
  {
    key: "blush",
    label: "Blush",
    css: "brightness(1.05) contrast(0.92) saturate(0.88) sepia(0.16) hue-rotate(-10deg)",
    matrix: after(
      after(brighten(12), tint(255, 150, 160, 0.16)),
      after(saturate(0.92), contrast(0.92)),
    ),
  },
  {
    key: "clear",
    label: "Clear",
    css: "brightness(1.03) contrast(1.06) saturate(1.05)",
    matrix: after(after(brighten(8), contrast(1.04)), saturate(1.02)),
  },
  {
    key: "vivid",
    label: "Vivid",
    css: "brightness(0.99) contrast(1.16) saturate(1.5)",
    matrix: after(after(saturate(1.55), contrast(1.18)), brighten(-4)),
  },
];

export const DEFAULT_LOOK = LOOKS[0];

export function lookByKey(key: string): Look {
  return LOOKS.find((look) => look.key === key) ?? DEFAULT_LOOK;
}

export function applyLookPixels(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  look: Look,
) {
  if (look.key === "original") return;
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const m = look.matrix;
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    data[index] = m[0] * r + m[1] * g + m[2] * b + m[3] * a + m[4];
    data[index + 1] = m[5] * r + m[6] * g + m[7] * b + m[8] * a + m[9];
    data[index + 2] = m[10] * r + m[11] * g + m[12] * b + m[13] * a + m[14];
    data[index + 3] = m[15] * r + m[16] * g + m[17] * b + m[18] * a + m[19];
  }
  context.putImageData(image, 0, 0);
}
