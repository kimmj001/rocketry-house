export const platformNav = [
  ["Explore", "/marketplace"],
  ["Build", "/build"],
  ["Community", "/community"],
  ["Upload", "/upload"],
  ["Rankings", "/ranking"],
  ["Profile", "/profile"]
] as const;

export const buildModules = [
  ["Motor", "Solid motor geometry, burn analysis, thrust curves, pressure estimates, and saved motor libraries."],
  ["Rocket", "Airframe CAD, motor integration, CG/CP tracking, drag estimates, and launch simulation."],
  ["Components", "Reusable nose cones, tubes, fin sets, mounts, rail buttons, avionics bays, and recovery hardware."],
  ["Recovery", "Parachute sizing, deployment events, descent rate checks, and post-flight recovery logs."],
  ["Avionics", "Altimeter, GPS, IMU, telemetry, event detection, and uploaded electronics data."],
  ["Airframe", "Tube stacks, couplers, bulkheads, materials, mass properties, and manufacturing packages."],
  ["Propellant Library", "Educational profiles for simulation and comparison without manufacturing instructions."],
  ["Materials", "Composite, metal, printed, and tube material properties for mass and structural estimates."],
  ["Simulation Integration", "Shared data model connecting motors, rockets, telemetry, and project publication."]
] as const;

export const motorEquations = [
  ["Burn rate law", "r = aP^n", "Burn rate responds to chamber pressure through coefficient a and exponent n."],
  ["Mass flow", "m_dot = rho Ab r", "Propellant mass generation uses density, burning area, and regression rate."],
  ["Characteristic velocity", "c* = Pc At / m_dot", "A compact performance metric used to compare motor efficiency."],
  ["Thrust", "F = m_dot Ve + (Pe - Pa) Ae", "Momentum thrust plus pressure correction at the nozzle exit."],
  ["Kn relationship", "Kn = Ab / At", "Burn area divided by throat area; a major pressure driver in SRM analysis."],
  ["Pressure relation", "Pc proportional to Kn^(1/(1-n))", "Educational pressure estimate used for visual engineering analysis."],
  ["Specific impulse", "Isp = F / (m_dot g0)", "Impulse efficiency normalized by propellant weight flow."],
  ["Total impulse", "It = integral F dt", "Area under the thrust curve determines motor class."],
  ["Mass fraction", "mf = mp / m0", "Propellant mass divided by loaded motor mass."]
] as const;

export const motorGraphOutputs = [
  "Thrust vs Time",
  "Chamber Pressure vs Time",
  "Kn vs Time",
  "Mass Flow vs Time",
  "Propellant Mass Remaining vs Time",
  "Burn Area vs Time",
  "Burn Rate vs Time",
  "Specific Impulse vs Time",
  "Total Impulse Accumulation",
  "Chamber Temperature vs Time"
] as const;

export const flightEquations = [
  ["Newton's second law", "F = ma", "The net force determines vehicle acceleration."],
  ["Acceleration", "a = (T - D - mg) / m", "Thrust, drag, gravity, and changing mass drive the vertical point-mass model."],
  ["Drag", "D = 0.5 rho v^2 Cd A", "Atmospheric density, speed, drag coefficient, and reference area set drag load."],
  ["Altitude integration", "h(t+dt) = h(t) + v dt", "Altitude is integrated from velocity over time."],
  ["Velocity integration", "v(t+dt) = v(t) + a dt", "Velocity is integrated from acceleration over time."],
  ["Mass depletion", "m(t) = m0 - integral m_dot dt", "Motor burn reduces vehicle mass during powered flight."],
  ["Stability margin", "calibers = (CP - CG) / diameter", "Positive margin indicates CP behind CG in the flight direction."]
] as const;

export const flightGraphOutputs = [
  "Altitude vs Time",
  "Velocity vs Time",
  "Acceleration vs Time",
  "Mach Number vs Time",
  "Dynamic Pressure vs Time",
  "Drag Force vs Time",
  "Thrust vs Time",
  "Mass vs Time",
  "Stability Margin vs Time",
  "Flight Path Visualization",
  "Energy Distribution",
  "Descent Rate vs Time"
] as const;

export const rankingCategories = [
  "Highest altitude",
  "Best efficiency",
  "Most downloaded motor",
  "Best stability",
  "Longest burn",
  "Best educational project",
  "Top organization",
  "Best telemetry",
  "Top simulation accuracy"
] as const;

export const researchSections = [
  ["Propulsion", "Motor analysis, thrust curves, pressure traces, performance comparison, and static-fire data."],
  ["Aerodynamics", "Drag estimates, fin studies, CP modeling, stability margin, and flight correlation."],
  ["Avionics", "Altimeters, telemetry, GPS, event detection, and data-quality writeups."],
  ["Systems Engineering", "Requirements, design trades, reliability reviews, and mission-style project dossiers."],
  ["Launch Analysis", "Flight reports, weather context, recovery events, deviations, and post-flight evidence."],
  ["Materials", "Airframes, composites, printed parts, thermal barriers, and mass-property libraries."],
  ["Amateur Mission Reports", "Team publications, university launches, club tests, and postmortems."]
] as const;

export const prestigeBadges = [
  "Verified builder",
  "Verified launch",
  "Propulsion specialist",
  "Flight systems specialist",
  "Telemetry analyst",
  "Educational contributor",
  "Evidence publisher"
] as const;
