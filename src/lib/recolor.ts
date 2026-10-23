/** Finding and replacing the colors in SVG markup. Colors are compared as
 * "#rrggbb"; a color's alpha is kept when it's replaced. */

const COLOR_ATTRIBUTES = ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'color'];

/** A color declaration inside a style attribute or a <style> element. The
 * leading group stops "background-color" matching as "color". */
const DECLARATION = /(^|[;{\s])(fill|stroke|stop-color|flood-color|lighting-color|color)(\s*:\s*)([^;}!]+)/gi;

/** Elements that are filled black when nothing sets their fill. */
const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'text']);

const BLACK = '#000000';

type Color = {hex: string; alpha: number};

let parseCtx: CanvasRenderingContext2D | null = null;

/** Any CSS color → hex plus alpha; "none", "currentColor", "url(#…)",
 * fully transparent colors and junk → null. */
function parseColor(value: string): Color | null {
  const v = value.trim();
  if (!v || /^(none|currentcolor|inherit|initial|unset|transparent)$/i.test(v) || v.startsWith('url(')) return null;
  if (!CSS.supports('color', v)) return null;
  parseCtx ??= document.createElement('canvas').getContext('2d');
  if (!parseCtx) return null;
  parseCtx.fillStyle = '#000';
  parseCtx.fillStyle = v;
  const out = parseCtx.fillStyle;
  if (out.startsWith('#')) return {hex: out.toLowerCase(), alpha: 1};
  const m = out.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : Number(m[4]);
  if (alpha === 0) return null;
  const hex = `#${[m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('')}`;
  return {hex, alpha};
}

function formatColor(hex: string, alpha: number) {
  if (alpha >= 1) return hex;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Calls `visit` with every color value in the document; whatever it returns
 * replaces that value. */
function eachColor(doc: Document, visit: (value: string) => string) {
  const inDeclarations = (css: string) =>
    css.replace(DECLARATION, (_, lead, prop, sep, value: string) => {
      const trimmed = value.trimEnd();
      return `${lead}${prop}${sep}${visit(trimmed)}${value.slice(trimmed.length)}`;
    });

  for (const el of doc.querySelectorAll('*')) {
    for (const attr of COLOR_ATTRIBUTES) {
      const value = el.getAttribute(attr);
      if (value !== null) el.setAttribute(attr, visit(value));
    }
    const style = el.getAttribute('style');
    if (style) el.setAttribute('style', inDeclarations(style));
    if (el.localName === 'style' && el.textContent) el.textContent = inDeclarations(el.textContent);
  }
}

/** Whether `el` or an ancestor sets `property`, as an attribute or inline style. */
function inherits(el: Element, property: string) {
  const declared = new RegExp(`(^|[;\\s])${property}\\s*:`, 'i');
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (node.hasAttribute(property) || declared.test(node.getAttribute('style') ?? '')) return true;
  }
  return false;
}

/** Whether something is drawn black because nothing gave it a color: a shape
 * with no fill, or currentColor with no color set. */
function usesImplicitBlack(doc: Document) {
  const stylesheetSetsFill = [...doc.querySelectorAll('style')].some(s =>
    /(^|[;{\s])fill\s*:/i.test(s.textContent ?? ''),
  );
  for (const el of doc.querySelectorAll('*')) {
    // Clip paths ignore color; masks use it for opacity, not as a visible color.
    if (el.closest('clipPath, mask')) continue;
    if (SHAPES.has(el.localName) && !inherits(el, 'fill') && !(stylesheetSetsFill && el.hasAttribute('class'))) {
      return true;
    }
    const usesCurrentColor =
      COLOR_ATTRIBUTES.some(a => a !== 'color' && /^\s*currentcolor\s*$/i.test(el.getAttribute(a) ?? '')) ||
      /currentcolor/i.test(el.getAttribute('style') ?? '');
    if (usesCurrentColor && !inherits(el, 'color')) return true;
  }
  return false;
}

function parse(markup: string) {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') {
    throw new Error('Not a valid SVG file');
  }
  return doc;
}

/** The distinct colors the SVG uses, as "#rrggbb", in order of appearance. */
export function extractColors(markup: string): string[] {
  const doc = parse(markup);
  const colors = new Set<string>();
  eachColor(doc, value => {
    const color = parseColor(value);
    if (color) colors.add(color.hex);
    return value;
  });
  if (usesImplicitBlack(doc)) colors.add(BLACK);
  return [...colors];
}

/** The markup with each color in `map` (keys and values "#rrggbb") replaced. */
export function recolorSvg(markup: string, map: Record<string, string>): string {
  const doc = parse(markup);
  eachColor(doc, value => {
    const color = parseColor(value);
    const next = color && map[color.hex];
    return next ? formatColor(next, color.alpha) : value;
  });
  // Implicit black comes from the root's defaults, so give the root the new
  // color where it doesn't already set one.
  const newBlack = map[BLACK];
  if (newBlack && newBlack !== BLACK) {
    const root = doc.documentElement;
    for (const attr of ['fill', 'color']) {
      if (!inherits(root, attr)) root.setAttribute(attr, newBlack);
    }
  }
  return new XMLSerializer().serializeToString(doc);
}
