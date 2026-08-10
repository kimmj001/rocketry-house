# CFD reference notice

The RocketryHouse external-flow CFD implementation was informed by the public Wind Tunnel documentation and numerical-method organization in:

- Source: `ec175/spectrometry_public`
- Author: `ec175`
- URL: https://github.com/ec175/spectrometry_public
- Reference commit: `225aba2e90e3862051c100495ede98bcd49ae584`
- Reviewed on: 2026-08-10

Concepts reviewed were D2Q9 Lattice Boltzmann flow, bounce-back solid boundaries, MUSCL reconstruction, HLLC fluxes, SSP-RK2 integration, ideal-gas post-processing, body-mask rasterization, vorticity, and velocity-field streakline advection.

No explicit source-code license was present in the reviewed repository. RocketryHouse therefore does not copy or redistribute its source code. The TypeScript implementation in this directory is an original implementation of the published numerical methods, adapted to RocketryHouse geometry and runtime constraints. This notice is attribution for the engineering reference, not a claim that the reference project endorses RocketryHouse.
