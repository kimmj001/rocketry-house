export const sampleOrganizations = [
  {
    name: "Global Student Rocketry Alliance",
    focus: "University and high-school aerospace teams",
    score: "21,300",
    ranking: "#1",
    teams: ["DARE Stratos Team", "MIT Rocket Team Propulsion", "Waterloo Recovery Systems", "Seoul STEM Launch Lab"]
  },
  {
    name: "Open Aerospace Systems Network",
    focus: "Open avionics, telemetry, and simulation groups",
    score: "18,420",
    ranking: "#2",
    teams: ["PSAS Avionics Group", "Open Aerospace Simulation Lab"]
  },
  {
    name: "Independent Experimental Rocketry Federation",
    focus: "Independent lawful experimental rocketry groups",
    score: "15,880",
    ranking: "#3",
    teams: ["Copenhagen Guidance Team", "Desert Static-Fire Collective"]
  }
] as const;

export const sampleTeams = [
  ["DARE Stratos Team", "Global Student Rocketry Alliance", "28 projects", "altitude ranking"],
  ["MIT Rocket Team Propulsion", "Global Student Rocketry Alliance", "24 projects", "education ranking"],
  ["Waterloo Recovery Systems", "Global Student Rocketry Alliance", "16 projects", "systems engineering"],
  ["Seoul STEM Launch Lab", "Global Student Rocketry Alliance", "12 projects", "student portfolio"],
  ["PSAS Avionics Group", "Open Aerospace Systems Network", "18 projects", "telemetry leader"],
  ["Open Aerospace Simulation Lab", "Open Aerospace Systems Network", "31 projects", "research publisher"],
  ["Copenhagen Guidance Team", "Independent Experimental Rocketry Federation", "43 projects", "7 verified launches"],
  ["Desert Static-Fire Collective", "Independent Experimental Rocketry Federation", "14 projects", "static-fire archive"]
] as const;
