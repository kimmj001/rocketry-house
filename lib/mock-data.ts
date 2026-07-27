import type { Discussion, RocketComponent, RocketProject } from "@/lib/types";

type ReferenceSpec = {
  slug: string;
  title: string;
  creator: string;
  priceCents: number;
  difficulty: RocketProject["difficulty"];
  motorClass: string;
  predictedAltitudeM: number;
  actualAltitudeM?: number;
  status: RocketProject["verificationStatus"];
  tags: string[];
  forkCount: number;
  downloads: number;
  lengthMm: number;
  diameterMm: number;
  massG: number;
  motorMountMm: number;
  finMaterial: string;
  recovery: string;
  referenceName: string;
  referenceUrl: string;
};

function componentsFor(spec: ReferenceSpec, index: number): RocketComponent[] {
  const noseLength = Math.round(spec.lengthMm * 0.18);
  const payloadLength = spec.diameterMm >= 75 ? Math.round(spec.lengthMm * 0.17) : Math.round(spec.lengthMm * 0.1);
  const bodyStart = noseLength + payloadLength;
  const bodyLength = Math.max(Math.round(spec.lengthMm * 0.54), spec.lengthMm - bodyStart - Math.round(spec.lengthMm * 0.08));
  const finRoot = Math.round(spec.lengthMm * 0.16);
  const finPosition = Math.max(bodyStart + bodyLength - finRoot, bodyStart);
  const motorLength = Math.round(spec.lengthMm * (spec.motorMountMm >= 38 ? 0.32 : spec.motorMountMm >= 29 ? 0.26 : 0.2));
  const motorPosition = Math.max(spec.lengthMm - motorLength - Math.round(spec.diameterMm * 0.35), 0);
  const mass = (fraction: number) => Math.max(4, Math.round(spec.massG * fraction));

  return [
    { id: `nose-${index}`, type: "nose_cone", name: "Ogive nose cone", length: noseLength, diameter: spec.diameterMm, wallThickness: 2, material: "Molded plastic / balsa", mass: mass(0.1), position: 0 },
    { id: `payload-${index}`, type: "payload_section", name: "Payload / avionics bay", length: payloadLength, diameter: spec.diameterMm, wallThickness: 2, material: "Airframe tube", mass: mass(0.12), position: noseLength },
    { id: `coupler-${index}`, type: "coupler", name: "Coupler and shoulder", length: Math.round(spec.diameterMm * 1.2), diameter: Math.round(spec.diameterMm * 0.94), wallThickness: 2, material: "Coupler stock", mass: mass(0.05), position: Math.max(noseLength - Math.round(spec.diameterMm * 0.3), 0) },
    { id: `tube-${index}`, type: "body_tube", name: "Main airframe", length: bodyLength, diameter: spec.diameterMm, wallThickness: spec.diameterMm >= 75 ? 3 : 2, material: spec.diameterMm >= 75 ? "kraft phenolic / cardboard" : "kraft body tube", mass: mass(0.29), position: bodyStart },
    { id: `bulkhead-${index}`, type: "bulkhead", name: "Recovery anchor bulkhead", length: Math.max(6, Math.round(spec.diameterMm * 0.12)), diameter: Math.round(spec.diameterMm * 0.94), wallThickness: 4, material: "plywood", mass: mass(0.05), position: bodyStart + Math.round(bodyLength * 0.18) },
    { id: `recovery-${index}`, type: "recovery_bay", name: spec.recovery, length: Math.round(bodyLength * 0.36), diameter: Math.round(spec.diameterMm * 0.9), wallThickness: 1, material: "parachute / streamer and shock cord", mass: mass(0.12), position: bodyStart + Math.round(bodyLength * 0.22) },
    { id: `motor-${index}`, type: "motor_mount", name: `${spec.motorMountMm} mm motor mount`, length: motorLength, diameter: spec.motorMountMm, wallThickness: 1.6, material: "motor tube", mass: mass(0.08), position: motorPosition },
    { id: `rings-${index}`, type: "centering_rings", name: "Centering rings", length: Math.max(8, Math.round(spec.diameterMm * 0.15)), diameter: spec.diameterMm, wallThickness: 4, material: "plywood / fiber", mass: mass(0.05), position: motorPosition + Math.round(motorLength * 0.08) },
    { id: `retainer-${index}`, type: "motor_retainer", name: "Aft motor retainer", length: Math.max(14, Math.round(spec.diameterMm * 0.22)), diameter: Math.max(spec.motorMountMm + 6, Math.round(spec.motorMountMm * 1.18)), wallThickness: 2, material: "retainer / hook", mass: mass(0.04), position: spec.lengthMm - Math.max(14, Math.round(spec.diameterMm * 0.22)) },
    { id: `nozzle-${index}`, type: "motor_nozzle", name: "Motor nozzle exit", length: Math.max(12, Math.round(spec.diameterMm * 0.18)), diameter: Math.max(spec.motorMountMm - 5, 10), wallThickness: 2, material: "motor nozzle", mass: mass(0.03), position: spec.lengthMm - Math.max(12, Math.round(spec.diameterMm * 0.18)) },
    { id: `fins-${index}`, type: "fins", name: `${spec.finMaterial} fin set`, length: finRoot, diameter: spec.diameterMm, wallThickness: spec.diameterMm >= 75 ? 5 : 3, material: spec.finMaterial, mass: mass(0.12), position: finPosition, finRootChord: finRoot, finTipChord: Math.round(finRoot * 0.48), finSpan: Math.round(spec.diameterMm * 1.15), finSweep: Math.round(finRoot * 0.28), finCount: spec.slug.includes("spica") || spec.slug.includes("starsailor") ? 4 : 3 + (index % 2) },
    { id: `rail-${index}`, type: "rail_buttons", name: spec.diameterMm >= 75 ? "Rail buttons" : "Launch lug", length: Math.max(16, Math.round(spec.diameterMm * 0.28)), diameter: spec.diameterMm >= 75 ? 12 : 5, wallThickness: 1, material: "nylon / launch lug", mass: mass(0.02), position: bodyStart + Math.round(bodyLength * 0.42) }
  ];
}

function telemetry(multiplier = 1) {
  return {
    id: "tel-1",
    filename: "flight-telemetry.csv",
    columns: ["time_s", "altitude_m", "velocity_mps", "thrust_n"],
    recognized: true,
    points: Array.from({ length: 12 }, (_, i) => ({
      time: i,
      altitude: Math.round(Math.sin((i / 11) * Math.PI) * 360 * multiplier),
      velocity: Math.round(Math.cos((i / 11) * Math.PI) * 70 * multiplier),
      thrust: i < 3 ? Math.round((65 - i * 12) * multiplier) : 0
    }))
  };
}

function referenceImage(slug: string) {
  const pngSlugs = new Set([
    "copenhagen-nexo-ii-reference",
    "dare-stratos-iv-reference",
    "princeton-spaceshot-reference",
    "space-concordia-starsailor-reference",
    "uci-rocket-blue-v2-reference"
  ]);
  return `/reference-rockets/${slug}.${pngSlugs.has(slug) ? "png" : "jpg"}`;
}

const referenceSpecs: ReferenceSpec[] = [
  { slug: "copenhagen-spica-reference", title: "Copenhagen Suborbitals Spica Reference", creator: "Copenhagen Suborbitals", priceCents: 0, difficulty: "High Power", motorClass: "Liquid bipropellant", predictedAltitudeM: 105000, actualAltitudeM: undefined, status: "Design reviewed", tags: ["amateur spaceflight", "crew capsule", "liquid engine"], forkCount: 428, downloads: 12400, lengthMm: 13000, diameterMm: 950, massG: 4000000, motorMountMm: 380, finMaterial: "welded stabilizer structure", recovery: "Parachute and capsule recovery system", referenceName: "Copenhagen Suborbitals Spica project", referenceUrl: "https://copenhagensuborbitals.com/rockets-2/spica" },
  { slug: "copenhagen-nexo-ii-reference", title: "Copenhagen Suborbitals Nexo II Flight Archive", creator: "Copenhagen Suborbitals", priceCents: 0, difficulty: "High Power", motorClass: "Liquid bipropellant", predictedAltitudeM: 8500, actualAltitudeM: 6500, status: "Telemetry attached", tags: ["sea launch", "guidance test", "amateur liquid"], forkCount: 302, downloads: 9300, lengthMm: 6700, diameterMm: 300, massG: 205000, motorMountMm: 160, finMaterial: "composite / aluminum fin set", recovery: "Parachute recovery and beacon bay", referenceName: "Copenhagen Suborbitals Nexo II mission", referenceUrl: "https://copenhagensuborbitals.com/missions/nexo-ii/" },
  { slug: "dare-stratos-iv-reference", title: "DARE Stratos IV Student Sounding Rocket", creator: "Delft Aerospace Rocket Engineering", priceCents: 0, difficulty: "High Power", motorClass: "Hybrid sounding rocket", predictedAltitudeM: 100000, actualAltitudeM: undefined, status: "Design reviewed", tags: ["student team", "hybrid motor", "sounding rocket"], forkCount: 365, downloads: 10100, lengthMm: 8200, diameterMm: 280, massG: 320000, motorMountMm: 180, finMaterial: "carbon composite fins", recovery: "Avionics and parachute recovery bay", referenceName: "DARE Stratos IV project", referenceUrl: "https://dare.tudelft.nl/stratos4/" },
  { slug: "hyend-heros-3-reference", title: "HyEnD HEROS 3 Hybrid Rocket", creator: "HyEnD Stuttgart", priceCents: 0, difficulty: "High Power", motorClass: "Hybrid", predictedAltitudeM: 32000, actualAltitudeM: 30000, status: "Telemetry attached", tags: ["student team", "hybrid", "altitude record"], forkCount: 224, downloads: 6800, lengthMm: 7500, diameterMm: 210, massG: 75000, motorMountMm: 130, finMaterial: "composite fin can", recovery: "Peak-altitude event recovery bay", referenceName: "HyEnD HEROS project archive", referenceUrl: "https://hyend.de/index.php/previous-projects/heros/" },
  { slug: "usc-rpl-aftershock-ii-reference", title: "USC RPL Aftershock II Flight Record", creator: "USC Rocket Propulsion Laboratory", priceCents: 0, difficulty: "High Power", motorClass: "Student-built solid", predictedAltitudeM: 144000, actualAltitudeM: 143300, status: "Media proof", tags: ["student-built motor", "altitude record", "flight archive"], forkCount: 512, downloads: 15600, lengthMm: 4500, diameterMm: 203, massG: 120000, motorMountMm: 152, finMaterial: "carbon composite fins", recovery: "High-altitude avionics and recovery package", referenceName: "USC RPL Aftershock II project", referenceUrl: "https://www.uscrpl.com/aftershock-ii" },
  { slug: "princeton-spaceshot-reference", title: "Princeton Rocketry SpaceShot Airframe", creator: "Princeton Rocketry Club", priceCents: 0, difficulty: "High Power", motorClass: "Solid sounding rocket", predictedAltitudeM: 91440, actualAltitudeM: undefined, status: "Design reviewed", tags: ["student team", "space shot", "carbon airframe"], forkCount: 188, downloads: 4200, lengthMm: 5100, diameterMm: 152, massG: 65000, motorMountMm: 98, finMaterial: "carbon composite fins", recovery: "Dual deployment recovery bay", referenceName: "Princeton Rocketry SpaceShot 2018-19", referenceUrl: "https://www.princetonrocketry.com/spaceshot-2018-19" },
  { slug: "space-concordia-starsailor-reference", title: "Space Concordia Starsailor Reference", creator: "Space Concordia Rocketry Division", priceCents: 0, difficulty: "High Power", motorClass: "Competition sounding rocket", predictedAltitudeM: 30480, actualAltitudeM: undefined, status: "Design reviewed", tags: ["student team", "Spaceport America Cup", "systems integration"], forkCount: 176, downloads: 3900, lengthMm: 4800, diameterMm: 160, massG: 52000, motorMountMm: 98, finMaterial: "composite fins", recovery: "Competition avionics and recovery bay", referenceName: "Space Concordia Rocketry projects", referenceUrl: "https://spaceconcordia.ca/rocketry" },
  { slug: "bps-scout-f-reference", title: "BPS.space Scout F Thrust-Vector Testbed", creator: "BPS.space", priceCents: 0, difficulty: "Advanced", motorClass: "Model rocket motor", predictedAltitudeM: 300, actualAltitudeM: 290, status: "Media proof", tags: ["individual maker", "thrust vector control", "active guidance"], forkCount: 694, downloads: 20800, lengthMm: 1150, diameterMm: 70, massG: 1800, motorMountMm: 29, finMaterial: "printed and composite stabilizers", recovery: "Parachute recovery and flight computer bay", referenceName: "BPS.space public project overview", referenceUrl: "https://bps.space/pages/about" },
  { slug: "uci-rocket-blue-v2-reference", title: "UCI Rocket Project Rocket Blue V2", creator: "UCI Rocket Project", priceCents: 0, difficulty: "High Power", motorClass: "Liquid test vehicle", predictedAltitudeM: 3000, actualAltitudeM: undefined, status: "Static fire data", tags: ["student team", "liquid engine", "test vehicle"], forkCount: 142, downloads: 3100, lengthMm: 3600, diameterMm: 170, massG: 80000, motorMountMm: 120, finMaterial: "aluminum and composite fins", recovery: "Avionics and recovery bay", referenceName: "UCI Rocket Project liquids program", referenceUrl: "https://www.rocket.eng.uci.edu/liquids-2/" },
  { slug: "burpg-spaceshot-reference", title: "BURPG Space-Shot Development Archive", creator: "Boston University Rocket Propulsion Group", priceCents: 0, difficulty: "High Power", motorClass: "Student research rocket", predictedAltitudeM: 100000, actualAltitudeM: undefined, status: "Design reviewed", tags: ["student team", "space-shot", "research archive"], forkCount: 231, downloads: 5700, lengthMm: 6000, diameterMm: 203, massG: 90000, motorMountMm: 127, finMaterial: "composite fin can", recovery: "High-altitude recovery and tracking bay", referenceName: "BURPG public project site", referenceUrl: "https://burpg.org/" }
];

export const mockProjects: RocketProject[] = referenceSpecs.map((spec, index) => {
  const components = componentsFor(spec, index);
  return {
    id: `project-${index + 1}`,
    slug: spec.slug,
    title: spec.title,
    creator: spec.creator,
    creatorRating: Number((4.5 + (index % 5) * 0.08).toFixed(1)),
    description: "A public-reference rocket project with structured CAD parameters, analysis results, build files, telemetry workspace, and evidence notes ready for comparison and forking.",
    priceCents: 0,
    tags: spec.tags,
    difficulty: spec.difficulty,
    motorClass: spec.motorClass,
    predictedAltitudeM: spec.predictedAltitudeM,
    actualAltitudeM: spec.actualAltitudeM,
    verificationStatus: spec.status,
    hasWebCad: true,
    hasFlightLog: spec.status === "Flight verified" || spec.status === "Telemetry attached" || spec.status === "Media proof",
    hasTelemetry: spec.status === "Flight verified" || spec.status === "Telemetry attached",
    hasThrustData: index >= 4,
    hasStlStep: index >= 5,
    verifiedFlight: spec.status === "Flight verified",
    forkCount: spec.forkCount,
    downloadCount: spec.downloads,
    image: referenceImage(spec.slug),
    specs: {
      lengthMm: spec.lengthMm,
      diameterMm: spec.diameterMm,
      massG: spec.massG,
      stabilityCalibers: Number((1.2 + index * 0.12).toFixed(1))
    },
    files: ["design.rh.json", "interoperable-design.xml", "bom.csv", "telemetry.csv", "build-notes.pdf"],
    components,
    telemetry: telemetry(Math.max(spec.predictedAltitudeM / 260, 0.7)),
    originalProjectId: undefined,
    royaltyPercent: 0,
    publicReference: {
      name: spec.referenceName,
      url: spec.referenceUrl
    }
  };
});

export const discussions: Discussion[] = [
  { id: "d1", projectId: "project-6", type: "Simulation issue", title: "Compare 38 mm adapter mass against stability margin", author: "Anya", comments: 8 },
  { id: "d2", projectId: "project-3", type: "Build question", title: "Transport coupler alignment and airframe straightness", author: "Marcus", comments: 4 },
  { id: "d3", projectId: "project-10", type: "Safety note", title: "Scale model recovery packing review", author: "Range Officer", comments: 13 }
];

export const safetyPolicies = [
  "For educational and lawful rocketry use only.",
  "Users are responsible for complying with local laws, launch rules, and safety codes.",
  "Do not upload harmful payloads, targeting systems, or weaponization instructions.",
  "Rocketry House may remove projects that violate safety or legal policies."
];
