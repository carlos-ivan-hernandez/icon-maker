/** A parsed SVG, decoded into an image that can be drawn onto a canvas. */
export type LoadedSvg = {
  name: string;
  image: HTMLImageElement;
  /** Intrinsic aspect ratio, width / height. */
  aspect: number;
};

/** Longest side the SVG is given before decoding; canvases redraw SVGs as
 * vectors, so this only matters as a quality floor on engines that don't. */
const DECODE_SIZE = 2048;

/**
 * Parses SVG markup and decodes it as an image. The root element's
 * width/height are rewritten from its viewBox so every SVG has a definite
 * intrinsic size — without that, icons that only declare a viewBox (most of
 * them) decode as 0×0 or 300×150 in some WebViews.
 */
export async function loadSvg(name: string, markup: string): Promise<LoadedSvg> {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const svg = doc.documentElement;
  if (doc.querySelector('parsererror') || svg.localName !== 'svg') {
    throw new Error('Not a valid SVG file');
  }

  const [w, h] = intrinsicSize(svg);
  if (!svg.hasAttribute('viewBox')) {
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  const scale = DECODE_SIZE / Math.max(w, h);
  svg.setAttribute('width', String(w * scale));
  svg.setAttribute('height', String(h * scale));

  const xml = new XMLSerializer().serializeToString(svg);
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  try {
    await image.decode();
  } catch {
    throw new Error('The SVG could not be rendered');
  }
  return {name, image, aspect: w / h};
}

/** Width and height from the viewBox, else from absolute width/height
 * attributes, else a square. */
function intrinsicSize(svg: Element): [number, number] {
  const viewBox = svg
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (viewBox?.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
    return [viewBox[2], viewBox[3]];
  }
  const w = absoluteLength(svg.getAttribute('width'));
  const h = absoluteLength(svg.getAttribute('height'));
  if (w && h) return [w, h];
  return [512, 512];
}

/** Parses "24" or "24px"; percentages and other units return null. */
function absoluteLength(value: string | null): number | null {
  const match = value?.trim().match(/^([\d.]+)(px)?$/);
  const n = match ? Number(match[1]) : NaN;
  return n > 0 ? n : null;
}
