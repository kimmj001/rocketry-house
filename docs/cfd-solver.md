# Rocketry House axisymmetric nozzle CFD

## Scope

The production nozzle CFD path is an educational, browser-compatible
compressible-flow solver. It is not independently validated, certified, or a
replacement for a controlled mesh-convergence study and experimental data.

The solver computes the internal chamber, converging section, throat, and
diverging section. It does not currently solve an external plume. The UI never
draws a plume beyond the solved domain.

## Equations and discretization

The conserved state is stored in structure-of-arrays `Float64Array` buffers:

```text
[rho, rho*u, rho*v, rho*E, rho*nuTilde]
```

The solver advances the two-dimensional axisymmetric compressible
Navier-Stokes equations with a cell-centered finite-volume method. The mesh is
body-fitted between the symmetry axis and a smooth converging-diverging wall.
Cell volumes and face vectors are the exact ring/frustum measures, including
radial weighting.

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
- Step rejection and CFL reduction after a nonphysical update

The initial state is a quasi-one-dimensional isentropic nozzle estimate:
subsonic upstream of the throat and supersonic downstream. This is only an
initial guess; every displayed snapshot after iteration zero comes from the
finite-volume residual and state update.

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
- Outlet: full extrapolation when supersonic; ambient static pressure with
  compatible extrapolated variables when subsonic

## Browser execution

The interactive lab runs the solver in a Web Worker. Solver-critical arrays
stay in the worker; reduced `Float32Array` field snapshots are transferred to
the main thread. The canvas mirrors the computed `r >= 0` field only for
presentation. Start, pause, resume, reset, and single-step controls do not
block the page.

Default meshes:

- Development: `96 x 36`
- Standard: `160 x 56`
- High: `240 x 80`

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
- No external plume, reacting chemistry, conjugate heat transfer, radiation,
  multiphase flow, or moving boundaries are solved.
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
axis finiteness, positivity, and a development-mesh performance check.
