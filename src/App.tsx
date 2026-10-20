import {Button, Input, Label, Separator, Slider, toast} from '@heroui/react';
import {type ChangeEvent, type DragEvent, useRef, useState} from 'react';
import {clampZoom, MAX_ZOOM, MIN_ZOOM, Preview, Thumbnail} from './components/Preview';
import {DEFAULT_LAYOUT, exportPng, ICON_SIZE, type Layout} from './lib/render';
import {type LoadedSvg, loadSvg} from './lib/svg';

const PREVIEW_SIZE = 384;
const THUMBNAIL_SIZES = [128, 64, 32];
const DEFAULT_BACKGROUND = '#2563eb';

/** "#abc" or "#aabbcc" (with or without the #) → "#aabbcc"; anything else → null. */
function normalizeHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
  if (/^[0-9a-f]{3}$/.test(hex))
    return `#${hex
      .split('')
      .map(c => c + c)
      .join('')}`;
  return null;
}

export default function App() {
  const [svg, setSvg] = useState<LoadedSvg | null>(null);
  const [background, setBackground] = useState(DEFAULT_BACKGROUND);
  const [hexDraft, setHexDraft] = useState(DEFAULT_BACKGROUND);
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [saving, setSaving] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openMarkup = async (name: string, markup: string) => {
    try {
      setSvg(await loadSvg(name, markup));
      setLayout(DEFAULT_LAYOUT);
    } catch (err) {
      toast.danger(`Could not load "${name}"`, {description: err instanceof Error ? err.message : String(err)});
    }
  };

  const onFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again still fires a change event.
    e.target.value = '';
    if (file) await openMarkup(file.name, await file.text());
  };

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const file = [...e.dataTransfer.files].find(f => f.type === 'image/svg+xml' || f.name.endsWith('.svg'));
    if (file) await openMarkup(file.name, await file.text());
    else if (e.dataTransfer.files.length) toast.danger('Drop an .svg file');
  };

  const setColor = (value: string) => {
    setHexDraft(value);
    const hex = normalizeHex(value);
    if (hex) setBackground(hex);
  };

  const createPng = async () => {
    if (!svg) return;
    setSaving(true);
    try {
      const suggested = `${svg.name.replace(/\.svg$/i, '')}.png`;
      const url = URL.createObjectURL(await exportPng(svg, background, layout));
      const link = document.createElement('a');
      link.href = url;
      link.download = suggested;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.danger('Could not save the icon', {description: String(err)});
    } finally {
      setSaving(false);
    }
  };

  const centered = layout.x === 0 && layout.y === 0;

  return (
    <div
      className='flex h-full'
      onDragOver={e => {
        e.preventDefault();
        setDropActive(true);
      }}
      onDragLeave={e => {
        if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) setDropActive(false);
      }}
      onDrop={onDrop}
    >
      <main className='relative flex flex-1 flex-col items-center justify-center gap-8 p-8'>
        <Preview
          size={PREVIEW_SIZE}
          svg={svg}
          background={background}
          layout={layout}
          onLayoutChange={setLayout}
        />
        {svg ? (
          <div className='flex items-end gap-6'>
            {THUMBNAIL_SIZES.map(size => (
              <Thumbnail
                key={size}
                size={size}
                svg={svg}
                background={background}
                layout={layout}
              />
            ))}
          </div>
        ) : (
          <p className='text-sm text-muted'>Choose or drop an SVG to get started.</p>
        )}
        {dropActive && (
          <div className='pointer-events-none absolute inset-4 flex items-center justify-center rounded-lg border-2 border-dashed border-accent bg-accent/10 text-lg'>
            Drop SVG here
          </div>
        )}
      </main>

      <aside className='flex w-80 flex-col gap-5 border-l border-separator bg-surface p-5'>
        <section className='flex flex-col gap-2'>
          <Label>SVG</Label>
          <Button
            variant='outline'
            onPress={() => fileInputRef.current?.click()}
          >
            {svg ? 'Choose a different SVG…' : 'Choose SVG…'}
          </Button>
          <input
            ref={fileInputRef}
            type='file'
            accept='.svg,image/svg+xml'
            className='hidden'
            onChange={onFileChosen}
          />
          {svg && (
            <span
              className='truncate text-sm text-muted'
              title={svg.name}
            >
              {svg.name}
            </span>
          )}
        </section>

        <section className='flex flex-col gap-2'>
          <Label htmlFor='background-hex'>Background</Label>
          <div className='flex items-center gap-2'>
            <input
              type='color'
              aria-label='Background color picker'
              className='h-9 w-12 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5'
              value={background}
              onChange={e => setColor(e.target.value)}
            />
            <Input
              id='background-hex'
              className='flex-1 font-mono'
              value={hexDraft}
              spellCheck={false}
              onChange={e => setColor(e.target.value)}
              onBlur={() => setHexDraft(background)}
            />
          </div>
        </section>

        <Separator />

        <Slider
          aria-label='Zoom'
          isDisabled={!svg}
          minValue={MIN_ZOOM * 100}
          maxValue={MAX_ZOOM * 100}
          step={1}
          value={Math.round(layout.zoom * 100)}
          onChange={v => setLayout({...layout, zoom: clampZoom((typeof v === 'number' ? v : v[0]) / 100)})}
          className='flex flex-col gap-2'
        >
          <div className='flex justify-between'>
            <Label>Zoom</Label>
            <Slider.Output className='text-sm tabular-nums text-muted'>
              {({state}) => `${state.values[0]}%`}
            </Slider.Output>
          </div>
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>

        <section className='flex flex-col gap-2'>
          <div className='flex justify-between'>
            <Label>Position</Label>
            <span className='text-sm tabular-nums text-muted'>
              {layout.x}, {layout.y}
            </span>
          </div>
          <Button
            variant='outline'
            isDisabled={!svg || centered}
            onPress={() => setLayout({...layout, x: 0, y: 0})}
          >
            Center
          </Button>
          <div className='flex gap-2'>
            <Button
              className='flex-1'
              size='sm'
              variant='ghost'
              isDisabled={!svg || layout.x === 0}
              onPress={() => setLayout({...layout, x: 0})}
            >
              Center horizontally
            </Button>
            <Button
              className='flex-1'
              size='sm'
              variant='ghost'
              isDisabled={!svg || layout.y === 0}
              onPress={() => setLayout({...layout, y: 0})}
            >
              Center vertically
            </Button>
          </div>
          <p className='text-xs text-muted'>
            Drag the preview to move, scroll to zoom, arrow keys to nudge (Shift for 10px, hold Alt while dragging to
            skip snapping).
          </p>
        </section>

        <div className='mt-auto flex flex-col gap-2'>
          <Button
            variant='ghost'
            isDisabled={!svg}
            onPress={() => setLayout(DEFAULT_LAYOUT)}
          >
            Reset layout
          </Button>
          <Button
            size='lg'
            isDisabled={!svg || saving}
            onPress={createPng}
          >
            Create {ICON_SIZE}×{ICON_SIZE} PNG
          </Button>
        </div>
      </aside>
    </div>
  );
}
