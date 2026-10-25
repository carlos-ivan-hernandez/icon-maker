import {Button, Input, Label, Separator, Slider, toast, ToggleButton, ToggleButtonGroup} from '@heroui/react';
import {type ChangeEvent, type DragEvent, useEffect, useMemo, useRef, useState} from 'react';
import {clampZoom, MAX_ZOOM, MIN_ZOOM, Preview, Thumbnail} from './components/Preview';
import {SvgPreview} from './components/SvgPreview';
import {extractColors, recolorSvg} from './lib/recolor';
import {DEFAULT_LAYOUT, EXPORT_SIZES, type ExportSize, exportPng, type Layout} from './lib/render';
import {elementNames, parentsOf, removeElements, tagElements, untag} from './lib/sections';
import {type LoadedSvg, loadSvg} from './lib/svg';

type Mode = 'png' | 'edit';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const PREVIEW_SIZE = 384;
const THUMBNAIL_SIZES = [128, 64, 32];
const DEFAULT_BACKGROUND = '#1c1c1c';
const DEFAULT_SVG_COLOR = '#e5e5e5';

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

/** A color picker plus a hex field. Typing only applies once the text is a
 * valid hex color, and leaving the field puts back the color in use. */
function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // Follow changes made elsewhere (resets, "all one color"), but not while
  // the typed text already means the current color, e.g. "#fff".
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    if (normalizeHex(draft) !== value) setDraft(value);
  }
  const set = (text: string) => {
    setDraft(text);
    const hex = normalizeHex(text);
    if (hex) onChange(hex);
  };
  return (
    <div className='flex items-center gap-2'>
      <input
        type='color'
        aria-label={`${label} color picker`}
        className='h-9 w-12 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5'
        value={value}
        onChange={e => set(e.target.value)}
      />
      <Input
        id={id}
        className='min-w-0 flex-1 font-mono'
        value={draft}
        spellCheck={false}
        onChange={e => set(e.target.value)}
        onBlur={() => setDraft(value)}
      />
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<Mode>('png');
  /** The file as chosen; color edits are applied on top of it. */
  const [source, setSource] = useState<{name: string; markup: string} | null>(null);
  /** Deleted parts of the SVG by element index, one batch per deletion so it can be undone. */
  const [deleted, setDeleted] = useState<number[][]>([]);
  /** Parts selected in Edit SVG mode, by element index. */
  const [selected, setSelected] = useState<number[]>([]);
  /** Original color → new color, both "#rrggbb". */
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  /** The SVG with color edits applied, decoded for the PNG canvas. */
  const [svg, setSvg] = useState<LoadedSvg | null>(null);
  const [background, setBackground] = useState(DEFAULT_BACKGROUND);
  const [svgColor, setSvgColor] = useState(DEFAULT_SVG_COLOR);
  /** False draws the SVG in its own colors; `svgColor` is kept for switching back. */
  const [recolor, setRecolor] = useState(true);
  const [exportSize, setExportSize] = useState<ExportSize>(1024);
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [saving, setSaving] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // source → tag each element → delete parts → recolor (still tagged, for the
  // editor) → untag (for download and PNG mode).
  const tagged = useMemo(() => (source ? tagElements(source.markup) : null), [source]);
  const trimmed = useMemo(() => (tagged ? removeElements(tagged, new Set(deleted.flat())) : null), [tagged, deleted]);
  const palette = useMemo(() => (trimmed ? extractColors(trimmed) : []), [trimmed]);
  const editedTagged = useMemo(() => (trimmed ? recolorSvg(trimmed, colorMap) : null), [trimmed, colorMap]);
  const editedMarkup = useMemo(() => (editedTagged ? untag(editedTagged) : null), [editedTagged]);
  const selectionParents = useMemo(
    () => (trimmed && selected.length ? parentsOf(trimmed, selected) : []),
    [trimmed, selected],
  );
  const canSelectParent = selectionParents.some(i => !selected.includes(i));
  const selectedNames = useMemo(
    () => (trimmed && selected.length ? [...new Set(elementNames(trimmed, selected))] : []),
    [trimmed, selected],
  );
  const edited = Object.entries(colorMap).some(([from, to]) => from !== to);

  // Keep the PNG mode's SVG in step with the color edits.
  useEffect(() => {
    if (!source || !editedMarkup) return;
    let cancelled = false;
    loadSvg(source.name, editedMarkup).then(
      loaded => !cancelled && setSvg(loaded),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [source, editedMarkup]);

  const openMarkup = async (name: string, markup: string) => {
    try {
      extractColors(markup);
      setSvg(await loadSvg(name, markup));
      setSource({name, markup});
      setColorMap({});
      setDeleted([]);
      setSelected([]);
      setLayout(DEFAULT_LAYOUT);
    } catch (err) {
      toast.danger(`Could not load "${name}"`, {description: err instanceof Error ? err.message : String(err)});
    }
  };

  /** Color edits also switch PNG mode to the SVG's own colors, so they show there. */
  const editColors = (update: (map: Record<string, string>) => Record<string, string>) => {
    setColorMap(update);
    setRecolor(false);
  };
  const setAllColors = (hex: string) => editColors(() => Object.fromEntries(palette.map(c => [c, hex])));

  const deleteSelected = () => {
    if (!selected.length) return;
    setDeleted(d => [...d, selected]);
    setSelected([]);
  };
  const undoDelete = () => {
    setDeleted(d => d.slice(0, -1));
    setSelected(deleted.at(-1) ?? []);
  };

  // Delete/Backspace deletes the selection, Escape clears it, Ctrl/Cmd+Z undoes a deletion.
  useEffect(() => {
    if (mode !== 'edit') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.closest('input, textarea, select') || t.isContentEditable)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selected.length) return;
        e.preventDefault();
        setDeleted(d => [...d, selected]);
        setSelected([]);
      } else if (e.key === 'Escape') {
        setSelected([]);
      } else if (e.key.toLowerCase() === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey && deleted.length) {
        e.preventDefault();
        setDeleted(d => d.slice(0, -1));
        setSelected(deleted.at(-1) ?? []);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, selected, deleted]);

  const downloadSvg = () => {
    if (!source || !editedMarkup) return;
    download(new Blob([editedMarkup], {type: 'image/svg+xml'}), source.name.replace(/(\.svg)?$/i, '.svg'));
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

  const color = recolor ? svgColor : null;

  const createPng = async () => {
    if (!svg) return;
    setSaving(true);
    try {
      download(await exportPng(svg, background, color, layout, exportSize), `${svg.name.replace(/\.svg$/i, '')}.png`);
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
        {mode === 'edit' ? (
          <SvgPreview
            size={PREVIEW_SIZE}
            markup={editedTagged}
            selected={selected}
            onSelect={setSelected}
          />
        ) : (
          <Preview
            size={PREVIEW_SIZE}
            svg={svg}
            background={background}
            color={color}
            layout={layout}
            onLayoutChange={setLayout}
          />
        )}
        {!svg ? (
          <p className='text-sm text-muted'>Choose or drop an SVG to get started.</p>
        ) : mode === 'png' ? (
          <div className='flex items-end gap-6'>
            {THUMBNAIL_SIZES.map(size => (
              <Thumbnail
                key={size}
                size={size}
                svg={svg}
                background={background}
                color={color}
                layout={layout}
              />
            ))}
          </div>
        ) : null}
        {dropActive && (
          <div className='pointer-events-none absolute inset-4 flex items-center justify-center rounded-lg border-2 border-dashed border-accent bg-accent/10 text-lg'>
            Drop SVG here
          </div>
        )}
      </main>

      <aside className='flex w-80 flex-col gap-5 overflow-y-auto border-l border-separator bg-surface p-5'>
        <ToggleButtonGroup
          aria-label='Mode'
          fullWidth
          selectionMode='single'
          disallowEmptySelection
          selectedKeys={[mode]}
          onSelectionChange={keys => {
            const [key] = keys;
            if (key === 'png' || key === 'edit') setMode(key);
          }}
        >
          <ToggleButton id='png'>PNG icon</ToggleButton>
          <ToggleButton id='edit'>Edit SVG</ToggleButton>
        </ToggleButtonGroup>

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

        {mode === 'edit' ? (
          <>
            <section className='flex flex-col gap-2'>
              <div className='flex items-baseline justify-between'>
                <Label>Parts</Label>
                <span className='text-sm text-muted'>
                  {selected.length ? `${selected.length} selected (${selectedNames.join(', ')})` : ''}
                </span>
              </div>
              <Button
                variant='danger'
                isDisabled={!selected.length}
                onPress={deleteSelected}
              >
                {selected.length > 1 ? `Delete ${selected.length} parts` : 'Delete selected part'}
              </Button>
              <div className='flex gap-2'>
                <Button
                  className='flex-1'
                  size='sm'
                  variant='ghost'
                  isDisabled={!canSelectParent}
                  onPress={() => setSelected(selectionParents)}
                >
                  Select group
                </Button>
                <Button
                  className='flex-1'
                  size='sm'
                  variant='ghost'
                  isDisabled={!deleted.length}
                  onPress={undoDelete}
                >
                  Undo delete
                </Button>
              </div>
              <p className='text-xs text-muted'>
                Click part of the SVG to select it, Shift-click to select more. Delete or Backspace removes it, Ctrl/⌘Z
                undoes.
              </p>
            </section>

            <Separator />

            <section className='flex flex-col gap-3'>
              <div className='flex items-baseline justify-between'>
                <Label>Colors</Label>
                <span className='text-sm text-muted'>{palette.length || ''}</span>
              </div>
              {!source && <p className='text-xs text-muted'>The SVG's colors will show up here.</p>}
              {source && !palette.length && <p className='text-xs text-muted'>No editable colors found in this SVG.</p>}
              {palette.map((original, i) => (
                <div
                  key={original}
                  className='flex items-center gap-2'
                >
                  <span
                    className='h-5 w-5 shrink-0 rounded-full ring-1 ring-border'
                    style={{backgroundColor: original}}
                    title={`Original: ${original}`}
                  />
                  <span className='text-muted'>→</span>
                  <div className='min-w-0 flex-1'>
                    <ColorField
                      id={`palette-${i}`}
                      label={`Replacement for ${original}`}
                      value={colorMap[original] ?? original}
                      onChange={hex => editColors(map => ({...map, [original]: hex}))}
                    />
                  </div>
                </div>
              ))}
            </section>

            {palette.length > 1 && (
              <section className='flex flex-col gap-2'>
                <Label htmlFor='all-colors-hex'>Make it all one color</Label>
                <ColorField
                  id='all-colors-hex'
                  label='All colors'
                  value={colorMap[palette[0]] ?? palette[0]}
                  onChange={setAllColors}
                />
              </section>
            )}

            <div className='mt-auto flex flex-col gap-2'>
              <div className='flex gap-2'>
                <Button
                  className='flex-1'
                  variant='ghost'
                  isDisabled={!deleted.length}
                  onPress={() => {
                    setDeleted([]);
                    setSelected([]);
                  }}
                >
                  Restore all parts
                </Button>
                <Button
                  className='flex-1'
                  variant='ghost'
                  isDisabled={!edited}
                  onPress={() => setColorMap({})}
                >
                  Reset colors
                </Button>
              </div>
              <Button
                size='lg'
                isDisabled={!source}
                onPress={downloadSvg}
              >
                Download SVG
              </Button>
              {(edited || deleted.length > 0) && (
                <p className='text-xs text-muted'>PNG icon mode uses these changes too.</p>
              )}
            </div>
          </>
        ) : (
          <>
            <section className='flex flex-col gap-2'>
              <Label htmlFor='background-hex'>Background</Label>
              <ColorField
                id='background-hex'
                label='Background'
                value={background}
                onChange={setBackground}
              />
            </section>

            <section className='flex flex-col gap-2'>
              <div className='flex items-baseline justify-between'>
                <Label htmlFor='svg-color-hex'>SVG color</Label>
                <span className='text-sm text-muted'>{recolor ? 'One color' : 'Original colors'}</span>
              </div>
              <ColorField
                id='svg-color-hex'
                label='SVG'
                value={svgColor}
                onChange={hex => {
                  setSvgColor(hex);
                  setRecolor(true);
                }}
              />
              <Button
                size='sm'
                variant='ghost'
                onPress={() => setRecolor(!recolor)}
              >
                {recolor ? 'Use original colors' : `Use ${svgColor}`}
              </Button>
              <p className='text-xs text-muted'>
                The whole SVG is painted in this color. Use original colors to undo it.
              </p>
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
                Drag the preview to move, scroll to zoom, arrow keys to nudge (Shift for 10px, hold Alt while dragging
                to skip snapping).
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
              <ToggleButtonGroup
                aria-label='PNG size'
                fullWidth
                selectionMode='single'
                disallowEmptySelection
                selectedKeys={[exportSize]}
                onSelectionChange={keys => {
                  const [key] = keys;
                  const size = EXPORT_SIZES.find(s => s === Number(key));
                  if (size) setExportSize(size);
                }}
              >
                {EXPORT_SIZES.map(size => (
                  <ToggleButton
                    key={size}
                    id={size}
                  >
                    {size}×{size}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Button
                size='lg'
                isDisabled={!svg || saving}
                onPress={createPng}
              >
                Create {exportSize}×{exportSize} PNG
              </Button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
