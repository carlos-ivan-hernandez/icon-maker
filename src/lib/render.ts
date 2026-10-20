import {type LoadedSvg} from './svg';

/** Edge length of the exported PNG; all layout values are in this space. */
export const ICON_SIZE = 512;

export type Layout = {
  /** Longest side of the SVG as a fraction of the icon's edge. */
  zoom: number;
  /** Offset of the SVG's center from the icon's center, in ICON_SIZE px. */
  x: number;
  y: number;
};

export const DEFAULT_LAYOUT: Layout = {zoom: 0.7, x: 0, y: 0};

/** Box the SVG occupies within the ICON_SIZE square. */
export function iconBox(svg: LoadedSvg, layout: Layout) {
  const longest = layout.zoom * ICON_SIZE;
  const width = svg.aspect >= 1 ? longest : longest * svg.aspect;
  const height = svg.aspect >= 1 ? longest / svg.aspect : longest;
  return {
    left: ICON_SIZE / 2 + layout.x - width / 2,
    top: ICON_SIZE / 2 + layout.y - height / 2,
    width,
    height,
  };
}

/**
 * Draws the icon into a `size`×`size` area of `ctx`. The preview, the small
 * size previews and the export all go through this, so what you see is
 * exactly what gets saved.
 */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  size: number,
  svg: LoadedSvg | null,
  background: string,
  layout: Layout,
) {
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);
  if (svg) {
    const scale = size / ICON_SIZE;
    const box = iconBox(svg, layout);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(svg.image, box.left * scale, box.top * scale, box.width * scale, box.height * scale);
  }
  ctx.restore();
}

/** Renders the final ICON_SIZE×ICON_SIZE PNG. */
export function exportPng(svg: LoadedSvg, background: string, layout: Layout): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  drawIcon(ctx, ICON_SIZE, svg, background, layout);
  return new Promise((resolve, reject) =>
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png'),
  );
}
