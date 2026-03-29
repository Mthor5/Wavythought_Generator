function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function getExportScaleFactor(state) {
  const previewUnits = state?.ui?.previewUnits || "mm";
  const sourceUnits = state?.meta?.sourceUnits || "mm";
  if (previewUnits === sourceUnits) {
    return 1;
  }
  if (sourceUnits === "mm" && previewUnits === "in") {
    return 1 / 25.4;
  }
  if (sourceUnits === "in" && previewUnits === "mm") {
    return 25.4;
  }
  return 1;
}

function scaleVertex(vertex, scaleFactor) {
  return {
    x: vertex.x * scaleFactor,
    y: vertex.y * scaleFactor,
    z: vertex.z * scaleFactor,
  };
}

function formatVertex(vertex, scaleFactor) {
  const scaled = scaleVertex(vertex, scaleFactor);
  return `${scaled.x.toFixed(6)} ${scaled.z.toFixed(6)} ${(-scaled.y).toFixed(6)}`;
}

function calculateNormal(a, b, c) {
  const ux = b.x - a.x;
  const uy = b.z - a.z;
  const uz = -b.y - -a.y;
  const vx = c.x - a.x;
  const vy = c.z - a.z;
  const vz = -c.y - -a.y;

  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}

function scalePoints(points, scaleFactor) {
  return points.map((point) => ({
    x: point.x * scaleFactor,
    y: point.y * scaleFactor,
  }));
}

export function exportObjMesh(surfaceMesh, state) {
  const scaleFactor = getExportScaleFactor(state);
  const lines = ["# Wavythought Generator OBJ", "o wavy_surface"];
  surfaceMesh.vertices.forEach((vertex) => {
    lines.push(`v ${formatVertex(vertex, scaleFactor)}`);
  });
  surfaceMesh.quads.forEach((quad) => {
    lines.push(`f ${quad[0] + 1} ${quad[1] + 1} ${quad[2] + 1} ${quad[3] + 1}`);
  });
  downloadText("wavythought-surface.obj", `${lines.join("\n")}\n`);
}

export function exportStlMesh(surfaceMesh, state) {
  const scaleFactor = getExportScaleFactor(state);
  const lines = ["solid wavythought_surface"];
  surfaceMesh.quads.forEach((quad) => {
    const triangles = [
      [quad[0], quad[1], quad[2]],
      [quad[0], quad[2], quad[3]],
    ];
    triangles.forEach(([aIndex, bIndex, cIndex]) => {
      const a = scaleVertex(surfaceMesh.vertices[aIndex], scaleFactor);
      const b = scaleVertex(surfaceMesh.vertices[bIndex], scaleFactor);
      const c = scaleVertex(surfaceMesh.vertices[cIndex], scaleFactor);
      const [nx, ny, nz] = calculateNormal(a, b, c);
      lines.push(`  facet normal ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}`);
      lines.push("    outer loop");
      lines.push(`      vertex ${formatVertex(a, 1)}`);
      lines.push(`      vertex ${formatVertex(b, 1)}`);
      lines.push(`      vertex ${formatVertex(c, 1)}`);
      lines.push("    endloop");
      lines.push("  endfacet");
    });
  });
  lines.push("endsolid wavythought_surface");
  downloadText("wavythought-surface.stl", `${lines.join("\n")}\n`);
}

export function exportSurfaceJson(surfaceMesh, state) {
  const scaleFactor = getExportScaleFactor(state);
  const payload = {
    format: "wavythought-surface-v1",
    exportNote:
      "This V1 export stores the sampled wave field mesh. IGES fitting is not included in this first pass.",
    exportUnits: state.ui.previewUnits || state.meta.sourceUnits || "mm",
    surface: {
      resolution: state.surface.resolution,
      heightScale: state.surface.heightScale * scaleFactor,
      edgeFade: state.surface.edgeFade * scaleFactor,
      internalEdgeFade: state.surface.internalEdgeFade * scaleFactor,
      species: state.surface.species,
      woodEnabled: state.surface.woodEnabled,
    },
    sources: state.sources.map((source) => ({
      ...source,
      points: scalePoints(source.points, scaleFactor),
    })),
    loops: state.loops.map((loop) => ({
      ...loop,
      points: scalePoints(loop.points, scaleFactor),
    })),
    mesh: {
      ...surfaceMesh,
      vertices: surfaceMesh.vertices.map((vertex) => scaleVertex(vertex, scaleFactor)),
    },
  };
  downloadText("wavythought-surface.json", `${JSON.stringify(payload, null, 2)}\n`);
}
