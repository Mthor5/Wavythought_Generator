# Wavythought Generator

## Project summary

Wavythought Generator is a browser-based V1 concept app for building static wave-driven surface studies from imported 2D profiles. The current pass focuses on fast visualization, editable wave sources, and exportable mesh data for downstream exploration.

## Features

- Import closed profile inputs from SVG, DXF, and raster images
- Normalize imported loops into a surface-driving outer profile plus interior color-break regions
- Add point and curve wave sources with amplitude, frequency, phase, decay, reach, continuation, and combine-mode controls
- Fade all waves toward the outer edge of the profile
- Preview the surface in matte grey or procedural wood species presets including walnut, oak, ash, maple, cherry, padauk, and purpleheart
- Export the sampled surface mesh as STL, OBJ, or JSON surface data

## Getting started

1. Open [index.html](./index.html) in a modern browser with internet access.
2. The app loads a bundled sample profile immediately.
3. Import an SVG, DXF, or image file to replace the sample.
4. Add point or curve sources in the 2D view and tune the surface controls in the sidebar.
5. Export the V1 mesh once the shape looks right.

Note: the 3D preview uses Three.js from a CDN to avoid a build step in this initial version.

## Controls

- `Load Sample`: restore the bundled demonstration profile
- `Import SVG, DXF, or image`: load a new profile source
- `Image threshold` and `Invert image trace`: tune raster tracing before importing an image silhouette
- `SVG path sampling`: increase or reduce SVG curve sampling density
- `Grid resolution`: control surface tessellation density
- `Height scale`: scale the total wave displacement
- `Edge fade distance`: flatten the wave field near the outer profile edge
- `Add Point` and `Add Curve`: place new wave sources in the 2D layout view
- Per-source controls: edit wave amplitude, frequency, phase, decay, reach, continuation mode, and add/subtract/multiply behavior
- `Wood grain preview`: toggle procedural wood visualization
- `Base species`: choose the default wood species for the main surface
- `Export STL`, `Export OBJ`, `Export Surface JSON`: download the current sampled mesh

## Current V1 limitations

- DXF support is limited to closed polyline entities in this pass
- SVG import ignores advanced transforms and focuses on direct geometry elements
- The OBJ export uses quads for fully sampled cells and does not yet trim boundary cells analytically
- STL and OBJ export the sampled surface mesh, not a watertight fabrication solid
- IGES export is not included yet because the sampled wave field still needs a fitted CAD-surface representation
