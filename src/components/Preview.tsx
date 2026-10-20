import {type KeyboardEvent, type PointerEvent, useEffect, useRef, useState} from 'react';
import {drawIcon, ICON_SIZE, type Layout} from '../lib/render';
import {type LoadedSvg} from '../lib/svg';

/** Within this many icon px of center, dragging snaps onto the axis. */
const SNAP = 6;
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 2;

export function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

type Props = {
  size: number;
  svg: LoadedSvg | null;
  background: string;
  layout: Layout;
  onLayoutChange: (layout: Layout) => void;
};

/** The large, interactive preview: drag to move, scroll to zoom, arrow keys
 * to nudge (Shift for 10px). */
export function Preview({size, svg, background, layout, onLayoutChange}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{pointerX: number; pointerY: number; start: Layout} | null>(null);
  const [dragging, setDragging] = useState(false);
  const toIcon = ICON_SIZE / size;

  useCanvas(canvasRef, size, svg, background, layout);

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!svg || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {pointerX: e.clientX, pointerY: e.clientY, start: layout};
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    const x = d.start.x + (e.clientX - d.pointerX) * toIcon;
    const y = d.start.y + (e.clientY - d.pointerY) * toIcon;
    // Alt disables snapping for fine placement near the center.
    const snap = (v: number) => (!e.altKey && Math.abs(v) < SNAP ? 0 : Math.round(v));
    onLayoutChange({...layout, x: snap(x), y: snap(y)});
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  // React's onWheel is passive, so preventDefault needs a native listener.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      onLayoutChange({...layout, zoom: clampZoom(layout.zoom * Math.exp(-e.deltaY * 0.002))});
    };
    canvas.addEventListener('wheel', onWheel, {passive: false});
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [svg, layout, onLayoutChange]);

  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const step = e.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (!svg || !move) return;
    e.preventDefault();
    onLayoutChange({...layout, x: layout.x + move[0], y: layout.y + move[1]});
  };

  return (
    <div
      className='relative'
      style={{width: size, height: size}}
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label='Icon preview. Drag to move, scroll to zoom, arrow keys to nudge.'
        className={`rounded-md shadow-lg ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-focus ${
          svg ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        style={{width: size, height: size, touchAction: 'none'}}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      />
      {dragging && (
        <div className='pointer-events-none absolute inset-0'>
          {layout.x === 0 && <div className='absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-pink-500/80' />}
          {layout.y === 0 && <div className='absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-pink-500/80' />}
        </div>
      )}
    </div>
  );
}

/** A small, static rendering, for judging legibility at typical icon sizes. */
export function Thumbnail({size, svg, background, layout}: Omit<Props, 'onLayoutChange'>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCanvas(canvasRef, size, svg, background, layout);
  return (
    <div className='flex flex-col items-center gap-1.5'>
      <canvas
        ref={canvasRef}
        className='rounded-sm ring-1 ring-border'
        style={{width: size, height: size}}
      />
      <span className='text-xs text-muted'>{size}px</span>
    </div>
  );
}

/** Keeps a canvas's backing store at device resolution and redraws it
 * whenever any input changes. */
function useCanvas(
  ref: React.RefObject<HTMLCanvasElement | null>,
  size: number,
  svg: LoadedSvg | null,
  background: string,
  layout: Layout,
) {
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const px = Math.round(size * window.devicePixelRatio);
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    drawIcon(ctx, px, svg, background, layout);
  }, [ref, size, svg, background, layout]);
}
