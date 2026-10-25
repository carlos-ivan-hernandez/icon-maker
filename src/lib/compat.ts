import {viewBoxOf} from './trim';

/** Making a downloaded SVG show up the same in every program, not just
 * browsers. Simpler renderers (image viewers, ImageMagick, some design and
 * office apps) draw `currentColor` as nothing, and may show an SVG with only
 * a viewBox as blank or zero-sized. */

const COLOR_ATTRIBUTES = ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color'];
const CURRENT_COLOR = /currentcolor/gi;
/** For checking; a global regex's test() remembers where it stopped. */
const HAS_CURRENT_COLOR = /currentcolor/i;
const COLOR_DECLARATION = /(?:^|;)\s*color\s*:\s*([^;!]+)/i;
/** What browsers use when nothing sets `color`. */
const DEFAULT_COLOR = '#000000';

/** The `color` that `currentColor` means on `el`: the nearest one set on it or
 * an ancestor, as an attribute or inline style. */
function colorOf(el: Element): string {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const value = (node.getAttribute('style') ?? '').match(COLOR_DECLARATION)?.[1] ?? node.getAttribute('color');
    const v = value?.trim();
    if (v && !/^(currentcolor|inherit|initial|unset)$/i.test(v)) return v;
  }
  return DEFAULT_COLOR;
}

/** Whether a browser would pick `el` in a <switch>: it needs no extensions
 * and, if it names languages, one matches the browser's. */
function passesConditions(el: Element) {
  if (el.getAttribute('requiredExtensions')?.trim()) return false;
  const languages = el.getAttribute('systemLanguage');
  if (languages === null) return true;
  const mine = navigator.language.toLowerCase().split('-')[0];
  return languages.split(',').some(l => l.trim().toLowerCase().split('-')[0] === mine);
}

/** Replaces each <switch> with the one child a browser draws. Illustrator
 * (and so Noun Project icons) wraps the artwork in a <switch> whose first
 * child is an empty Illustrator-only placeholder; renderers that don't
 * evaluate <switch> the same way draw the placeholder, i.e. nothing. */
function unwrapSwitches(doc: Document) {
  for (const sw of doc.querySelectorAll('switch')) {
    const chosen = [...sw.children].find(passesConditions);
    if (chosen) sw.replaceWith(chosen);
    else sw.remove();
  }
}

/** The markup with `currentColor` swapped for the color it stands for,
 * <switch> elements resolved, and width/height set from the viewBox when the
 * root has none. */
export function forExport(markup: string): string {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const svg = doc.documentElement;
  if (doc.querySelector('parsererror') || svg.localName !== 'svg') return markup;

  unwrapSwitches(doc);

  for (const el of doc.querySelectorAll('*')) {
    for (const attr of COLOR_ATTRIBUTES) {
      const value = el.getAttribute(attr);
      if (value && HAS_CURRENT_COLOR.test(value)) el.setAttribute(attr, value.replace(CURRENT_COLOR, colorOf(el)));
    }
    const style = el.getAttribute('style');
    if (style && HAS_CURRENT_COLOR.test(style)) el.setAttribute('style', style.replace(CURRENT_COLOR, colorOf(el)));
    // A stylesheet's rules can match any element, so use the root's color.
    if (el.localName === 'style' && el.textContent && HAS_CURRENT_COLOR.test(el.textContent)) {
      el.textContent = el.textContent.replace(CURRENT_COLOR, colorOf(svg));
    }
  }

  if (!svg.hasAttribute('width') && !svg.hasAttribute('height')) {
    const [, , w, h] = viewBoxOf(svg);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
  }
  return new XMLSerializer().serializeToString(doc);
}
