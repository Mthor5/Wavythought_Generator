import { normalizeLoops, polygonArea } from "./geometry.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const CLOSE_DISTANCE_EPSILON = 1e-3;

function getRawBounds(loops) {
  if (!loops.length) {
    return { width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  loops.forEach((loop) => {
    loop.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  });

  return {
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

function parsePointsAttribute(value) {
  return value
    .trim()
    .split(/[\s,]+/)
    .reduce((points, token, index, tokens) => {
      if (index % 2 === 0 && tokens[index + 1] !== undefined) {
        points.push({
          x: Number(token),
          y: Number(tokens[index + 1]),
        });
      }
      return points;
    }, []);
}

function sampleSvgPath(pathElement, sampleCount) {
  const totalLength = pathElement.getTotalLength();
  const points = [];
  for (let step = 0; step < sampleCount; step += 1) {
    const point = pathElement.getPointAtLength((step / sampleCount) * totalLength);
    points.push({ x: point.x, y: point.y });
  }
  return points;
}

function isClosedSvgPath(pathElement) {
  const d = pathElement.getAttribute("d") || "";
  if (/[zZ]/.test(d)) {
    return true;
  }

  const totalLength = pathElement.getTotalLength();
  const start = pathElement.getPointAtLength(0);
  const end = pathElement.getPointAtLength(totalLength);
  return distanceBetween(start, end) <= CLOSE_DISTANCE_EPSILON;
}

function sampleCircle(cx, cy, rx, ry, sampleCount) {
  const points = [];
  for (let step = 0; step < sampleCount; step += 1) {
    const angle = (step / sampleCount) * Math.PI * 2;
    points.push({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    });
  }
  return points;
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function closeLoop(points, tolerance = CLOSE_DISTANCE_EPSILON) {
  if (points.length < 3) {
    return null;
  }

  const closed = points.map((point) => ({ x: point.x, y: point.y }));
  const first = closed[0];
  const last = closed[closed.length - 1];

  if (distanceBetween(first, last) <= tolerance) {
    closed[closed.length - 1] = { ...first };
  }

  return closed;
}

function maybeClosedLoop(points, explicitClosed = false, tolerance = CLOSE_DISTANCE_EPSILON) {
  if (points.length < 3) {
    return null;
  }

  const first = points[0];
  const last = points[points.length - 1];
  if (explicitClosed || distanceBetween(first, last) <= tolerance) {
    return closeLoop(points, tolerance);
  }

  return null;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resampleClosedLoop(points, sampleCount) {
  if (points.length < 3 || sampleCount <= 3) {
    return points;
  }

  const edges = [];
  let perimeter = 0;
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const length = distanceBetween(start, end);
    edges.push({ start, end, length, offset: perimeter });
    perimeter += length;
  }

  if (perimeter <= CLOSE_DISTANCE_EPSILON) {
    return points;
  }

  const samples = [];
  for (let step = 0; step < sampleCount; step += 1) {
    const target = (perimeter * step) / sampleCount;
    const edge =
      edges.find((candidate) => target <= candidate.offset + candidate.length) ||
      edges[edges.length - 1];
    const localDistance = target - edge.offset;
    const t = edge.length <= CLOSE_DISTANCE_EPSILON ? 0 : localDistance / edge.length;
    samples.push({
      x: edge.start.x + (edge.end.x - edge.start.x) * t,
      y: edge.start.y + (edge.end.y - edge.start.y) * t,
    });
  }

  return samples;
}

function resampleLoops(loops, sampleCount) {
  if (!sampleCount || sampleCount <= 3) {
    return loops;
  }
  return loops.map((loop) => resampleClosedLoop(loop, sampleCount));
}

function getSvgLoops(text, sampleCount) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "image/svg+xml");
  const svgRoot = document.getElementById("svgMeasureRoot");
  svgRoot.innerHTML = "";

  const loops = [];
  const candidates = doc.querySelectorAll("path, polygon, polyline, rect, circle, ellipse");

  candidates.forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (tag === "path") {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", element.getAttribute("d") || "");
      svgRoot.append(path);
      const sampled = maybeClosedLoop(sampleSvgPath(path, sampleCount), isClosedSvgPath(path));
      if (sampled) {
        loops.push(sampled);
      }
      path.remove();
      return;
    }

    if (tag === "polygon" || tag === "polyline") {
      const points = parsePointsAttribute(element.getAttribute("points") || "");
      const closed = maybeClosedLoop(points, tag === "polygon");
      if (closed) {
        loops.push(closed);
      }
      return;
    }

    if (tag === "rect") {
      const x = Number(element.getAttribute("x") || "0");
      const y = Number(element.getAttribute("y") || "0");
      const width = Number(element.getAttribute("width") || "0");
      const height = Number(element.getAttribute("height") || "0");
      loops.push([
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ]);
      return;
    }

    if (tag === "circle") {
      const cx = Number(element.getAttribute("cx") || "0");
      const cy = Number(element.getAttribute("cy") || "0");
      const r = Number(element.getAttribute("r") || "0");
      loops.push(sampleCircle(cx, cy, r, r, sampleCount));
      return;
    }

    if (tag === "ellipse") {
      const cx = Number(element.getAttribute("cx") || "0");
      const cy = Number(element.getAttribute("cy") || "0");
      const rx = Number(element.getAttribute("rx") || "0");
      const ry = Number(element.getAttribute("ry") || "0");
      loops.push(sampleCircle(cx, cy, rx, ry, sampleCount));
    }
  });

  return {
    loops: normalizeLoops(resampleLoops(loops, sampleCount)),
    importKind: "vector",
    sourceBounds: getRawBounds(loops),
    sourceUnits: null,
  };
}

function parseDxfPairs(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const pairs = [];
  for (let index = 0; index < lines.length - 1; index += 2) {
    pairs.push({
      code: lines[index].trim(),
      value: lines[index + 1].trim(),
    });
  }
  return pairs;
}

function collectEntityPairs(pairs, startIndex) {
  const entityPairs = [];
  let index = startIndex + 1;
  while (index < pairs.length && pairs[index].code !== "0") {
    entityPairs.push(pairs[index]);
    index += 1;
  }
  return { entityPairs, nextIndex: index };
}

function getFirstValue(entityPairs, code, fallback = "") {
  const pair = entityPairs.find((entry) => entry.code === code);
  return pair ? pair.value : fallback;
}

function getAllValues(entityPairs, code) {
  return entityPairs
    .filter((entry) => entry.code === code)
    .map((entry) => entry.value);
}

function buildDxfEllipse(entityPairs, sampleCount = 96) {
  const cx = numberValue(getFirstValue(entityPairs, "10"));
  const cy = numberValue(getFirstValue(entityPairs, "20"));
  const majorX = numberValue(getFirstValue(entityPairs, "11"));
  const majorY = numberValue(getFirstValue(entityPairs, "21"));
  const ratio = numberValue(getFirstValue(entityPairs, "40"), 1);
  const start = numberValue(getFirstValue(entityPairs, "41"), 0);
  const end = numberValue(getFirstValue(entityPairs, "42"), Math.PI * 2);

  const majorLength = Math.hypot(majorX, majorY);
  if (majorLength <= CLOSE_DISTANCE_EPSILON) {
    return null;
  }

  const ux = majorX / majorLength;
  const uy = majorY / majorLength;
  const vx = -uy;
  const vy = ux;
  const minorLength = majorLength * ratio;
  const points = [];

  for (let step = 0; step < sampleCount; step += 1) {
    const t = start + ((end - start) * step) / sampleCount;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    points.push({
      x: cx + ux * majorLength * cos + vx * minorLength * sin,
      y: cy + uy * majorLength * cos + vy * minorLength * sin,
    });
  }

  return maybeClosedLoop(points, Math.abs(end - start) >= Math.PI * 1.99);
}

function buildDxfSpline(entityPairs) {
  const xs = getAllValues(entityPairs, "10").map((value) => numberValue(value));
  const ys = getAllValues(entityPairs, "20").map((value) => numberValue(value));
  const flags = numberValue(getFirstValue(entityPairs, "70"), 0);
  const explicitClosed = (flags & 1) === 1;
  const count = Math.min(xs.length, ys.length);
  const points = [];

  for (let index = 0; index < count; index += 1) {
    points.push({ x: xs[index], y: ys[index] });
  }

  return maybeClosedLoop(points, explicitClosed);
}

function getDxfLoops(text, sampleCount) {
  const pairs = parseDxfPairs(text);
  const loops = [];
  let index = 0;

  while (index < pairs.length) {
    const pair = pairs[index];
    if (pair.code === "0" && pair.value === "LWPOLYLINE") {
      const points = [];
      let closed = false;
      index += 1;

      while (index < pairs.length && !(pairs[index].code === "0" && pairs[index].value !== "VERTEX")) {
        if (pairs[index].code === "70") {
          closed = (Number(pairs[index].value) & 1) === 1;
        }
        if (pairs[index].code === "10") {
          const x = Number(pairs[index].value);
          const yPair = pairs[index + 1];
          points.push({ x, y: Number(yPair?.value || "0") });
        }
        index += 1;
      }

      const closedLoop = maybeClosedLoop(points, closed);
      if (closedLoop) {
        loops.push(closedLoop);
      }
      continue;
    }

    if (pair.code === "0" && pair.value === "POLYLINE") {
      const points = [];
      let closed = false;
      index += 1;

      while (index < pairs.length && !(pairs[index].code === "0" && pairs[index].value === "SEQEND")) {
        if (pairs[index].code === "70") {
          closed = (Number(pairs[index].value) & 1) === 1;
        }
        if (pairs[index].code === "0" && pairs[index].value === "VERTEX") {
          let x = 0;
          let y = 0;
          index += 1;
          while (index < pairs.length && pairs[index].code !== "0") {
            if (pairs[index].code === "10") {
              x = Number(pairs[index].value);
            }
            if (pairs[index].code === "20") {
              y = Number(pairs[index].value);
            }
            index += 1;
          }
          points.push({ x, y });
          continue;
        }
        index += 1;
      }

      const closedLoop = maybeClosedLoop(points, closed);
      if (closedLoop) {
        loops.push(closedLoop);
      }
      index += 1;
      continue;
    }

    if (pair.code === "0" && pair.value === "CIRCLE") {
      const { entityPairs, nextIndex } = collectEntityPairs(pairs, index);
      const cx = numberValue(getFirstValue(entityPairs, "10"));
      const cy = numberValue(getFirstValue(entityPairs, "20"));
      const radius = numberValue(getFirstValue(entityPairs, "40"));
      if (radius > CLOSE_DISTANCE_EPSILON) {
        loops.push(sampleCircle(cx, cy, radius, radius, 96));
      }
      index = nextIndex;
      continue;
    }

    if (pair.code === "0" && pair.value === "ELLIPSE") {
      const { entityPairs, nextIndex } = collectEntityPairs(pairs, index);
      const ellipse = buildDxfEllipse(entityPairs);
      if (ellipse) {
        loops.push(ellipse);
      }
      index = nextIndex;
      continue;
    }

    if (pair.code === "0" && pair.value === "SPLINE") {
      const { entityPairs, nextIndex } = collectEntityPairs(pairs, index);
      const spline = buildDxfSpline(entityPairs);
      if (spline) {
        loops.push(spline);
      }
      index = nextIndex;
      continue;
    }

    index += 1;
  }

  return {
    loops: normalizeLoops(resampleLoops(loops, sampleCount)),
    importKind: "vector",
    sourceBounds: getRawBounds(loops),
    sourceUnits: null,
  };
}

function buildMask(imageData, threshold, invert) {
  const { data, width, height } = imageData;
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3];
    const luminance = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
    const solid = alpha > 24 && (invert ? luminance > threshold : luminance < threshold);
    mask[index] = solid ? 1 : 0;
  }
  return { mask, width, height };
}

function floodLargestComponent(binary) {
  const { mask, width, height } = binary;
  const visited = new Uint8Array(mask.length);
  let best = [];

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) {
      continue;
    }

    const queue = [start];
    const component = [];
    visited[start] = 1;

    while (queue.length) {
      const current = queue.pop();
      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];

      neighbors.forEach(([nx, ny]) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          return;
        }
        const next = ny * width + nx;
        if (mask[next] && !visited[next]) {
          visited[next] = 1;
          queue.push(next);
        }
      });
    }

    if (component.length > best.length) {
      best = component;
    }
  }

  const filtered = new Uint8Array(mask.length);
  best.forEach((index) => {
    filtered[index] = 1;
  });
  return { mask: filtered, width, height };
}

function marchingSquares(binary) {
  const { mask, width, height } = binary;
  const segments = [];
  const lookup = {
    1: [[[0, 0.5], [0.5, 1]]],
    2: [[[0.5, 1], [1, 0.5]]],
    3: [[[0, 0.5], [1, 0.5]]],
    4: [[[1, 0.5], [0.5, 0]]],
    5: [
      [[0, 0.5], [0.5, 0]],
      [[0.5, 1], [1, 0.5]],
    ],
    6: [[[0.5, 1], [0.5, 0]]],
    7: [[[0, 0.5], [0.5, 0]]],
    8: [[[0.5, 0], [0, 0.5]]],
    9: [[[0.5, 1], [0.5, 0]]],
    10: [
      [[0.5, 0], [1, 0.5]],
      [[0, 0.5], [0.5, 1]],
    ],
    11: [[[1, 0.5], [0.5, 0]]],
    12: [[[1, 0.5], [0, 0.5]]],
    13: [[[0.5, 1], [1, 0.5]]],
    14: [[[0, 0.5], [0.5, 1]]],
  };

  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const tl = mask[y * width + x];
      const tr = mask[y * width + x + 1];
      const br = mask[(y + 1) * width + x + 1];
      const bl = mask[(y + 1) * width + x];
      const key = tl * 8 + tr * 4 + br * 2 + bl;
      const cellSegments = lookup[key];
      if (!cellSegments) {
        continue;
      }

      cellSegments.forEach((segment) => {
        segments.push(
          segment.map(([sx, sy]) => ({
            x: x + sx,
            y: y + sy,
          })),
        );
      });
    }
  }

  return segments;
}

function chainSegments(segments) {
  const keyFor = (point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
  const adjacency = new Map();

  segments.forEach(([start, end]) => {
    const startKey = keyFor(start);
    const endKey = keyFor(end);
    if (!adjacency.has(startKey)) {
      adjacency.set(startKey, []);
    }
    if (!adjacency.has(endKey)) {
      adjacency.set(endKey, []);
    }
    adjacency.get(startKey).push(end);
    adjacency.get(endKey).push(start);
  });

  const visitedEdges = new Set();
  const loops = [];

  segments.forEach(([start, end]) => {
    const edgeKey = `${keyFor(start)}>${keyFor(end)}`;
    const reverseKey = `${keyFor(end)}>${keyFor(start)}`;
    if (visitedEdges.has(edgeKey) || visitedEdges.has(reverseKey)) {
      return;
    }

    const loop = [start];
    let current = end;
    let previous = start;
    visitedEdges.add(edgeKey);

    while (current) {
      loop.push(current);
      const currentKey = keyFor(current);
      const options = adjacency.get(currentKey) || [];
      const next = options.find((candidate) => keyFor(candidate) !== keyFor(previous));
      if (!next || keyFor(next) === keyFor(loop[0])) {
        break;
      }
      visitedEdges.add(`${currentKey}>${keyFor(next)}`);
      previous = current;
      current = next;
    }

    if (loop.length >= 8) {
      loops.push(loop);
    }
  });

  return loops;
}

async function getImageLoops(file, settings) {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const longestSide = 256;
  const scale = longestSide / Math.max(image.width, image.height);
  canvas.width = Math.max(32, Math.round(image.width * scale));
  canvas.height = Math.max(32, Math.round(image.height * scale));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const binary = buildMask(
    context.getImageData(0, 0, canvas.width, canvas.height),
    settings.imageThreshold,
    settings.invertImage,
  );
  const regionLimit = Math.max(0, Number(settings.imageTargetRegions) || 0);
  const rawLoops = chainSegments(marchingSquares(binary))
    .map((loop) =>
      loop.map((point) => ({
        x: point.x,
        y: canvas.height - point.y,
      })),
    )
    .filter((loop) => Math.abs(polygonArea(loop)) >= Math.max(canvas.width * canvas.height * 0.0012, 12))
    .sort((left, right) => Math.abs(polygonArea(right)) - Math.abs(polygonArea(left)));
  const limitedLoops = regionLimit > 0 ? rawLoops.slice(0, regionLimit) : rawLoops;
  const normalizedLoops = normalizeLoops(limitedLoops);
  const traceCandidates = normalizedLoops.map((loop, index) => ({
    id: `trace-${index + 1}`,
    label: `Region ${index + 1}`,
    area: Math.abs(polygonArea(loop)),
    points: loop,
  }));

  return {
    loops: normalizedLoops,
    traceCandidates,
    importKind: "image",
    sourceBounds: getRawBounds(limitedLoops),
    sourceUnits: "px",
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve(image);
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      reject(new Error("Unable to load image."));
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

export async function importProfile(file, settings) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "svg") {
    const result = getSvgLoops(await file.text(), settings.curveSamples);
    return { ...result, sourceUnits: settings.units };
  }
  if (extension === "dxf") {
    const result = getDxfLoops(await file.text(), settings.curveSamples);
    return { ...result, sourceUnits: settings.units };
  }
  return getImageLoops(file, settings);
}
