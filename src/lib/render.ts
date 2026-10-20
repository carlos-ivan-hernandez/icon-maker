import {type LoadedSvg} from './svg';

/** All layout values are in this space, whatever size the PNG is exported at. */
export const LAYOUT_SIZE = 512;

export const EXPORT_SIZES = [1024, 512] as const;
export type ExportSize = (typeof EXPORT_SIZES)[number];

export type Layout = {
  /** Longest side of the SVG as a fraction of the icon's edge. */
  zoom: number;
  /** Offset of the SVG's center from the icon's center, in LAYOUT_SIZE px. */
  x: number;
  y: number;
};

export const DEFAULT_LAYOUT: Layout = {zoom: 0.7, x: 0, y: 0};

/** Box the SVG occupies within the LAYOUT_SIZE square. */
export function iconBox(svg: LoadedSvg, layout: Layout) {
  const longest = layout.zoom * LAYOUT_SIZE;
  const width = svg.aspect >= 1 ? longest : longest * svg.aspect;
  const height = svg.aspect >= 1 ? longest / svg.aspect : longest;
  return {
    left: LAYOUT_SIZE / 2 + layout.x - width / 2,
    top: LAYOUT_SIZE / 2 + layout.y - height / 2,
    width,
    height,
  };
}

/**
 * Draws the icon into a `size`×`size` area of `ctx`. The preview, the small
 * size previews and the export all go through this, so what you see is
 * exactly what gets saved.
 *
 * `color` paints the whole SVG in that one color, keeping its shape and
 * anti-aliasing; null draws the SVG's own colors.
 */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  size: number,
  svg: LoadedSvg | null,
  background: string,
  color: string | null,
  layout: Layout,
) {
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);
  if (svg) {
    const scale = size / LAYOUT_SIZE;
    const box = iconBox(svg, layout);
    const left = box.left * scale;
    const top = box.top * scale;
    const width = box.width * scale;
    const height = box.height * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (color) {
      const tinted = tint(svg, color, width, height);
      if (tinted) ctx.drawImage(tinted, left, top, width, height);
    } else {
      ctx.drawImage(svg.image, left, top, width, height);
    }
  }
  ctx.restore();
}

/** The SVG drawn at `width`×`height` px, every visible pixel filled with
 * `color` at its original opacity. */
function tint(svg: LoadedSvg, color: string, width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(svg.image, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Renders the final `size`×`size` PNG. */
export function exportPng(
  svg: LoadedSvg,
  background: string,
  color: string | null,
  layout: Layout,
  size: ExportSize,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  drawIcon(ctx, size, svg, background, color, layout);
  return new Promise((resolve, reject) =>
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png'),
  );
}
