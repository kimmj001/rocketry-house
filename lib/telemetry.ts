export const likelyColumnAliases = {
  time: ["time", "t", "seconds", "sec"],
  altitude: ["altitude", "alt", "height", "agl"],
  velocity: ["velocity", "vel", "speed"],
  acceleration: ["acceleration", "accel", "g"],
  thrust: ["thrust", "force"],
  pressure: ["pressure", "baro"],
  latitude: ["lat", "latitude"],
  longitude: ["lon", "lng", "longitude"]
};

export function detectTelemetryColumns(columns: string[]) {
  return Object.fromEntries(
    Object.entries(likelyColumnAliases).map(([key, aliases]) => [
      key,
      columns.find((column) => aliases.some((alias) => column.toLowerCase().includes(alias)))
    ])
  );
}
