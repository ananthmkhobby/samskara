// A difference hash (dHash) for duplicate-photo detection. Resilient to
// re-encoding/resizing (the app re-encodes every upload to JPEG q0.85 at
// ≤1600px, while WhatsApp-sourced photos are stored at their original
// resolution — an exact byte hash would miss that pairing entirely; dHash
// survives it). Not resilient to heavy cropping, which is fine for this
// use case.
//
// Takes a plain {width, height, data} pixel buffer — exactly what
// `canvas.getContext('2d').getImageData()` returns in the browser, and
// what a decoded jimp image's `.bitmap` is server-side — so this one pure
// function works unmodified in both places.

const GRID_W = 9, GRID_H = 8;

function grayscaleGrid({ width, height, data }) {
  const grid = new Float64Array(GRID_W * GRID_H);
  for (let gy = 0; gy < GRID_H; gy++) {
    const y0 = Math.floor((gy * height) / GRID_H);
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * height) / GRID_H));
    for (let gx = 0; gx < GRID_W; gx++) {
      const x0 = Math.floor((gx * width) / GRID_W);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * width) / GRID_W));
      let sum = 0, count = 0;
      for (let y = y0; y < y1 && y < height; y++) {
        for (let x = x0; x < x1 && x < width; x++) {
          const i = (y * width + x) * 4;
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          count++;
        }
      }
      grid[gy * GRID_W + gx] = count ? sum / count : 0;
    }
  }
  return grid;
}

export function computeDHash(imageData) {
  const grid = grayscaleGrid(imageData);
  let hash = 0n;
  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W - 1; gx++) {
      hash <<= 1n;
      if (grid[gy * GRID_W + gx] > grid[gy * GRID_W + gx + 1]) hash |= 1n;
    }
  }
  return hash.toString(16).padStart(16, "0");
}

export function hammingDistance(hashA, hashB) {
  let x = BigInt("0x" + hashA) ^ BigInt("0x" + hashB);
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

export const DUPLICATE_HAMMING_THRESHOLD = 5;
