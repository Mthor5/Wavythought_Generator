import { getLoopBounds } from "./geometry.js";

export const speciesPresets = {
  walnut: { base: "#6b4a33", light: "#8b6445", dark: "#4a3221" },
  oak: { base: "#b4956f", light: "#ceb18b", dark: "#8f734f" },
  ash: { base: "#d6c8b1", light: "#efe4d1", dark: "#b9aa92" },
  maple: { base: "#e1cfad", light: "#f4e5c9", dark: "#bba37b" },
  cherry: { base: "#a85f44", light: "#c98568", dark: "#7d3f29" },
  padauk: { base: "#b54c2f", light: "#d46b4a", dark: "#873420" },
  purpleheart: { base: "#6e4a7d", light: "#8a65a0", dark: "#483055" },
  redoak: { base: "#b77e59", light: "#cea183", dark: "#87583d" },
};

function mixColor(hexA, hexB, factor) {
  const parse = (hex) => [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];

  const [ar, ag, ab] = parse(hexA);
  const [br, bg, bb] = parse(hexB);
  const blend = (start, end) => Math.round(start + (end - start) * factor);
  return `rgb(${blend(ar, br)}, ${blend(ag, bg)}, ${blend(ab, bb)})`;
}

function toCanvasPoint(point, bounds, width, height) {
  return {
    x: ((point.x - bounds.minX) / bounds.width) * width,
    y: height - ((point.y - bounds.minY) / bounds.height) * height,
  };
}

function drawProfilePath(context, points, bounds, width, height) {
  context.beginPath();
  points.forEach((point, index) => {
    const canvasPoint = toCanvasPoint(point, bounds, width, height);
    if (index === 0) {
      context.moveTo(canvasPoint.x, canvasPoint.y);
    } else {
      context.lineTo(canvasPoint.x, canvasPoint.y);
    }
  });
  context.closePath();
}

function drawWood(ctx, width, height, palette, scale, seed = 0) {
  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, width, height);

  const stripeCount = Math.round(width * 0.35 * scale);
  for (let index = 0; index < stripeCount; index += 1) {
    const x = (index / stripeCount) * width;
    const pattern = Math.sin(index * 0.65 + seed * 0.7) * 0.5 + 0.5;
    const ribbon = Math.sin(index * 0.15 + seed * 1.4) * 0.5 + 0.5;
    ctx.fillStyle = mixColor(palette.dark, palette.light, pattern * 0.72);
    const stripeWidth = 1 + ribbon * 4 * scale;
    ctx.fillRect(x, 0, stripeWidth, height);
  }

  ctx.globalAlpha = 0.18;
  for (let band = 0; band < 18; band += 1) {
    const y = (band / 18) * height;
    ctx.strokeStyle = mixColor(palette.light, "#ffffff", 0.35);
    ctx.lineWidth = 2 + (band % 3);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= width; x += 36) {
      const offset = Math.sin((x + band * 23) * 0.025 + seed) * 6 * scale;
      ctx.lineTo(x, y + offset);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawSpeciesBase(ctx, width, height, palette) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, mixColor(palette.base, palette.light, 0.18));
  gradient.addColorStop(1, mixColor(palette.base, palette.dark, 0.12));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawMatte(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#b9b9b5");
  gradient.addColorStop(1, "#8f8f8b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function createMaterialMaps(state) {
  const size = 1024;
  const colorCanvas = document.createElement("canvas");
  const alphaCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  alphaCanvas.width = size;
  alphaCanvas.height = size;
  const colorContext = colorCanvas.getContext("2d");
  const alphaContext = alphaCanvas.getContext("2d");
  const additiveLoops = state.loops.filter((loop) => loop.role === "outer" || loop.surfaceMode === "add");
  const subtractiveLoops = state.loops.filter((loop) => loop.surfaceMode === "subtract");
  const seamLoops = state.loops.filter((loop) => loop.role === "inner");
  const bounds = getLoopBounds(state.loops);

  alphaContext.clearRect(0, 0, size, size);
  alphaContext.fillStyle = "#ffffff";
  additiveLoops.forEach((loop) => {
    drawProfilePath(alphaContext, loop.points, bounds, size, size);
    alphaContext.fill();
  });
  subtractiveLoops.forEach((loop) => {
    alphaContext.save();
    alphaContext.globalCompositeOperation = "destination-out";
    drawProfilePath(alphaContext, loop.points, bounds, size, size);
    alphaContext.fill();
    alphaContext.restore();
  });

  colorContext.clearRect(0, 0, size, size);
  const basePalette = speciesPresets[state.surface.species] || speciesPresets.walnut;
  if (state.surface.woodEnabled) {
    drawSpeciesBase(colorContext, size, size, basePalette);
  } else {
    drawMatte(colorContext, size, size);
  }

  seamLoops.forEach((loop, index) => {
    colorContext.save();
    drawProfilePath(colorContext, loop.points, bounds, size, size);
    colorContext.clip();
    if (state.surface.woodEnabled) {
      const palette = speciesPresets[loop.species] || basePalette;
      drawSpeciesBase(colorContext, size, size, palette);
    } else {
      colorContext.fillStyle = mixColor("#9a9994", "#d3ccc4", (index % 5) * 0.12 + 0.14);
      colorContext.fillRect(0, 0, size, size);
    }
    colorContext.restore();
  });

  seamLoops.forEach((loop) => {
    drawProfilePath(colorContext, loop.points, bounds, size, size);
    colorContext.strokeStyle = "rgba(52, 35, 22, 0.65)";
    colorContext.lineWidth = 3;
    colorContext.stroke();
  });

  return { colorCanvas, alphaCanvas };
}
