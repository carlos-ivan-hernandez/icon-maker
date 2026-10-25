import {intrinsicSize} from './svg';

/** Longest side the SVG is drawn at to find where its content is. */
const SAMPLE_SIZE = 2048;

type ViewBox = [x: number, y: number, width: number, height: number];

function parse(markup: string) {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') {
    throw new Error('Not a valid SVG file');
  }
  return doc;
}

export function viewBoxOf(svg: Element): ViewBox {
  const vb = svg
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (vb?.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) return [vb[0], vb[1], vb[2], vb[3]];
  const [w, h] = intrinsicSize(svg);
  return [0, 0, w, h];
}

/** The pixel bounds of everything not fully transparent, or null if nothing is. */
async function contentBounds(svg: Element, width: number, height: number) {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(image, 0, 0, width, height);
  const {data} = ctx.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : {minX, minY, maxX, maxY};
}

/** The roundest number in [from, to): a whole number if there is one, else
 * the fewest decimals (up to 3). */
function roundest(from: number, to: number) {
  for (let d = 0; d <= 3; d++) {
    const f = 10 ** d;
    const v = Math.ceil(from * f) / f;
    if (v < to) return v;
  }
  return from;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The SVG with its viewBox shrunk to just contain what's drawn, so there's
 * no empty space around it. Absolute width/height attributes shrink by the
 * same amount. It finds the content by drawing the SVG, so strokes, filters
 * and clipping all count. Returns
 * null when nothing is drawn.
 */
export async function trimSvg(markup: string): Promise<{markup: string; viewBox: ViewBox} | null> {
  const doc = parse(markup);
  const svg = doc.documentElement;
  const [x, y, w, h] = viewBoxOf(svg);
  const scale = SAMPLE_SIZE / Math.max(w, h);
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));

  const sample = parse(markup).documentElement;
  sample.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  sample.setAttribute('width', String(width));
  sample.setAttribute('height', String(height));
  sample.setAttribute('preserveAspectRatio', 'none');
  const bounds = await contentBounds(sample, width, height);
  if (!bounds) return null;

  // Each edge of the drawing lies somewhere inside its outermost drawn
  // pixel, so pick the roundest value there: a shape edge at x=20 gives 20,
  // not 19.97. That's off by less than a pixel at SAMPLE_SIZE.
  const px = w / width;
  const py = h / height;
  const left = roundest(x + bounds.minX * px, x + (bounds.minX + 1) * px);
  const top = roundest(y + bounds.minY * py, y + (bounds.minY + 1) * py);
  const right = -roundest(-(x + (bounds.maxX + 1) * px), -(x + bounds.maxX * px));
  const bottom = -roundest(-(y + (bounds.maxY + 1) * py), -(y + bounds.maxY * py));
  const viewBox: ViewBox = [round(left), round(top), round(right - left), round(bottom - top)];

  svg.setAttribute('viewBox', viewBox.join(' '));
  // Shrink width/height given in px (or no unit) to match; leave % and others alone.
  const size = ['width', 'height'].map(a =>
    svg
      .getAttribute(a)
      ?.trim()
      .match(/^([\d.]+)(px)?$/),
  );
  if (size[0] && size[1]) {
    svg.setAttribute('width', `${round((Number(size[0][1]) * viewBox[2]) / w)}${size[0][2] ?? ''}`);
    svg.setAttribute('height', `${round((Number(size[1][1]) * viewBox[3]) / h)}${size[1][2] ?? ''}`);
  }
  return {markup: new XMLSerializer().serializeToString(doc), viewBox};
}
