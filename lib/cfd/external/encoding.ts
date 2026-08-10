import type { EncodedScalarField } from "./types";

export function encodeBytes(values: Uint8Array) {
  return Buffer.from(values.buffer, values.byteOffset, values.byteLength).toString("base64");
}

export function encodeFloat32(values: Float32Array) {
  return Buffer.from(values.buffer, values.byteOffset, values.byteLength).toString("base64");
}

export function finiteRange(values: Float32Array, mask: Uint8Array) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < values.length; i += 1) {
    if (mask[i] || !Number.isFinite(values[i])) continue;
    min = Math.min(min, values[i]);
    max = Math.max(max, values[i]);
  }
  return Number.isFinite(min) ? { min, max: max > min ? max : min + 1e-6 } : { min: 0, max: 1 };
}

export function encodeScalarField(values: Float32Array, mask: Uint8Array, unit: string): EncodedScalarField {
  const range = finiteRange(values, mask);
  return { data: encodeFloat32(values), min: range.min, max: range.max, unit };
}
