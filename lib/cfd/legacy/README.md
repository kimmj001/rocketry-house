# Legacy nozzle CFD

This directory preserves the previous inviscid, masked-Cartesian finite-volume
solver for regression comparison only. Production routes use `lib/cfd/rans`,
which adds a body-fitted axisymmetric mesh, frozen hydrolox properties,
second-order reconstruction, viscous transport, and Spalart-Allmaras
turbulence.
