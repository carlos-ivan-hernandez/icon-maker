/** Deleting parts of an SVG. Every element is tagged with its position in the
 * original file, so a deletion keeps pointing at the same element whatever
 * else is edited. */

export const INDEX_ATTR = 'data-icon-maker-index';

function parse(markup: string) {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') {
    throw new Error('Not a valid SVG file');
  }
  return doc;
}

const serialize = (doc: Document) => new XMLSerializer().serializeToString(doc);

/** The element's index, or null for the root <svg> and untagged elements. */
export function elementIndex(el: Element): number | null {
  const value = el.getAttribute(INDEX_ATTR);
  return value === null || el === el.ownerDocument.documentElement || value === '0' ? null : Number(value);
}

/** Gives every element its index in document order (the root <svg> is 0). */
export function tagElements(markup: string): string {
  const doc = parse(markup);
  doc.querySelectorAll('*').forEach((el, i) => el.setAttribute(INDEX_ATTR, String(i)));
  return serialize(doc);
}

/** The markup without the elements at `indices` (and everything inside them). */
export function removeElements(markup: string, indices: ReadonlySet<number>): string {
  if (!indices.size) return markup;
  const doc = parse(markup);
  for (const el of doc.querySelectorAll(`[${INDEX_ATTR}]`)) {
    const i = elementIndex(el);
    if (i !== null && indices.has(i)) el.remove();
  }
  return serialize(doc);
}

/** The markup with the index tags taken out again. */
export function untag(markup: string): string {
  const doc = parse(markup);
  for (const el of doc.querySelectorAll(`[${INDEX_ATTR}]`)) el.removeAttribute(INDEX_ATTR);
  return serialize(doc);
}

/** Each element's parent group instead of the element itself. Elements
 * directly inside the root <svg> stay as they are. */
export function parentsOf(markup: string, indices: number[]): number[] {
  const doc = parse(markup);
  const out = new Set<number>();
  for (const i of indices) {
    const parent = doc.querySelector(`[${INDEX_ATTR}="${i}"]`)?.parentElement;
    out.add((parent && elementIndex(parent)) ?? i);
  }
  return [...out];
}

/** Tag names of the elements at `indices`, e.g. ["path", "g"]. */
export function elementNames(markup: string, indices: number[]): string[] {
  const doc = parse(markup);
  return indices.map(i => doc.querySelector(`[${INDEX_ATTR}="${i}"]`)?.localName ?? '?');
}
