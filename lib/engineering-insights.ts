export const evidenceMarketplaceFilters = [
  "Static-fire tested",
  "Measured thrust curve",
  "Chamber pressure trace",
  "Design vs measured",
  "Total impulse",
  "Specific impulse",
  "Nozzle details",
  "Bulkhead / retention notes",
  "Thermal liner notes",
  "Grain configuration notes",
  "Post-test inspection",
  "Failure analysis"
];

export const evidencePrinciples = [
  "Treat each project as an engineering notebook, not just a downloadable file.",
  "Keep predicted and measured performance side by side.",
  "Attach raw test data before summarizing conclusions.",
  "Record hardware changes between test articles and flights.",
  "Make post-test inspection and failure notes first-class project evidence."
];

export const staticTestMetrics = [
  ["Peak thrust", "820 N", "from uploaded thrust-time CSV"],
  ["Burn time", "2.18 s", "detected from thrust threshold"],
  ["Total impulse", "1,148 N-s", "integrated from thrust curve"],
  ["Specific impulse", "142 s", "requires propellant mass"],
  ["Peak chamber pressure", "5.8 MPa", "if pressure trace exists"],
  ["Design delta", "-6.4%", "measured vs predicted impulse"]
];

export const uploadEvidenceChecklist = [
  "Static test report objective",
  "Motor hardware version",
  "Nozzle throat and exit notes",
  "Bulkhead / retention method",
  "Casing and liner inspection",
  "Grain configuration summary",
  "Raw thrust-time data",
  "Optional chamber pressure trace",
  "Post-test photos",
  "Design changes for next test"
];
