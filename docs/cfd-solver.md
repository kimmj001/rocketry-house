# Rocketry House axisymmetric nozzle CFD

## Scope

The production nozzle CFD path is an educational, browser-compatible
compressible-flow solver. It is not independently validated, certified, or a
replacement for a controlled mesh-convergence study and experimental data.

The solver computes the internal chamber, converging section, throat,
diverging section, and a long external free-jet domain. The default downstream
domain extends `1.8 m`, approximately `6.8` internal-nozzle lengths, beyond the
exit. Every plume cell shown in the UI belongs to the solved finite-volume
domain.

## Equations and discretization

The conserved state is stored in structure-of-arrays `Float64Array` buffers:

```text
[rho, rho*u, rho*v, rho*E, rho*nuTilde]
```

The solver advances the two-dimensional axisymmetric compressible
Navier-Stokes equations with a cell-centered finite-volume method. The mesh is
body-fitted between the symmetry axis and a smooth converging-diverging wall
inside the motor. Downstream of the nozzle lip, the same mesh expands to a
finite farfield boundary. Cell volumes and face vectors are the exact
ring/frustum measures, including radial weighting.

Because the finite-volume geometry already includes the radial weighting, the
only separately applied geometric momentum source is the pressure/hoop-stress
term `(p - tau_theta_theta) / r`. This avoids double-counting axisymmetric
terms. At the first radial cell, `v/r` uses the symmetry limit `dv/dr`.

## Numerical methods

- HLLC upwind inviscid flux with Rusanov fallback
- Weighted least-squares gradients with a one-sided fallback
- Second-order MUSCL reconstruction
- Venkatakrishnan limiter and first-order positivity fallback
- Gradient-based central viscous flux
- Fourier heat conduction with molecular and turbulent conductivity
- Explicit Euler pseudo-time integration
- Convective and viscous CFL limits
- Optional CFL ramp from the configured starting value to 0.5
- Cell-local conservative-state blending to preserve positive density,
  pressure, and temperature
- Adaptive CFL reduction, extended step retry, and gradual CFL recovery after
  a nonphysical proposal

The internal initial state is a quasi-one-dimensional isentropic nozzle
estimate: subsonic upstream of the throat and supersonic downstream. The
external domain starts from a smooth plume-informed guess blended into the
ambient state to reduce browser convergence time. This is only an initial
condition; subsequent snapshots come from the finite-volume residual and state
update.

## Thermodynamics

Two models are available:

1. Constant ideal gas
2. Axially interpolated frozen hydrolox properties

The hydrolox preset uses replaceable chamber, throat, and exit stations for
`gamma`, gas constant, viscosity, conductivity, and Prandtl number. The chamber
reference is approximately `4.826 MPa`, `3512.4 K`, `gamma = 1.1489`, and
`R = 378.1 J/(kg K)`. These values are CEA-style approximations, not an exact
engine mixture calculation. A future CEA table importer can replace the
station data without changing the solver.

## Turbulence and wall treatment

The optional Spalart-Allmaras model transports `rho * nuTilde`. It includes the
standard production, diffusion, and wall-destruction structure with standard
constants. Wall distance is measured to the actual smooth nozzle contour.

Boundary conditions:

- Inlet: controlled low-Mach chamber total-condition state
- Axis: reflected radial velocity and zero normal gradients
- Wall: no-slip, adiabatic, `nuTilde = 0`
- External farfield: ambient pressure and quiescent ambient state for incoming
  or subsonic characteristics; extrapolation for supersonic outflow
- Outlet: full extrapolation when supersonic; ambient static pressure with
  compatible extrapolated variables when subsonic

## Browser execution

The interactive lab runs the solver in a Web Worker. Solver-critical arrays
stay in the worker; reduced `Float32Array` field snapshots are transferred to
the main thread. The canvas mirrors the computed `r >= 0` field only for
presentation. Start, pause, resume, reset, and single-step controls do not
block the page.

Default meshes:

- Development: `192 x 36`
- Standard: `288 x 56`
- High: `416 x 80`

## Diagnostics

The UI reports continuity, axial momentum, radial momentum, energy, and
turbulence residuals; CFL and timestep; positivity floors; limited faces;
HLLC and first-order fallbacks; rejected steps; NaN count; extrema; and mass
flow at five axial stations.

## Known limitations

- The exact reference solver, limiter, CEA mixture ratio, nozzle contour, and
  wall thermal condition are unknown.
- The current time scheme is first-order explicit Euler.
- The wall mesh is body-fitted but not locally clustered at the wall or throat.
- The SA implementation is educational and has not been calibrated for wall
  `y+`.
- The external domain is finite and uses a single frozen gas model for the
  exhaust/ambient mixture; species mixing and reacting chemistry are not
  solved.
- Conjugate heat transfer, radiation, multiphase flow, and moving boundaries
  are not solved.
- Server-side quick runs use a finite iteration budget and may return before
  strict residual convergence; the UI labels that state explicitly.

## Tests

Run:

```bash
pnpm test:cfd
```

The suite covers conservative/primitive conversion, ideal-gas identities,
HLLC consistency, contact and Sod Riemann states, linear least-squares
gradients, symmetry and wall ghost states, a low-resolution nozzle smoke test,
axis finiteness, positivity, a long near-vacuum plume run at aggressive CFL,
and a development-mesh performance check.
