# CFD reference notice

The RocketryHouse axisymmetric nozzle CFD implementation was reviewed against the public Wind Tunnel numerical-method organization in:

- Source: `ec175/spectrometry_public`
- Author: `ec175`
- URL: https://github.com/ec175/spectrometry_public
- Reference commit: `225aba2e90e3862051c100495ede98bcd49ae584`
- Reviewed on: 2026-08-11

The compressible-flow concepts reviewed were finite-volume conservation, MUSCL reconstruction, HLLC fluxes, SSP-RK2 integration, ideal-gas thermodynamics, shock-tube validation, and positivity-oriented stability handling.

The low-Mach D2Q9 Lattice Boltzmann method was intentionally not applied to this choked, transonic, and supersonic internal-nozzle solver. RocketryHouse retains its body-fitted axisymmetric viscous formulation, nozzle boundary conditions, thermodynamic model, and Spalart-Allmaras transport while aligning its compressible time integration with the reviewed SSP-RK2 method.

No explicit source-code license was present in the reviewed repository. RocketryHouse therefore does not copy or redistribute its source code. The TypeScript implementation in this directory is an original implementation of the published numerical methods, adapted to RocketryHouse geometry and web-worker runtime constraints. This notice is attribution for the engineering reference, not a claim that the reference project endorses RocketryHouse.
