export function computeVorticity(
  velocityX: Float32Array,
  velocityY: Float32Array,
  mask: Uint8Array,
  width: number,
  height: number,
  dx: number,
  dy: number
) {
  const output = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      if (mask[i]) continue;
      const left = i - 1;
      const right = i + 1;
      const down = i - width;
      const up = i + width;
      if (mask[left] || mask[right] || mask[down] || mask[up]) continue;
      output[i] = (velocityY[right] - velocityY[left]) / (2 * dx) - (velocityX[up] - velocityX[down]) / (2 * dy);
    }
  }
  return output;
}
