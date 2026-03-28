function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function formatVertex(vertex) {
  return `${vertex.x.toFixed(6)} ${vertex.z.toFixed(6)} ${(-vertex.y).toFixed(6)}`;
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

export function exportObjMesh(surfaceMesh) {
  const lines = ["# Wavythought Generator OBJ", "o wavy_surface"];
  surfaceMesh.vertices.forEach((vertex) => {
    lines.push(`v ${formatVertex(vertex)}`);
  });
  surfaceMesh.quads.forEach((quad) => {
    lines.push(`f ${quad[0] + 1} ${quad[1] + 1} ${quad[2] + 1} ${quad[3] + 1}`);
  });
  downloadText("wavythought-surface.obj", `${lines.join("\n")}\n`);
}

export function exportStlMesh(surfaceMesh) {
  const lines = ["solid wavythought_surface"];
  surfaceMesh.quads.forEach((quad) => {
    const triangles = [
      [quad[0], quad[1], quad[2]],
      [quad[0], quad[2], quad[3]],
    ];
    triangles.forEach(([aIndex, bIndex, cIndex]) => {
      const a = surfaceMesh.vertices[aIndex];
      const b = surfaceMesh.vertices[bIndex];
      const c = surfaceMesh.vertices[cIndex];
      const [nx, ny, nz] = calculateNormal(a, b, c);
      lines.push(`  facet normal ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}`);
      lines.push("    outer loop");
      lines.push(`      vertex ${formatVertex(a)}`);
      lines.push(`      vertex ${formatVertex(b)}`);
      lines.push(`      vertex ${formatVertex(c)}`);
      lines.push("    endloop");
      lines.push("  endfacet");
    });
  });
  lines.push("endsolid wavythought_surface");
  downloadText("wavythought-surface.stl", `${lines.join("\n")}\n`);
}

export function exportSurfaceJson(surfaceMesh, state) {
  const payload = {
    format: "wavythought-surface-v1",
    exportNote:
      "This V1 export stores the sampled wave field mesh. IGES fitting is not included in this first pass.",
    surface: {
      resolution: state.surface.resolution,
      heightScale: state.surface.heightScale,
      edgeFade: state.surface.edgeFade,
      species: state.surface.species,
      woodEnabled: state.surface.woodEnabled,
    },
    sources: state.sources,
    loops: state.loops,
    mesh: surfaceMesh,
  };
  downloadText("wavythought-surface.json", `${JSON.stringify(payload, null, 2)}\n`);
}
