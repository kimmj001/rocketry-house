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
Navier-Stokes equations with a cell-centered finite-volume method. The internal
block is body-fitted between the symmetry axis and the smooth nozzle wall. A
separate external block begins at the exit plane and spans the full farfield
radius immediately, so the numerical domain does not prescribe a plume
opening angle. Nonconformal annular faces at the exit are connected by their
exact overlap area; the remaining external inlet annulus receives the ambient
characteristic boundary condition.

Because the finite-volume geometry already includes radial weighting, the only
separately applied geometric momentum source is the pressure/hoop-stress term.
It is integrated with the exact cell measure
`integral(1/r dV)`, rather than evaluating `V/r` at the cell center. This
exactly cancels pressure face forces for a uniform quiescent state, including
curved body-fitted cells. At the first radial cell, `v/r` uses the symmetry
limit `dv/dr`.

## Numerical methods

- HLLC upwind inviscid flux with Rusanov fallback
- Pressure-jump shock sensor with first-order face states and local
  HLLC/Rusanov blending to suppress grid-aligned carbuncle modes
- Weighted least-squares gradients with a one-sided fallback
- Second-order MUSCL reconstruction
- Venkatakrishnan limiter and first-order positivity fallback
- Gradient-based central viscous flux
- Fourier heat conduction with molecular and turbulent conductivity
- Local pseudo-time explicit Euler transport update with positivity-preserving point-implicit
  Spalart-Allmaras destruction
- Convective and viscous CFL limits
- Optional CFL ramp to the reconstruction-dependent stability ceiling
- Cell-local conservative-state blending to preserve positive density,
  pressure, and temperature
- SA diffusion limit and a separately counted bound on the transported
  modified-viscosity ratio
- Adaptive CFL reduction, extended step retry, and gradual CFL recovery after
  a nonphysical proposal

The interactive lab uses a cold start. At iteration zero, every cell is a
quiescent ambient state and no developed nozzle flow or plume is present.
Starting the solver applies the chamber boundary condition at the inlet, so the
pressure front can be followed through the chamber, throat, nozzle exit, and
external domain.

The browser defaults to cell-local pseudo-time stepping for the steady RANS
solve. Each cell uses its own convective and viscous stability limit, with
neighbor-ratio smoothing and a bounded maximum ratio to prevent abrupt update
jumps at the nozzle-exit interface. The smallest and largest accepted local
steps are reported separately. This removes the previous bottleneck in which
the smallest hot throat cell forced the entire `1.8 m` ambient block to advance
at the same tiny step. Local pseudo-time changes only the path to the steady
residual root, not the finite-volume equations or their converged solution.
Global explicit stepping remains selectable when a time-ordered transient is
more important than reaching the steady plume quickly.

Strong moving pressure fronts are detected from the normalized face pressure
jump. Only those faces fall back to cell averages and blend toward the more
dissipative Rusanov flux. This prevents a front-cell density undershoot from
collapsing the CFL while leaving second-order MUSCL/HLLC reconstruction active
through smooth expansions, shear layers, and established plume structure.

Server-side performance calculations retain an optional quasi-steady
initialization: subsonic upstream of the throat, supersonic downstream, and a
smooth plume-informed external guess. This avoids weakening upload and
published-project metrics that use a finite iteration budget. In both modes,
snapshots after iteration zero come from the finite-volume residual and state
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
constants. The stiff quadratic destruction term uses a point-implicit
Patankar update, while production and transport remain explicit. This preserves
positive `nuTilde` without forcing one cell's destruction timescale onto the
entire global timestep. Wall distance is measured to the actual smooth nozzle
contour.

Boundary conditions:

- Inlet: stagnation pressure and temperature combined with the outgoing
  interior Riemann invariant
- Axis: reflected radial velocity and zero normal gradients
- Wall: no-slip, adiabatic, `nuTilde = 0`
- External farfield: interior outgoing and ambient incoming Riemann invariants
  for subsonic flow; complete extrapolation for supersonic outflow
- Outlet: the same characteristic treatment in the axial direction

## Browser execution

The interactive lab runs the solver in a Web Worker. Solver-critical arrays
stay in the worker; reduced `Float32Array` field snapshots are transferred to
the main thread. The canvas mirrors the computed `r >= 0` field only for
presentation. Start, pause, resume, reset, and single-step controls do not
block the page.

Interactive meshes use one quarter of the production cell count so long
transient runs remain responsive:

- Development: `96 x 18`
- Standard: `144 x 28`
- High: `208 x 40`

Server-side upload and published-project calculations retain the full
production meshes.

The browser lab defaults to MUSCL reconstruction with sixteen iterations per
display update. First-order reconstruction remains selectable only as a
debugging mode. Cold starts use an accelerated CFL ramp; the MUSCL path retains
a lower CFL ceiling than the monotone first-order path. Weighted least-squares
stencils, reconstruction buffers, conservative update buffers, and face-state
scratch storage are reused across iterations to avoid garbage-collector stalls.

Automatic static-pressure coloring uses an ambient-centered diverging palette
and a robust external-flow contrast scale. Chamber pressure saturates at the
high end instead of flattening the much smaller expansion and compression
variations in the plume.

The canvas bilinearly reconstructs cell-centered values in body-fitted
coordinates at display-pixel resolution. This removes cell-sized stair steps
without changing the solver mesh, timestep, or stability characteristics. The
`Mesh` overlay still shows the underlying finite-volume cells.

The automatic pressure view uses a restrained, multi-stop cool-to-warm palette
and a widened robust contrast range. Moderate pressure changes remain distinct
without immediately saturating to the lowest or highest display color, while
near-ambient moving flow retains a dim neutral bridge instead of a black seam.

The default view is the raw cell-centered static-pressure field. All selectable
views are direct solver arrays. The renderer performs bilinear interpolation
in physical radius only for display and does not apply a plume envelope,
thermal-energy opacity mask, synthetic shock detector, or blur. Ambient cells
remain visible because they are part of the external computational block.

## Diagnostics

The UI reports dimensionless equation-rate norms for continuity, axial
momentum, radial momentum, energy, and turbulence. These norms are independent
of timestep, so reducing `dt` cannot create false convergence. It also reports
CFL and timestep; mass-flow spread; positivity floors; limited faces;
HLLC and first-order fallbacks; rejected steps; NaN count; extrema; and mass
flow at five axial stations. Convergence additionally requires less than two
percent mass-flow spread across all five stations.

## Known limitations

- The exact reference solver, limiter, CEA mixture ratio, nozzle contour, and
  wall thermal condition are unknown.
- The current time scheme is first-order explicit Euler.
- The wall mesh is body-fitted but not locally clustered at the wall or throat.
- The SA implementation is educational and has not been calibrated for wall
  `y+`; modified viscosity clipping is exposed as a diagnostic.
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
gradients, symmetry and wall ghost states, cold-start inlet propagation, a
low-resolution nozzle smoke test, axis finiteness, positivity, a long
near-vacuum plume run at aggressive CFL, and a development-mesh performance
check.
