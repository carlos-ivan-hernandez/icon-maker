import {type PointerEvent, useLayoutEffect, useRef, useState} from 'react';
import {elementIndex, INDEX_ATTR} from '../lib/sections';
import {intrinsicSize} from '../lib/svg';

type Box = {left: number; top: number; width: number; height: number};

type Props = {
  size: number;
  /** The edited SVG, with index tags (see lib/sections). */
  markup: string | null;
  selected: number[];
  onSelect: (indices: number[]) => void;
};

/** A copy of the SVG that is safe to put in the page and fills its box:
 * no scripts or event handlers, and a viewBox with 100% width/height. */
function displayCopy(markup: string): Element | null {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const svg = doc.documentElement;
  if (doc.querySelector('parsererror') || svg.localName !== 'svg') return null;
  for (const el of doc.querySelectorAll('script')) el.remove();
  for (const el of doc.querySelectorAll('*')) {
    // Copied, since removing attributes changes the live list.
    for (const attr of Array.from(el.attributes)) {
      const scripted = /^\s*javascript:/i.test(attr.value) && /href$/i.test(attr.name);
      if (attr.name.toLowerCase().startsWith('on') || scripted) el.removeAttribute(attr.name);
    }
  }
  if (!svg.hasAttribute('viewBox')) {
    const [w, h] = intrinsicSize(svg);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  return document.importNode(svg, true);
}

/** The edited SVG on a checkerboard, so transparent areas are visible. Click
 * a part to select it, Shift-click to add to the selection. */
export function SvgPreview({size, markup, selected, onSelect}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [boxes, setBoxes] = useState<{hovered: Box | null; selected: {index: number; box: Box}[]}>({
    hovered: null,
    selected: [],
  });
  // Forget the hover when the markup changes, since that part may be gone.
  const [shownMarkup, setShownMarkup] = useState(markup);
  if (markup !== shownMarkup) {
    setShownMarkup(markup);
    setHovered(null);
  }

  // The SVG lives in a shadow root so its own <style> can't affect the page.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({mode: 'open'});
    const style = document.createElement('style');
    style.textContent = ':host { display: block; width: 100%; height: 100%; } svg { display: block; }';
    const svg = markup ? displayCopy(markup) : null;
    root.replaceChildren(style, ...(svg ? [svg] : []));
  }, [markup]);

  // Outline the hovered and selected parts. Runs after the markup effect, so
  // it measures the new drawing.
  // oxlint-disable-next-line react/exhaustive-effect-dependencies
  useLayoutEffect(() => {
    const host = hostRef.current;
    const root = host?.shadowRoot;
    if (!host || !root) return;
    const origin = host.getBoundingClientRect();
    const measure = (i: number): Box | null => {
      const rect = root.querySelector(`[${INDEX_ATTR}="${i}"]`)?.getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) return null;
      return {left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height};
    };
    setBoxes({
      hovered: hovered !== null && !selected.includes(hovered) ? measure(hovered) : null,
      selected: selected.flatMap(index => {
        const box = measure(index);
        return box ? [{index, box}] : [];
      }),
    });
  }, [markup, selected, hovered]);

  /** The part under the pointer; null over empty space. */
  const pick = (e: PointerEvent): number | null => {
    for (const target of e.nativeEvent.composedPath()) {
      if (target === hostRef.current) break;
      if (target instanceof Element && target.hasAttribute(INDEX_ATTR)) return elementIndex(target);
    }
    return null;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const i = pick(e);
    if (e.shiftKey) {
      if (i !== null) onSelect(selected.includes(i) ? selected.filter(s => s !== i) : [...selected, i]);
    } else {
      onSelect(i === null ? [] : [i]);
    }
  };

  return (
    <div
      className='rounded-md p-8 shadow-lg ring-1 ring-border'
      style={{
        width: size,
        height: size,
        backgroundColor: '#fff',
        backgroundImage:
          'linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%), linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 8px 8px',
      }}
    >
      <div className='relative h-full w-full'>
        <div
          ref={hostRef}
          role='img'
          aria-label='Edited SVG. Click a part to select it.'
          className={hovered !== null ? 'cursor-pointer' : ''}
          onPointerDown={onPointerDown}
          onPointerMove={e => setHovered(pick(e))}
          onPointerLeave={() => setHovered(null)}
        />
        {boxes.hovered && (
          <div
            className='pointer-events-none absolute border border-dashed border-accent'
            style={outset(boxes.hovered)}
          />
        )}
        {boxes.selected.map(({index, box}) => (
          <div
            key={index}
            className='pointer-events-none absolute border-2 border-accent bg-accent/15'
            style={outset(box)}
          />
        ))}
      </div>
    </div>
  );
}

/** The box grown by 2px on each side, so thin lines stay visible inside it. */
function outset(box: Box) {
  return {left: box.left - 2, top: box.top - 2, width: box.width + 4, height: box.height + 4};
}
