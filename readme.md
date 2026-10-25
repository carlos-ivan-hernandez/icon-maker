# Icon Maker

A small web app for turning an SVG into a 1024×1024 or 512×512 PNG app icon on a solid background, or for changing an SVG's colors, deleting parts of it, and saving it as a new SVG.

## Usage

```sh
pnpm install
pnpm dev
```

1. Choose an SVG (or drop one anywhere on the page).
2. Pick a background color with the color picker or by typing a hex value. The default is `#1c1c1c`.
3. Pick the SVG's color the same way. The whole SVG is painted in that one color (default `#e5e5e5`), keeping its shape. **Use original colors** turns this off and shows the SVG's own colors. Click the button again, or pick a color, to switch back.
4. Position the icon: drag the preview to move it (it snaps to center; hold Alt to skip snapping), scroll or use the slider to zoom, and use the arrow keys to nudge (Shift for 10px). **Center** puts it back in the middle.
5. Choose **1024×1024** (the default) or **512×512**, then click **Create PNG** to download the icon.

The 128/64/32px previews show how the icon reads at small sizes.

### Edit SVG mode

Switch to **Edit SVG** at the top of the sidebar to delete parts of the SVG or change its own colors:

1. Click part of the SVG to select it (Shift-click to select more, Escape to clear). **Select group** widens the selection to the group it's in. **Delete** (or the Delete/Backspace key) removes it. **Undo delete** (Ctrl/⌘Z) brings back the last deletion, and **Restore all parts** brings back everything.
2. Every color the SVG uses is listed. Change any of them with the picker or a hex value, or use **Make it all one color**.
3. **Download SVG** saves the edited file. **Reset colors** goes back to the original colors.

Deletions carry over to PNG icon mode. So do color edits, which also switch PNG icon mode to the SVG's own colors so they show.

## How it works

Everything runs in the browser. `src/lib/render.ts` has a single `drawIcon` function that the preview, the thumbnails and the export all share, so the PNG matches the preview exactly. Layout is stored in 512px layout space whatever the export size (zoom = the SVG's longest side as a fraction of the icon edge, plus an x/y offset from center), and the preview scales it to its own size.

`src/lib/recolor.ts` finds and replaces colors in the SVG markup: `fill`, `stroke`, `stop-color` and similar attributes, inline `style` attributes and `<style>` blocks. Shapes with no fill (and `currentColor` with no color set) are drawn black by default; those show up as black, and changing it sets the new color on the root `<svg>`.

`src/lib/sections.ts` handles deleting parts. Each element is tagged with its position in the original file, so a deletion keeps pointing at the same element. The tags are taken out again before download. The Edit SVG preview draws the SVG inline inside a shadow root (with scripts and event handlers removed), so its parts can be clicked and its `<style>` can't affect the page.

`src/lib/svg.ts` gives every SVG explicit width/height from its viewBox before decoding, since SVGs with only a viewBox otherwise render at the wrong size in some browsers.

## Scripts

- `pnpm dev`: dev server
- `pnpm build`: typecheck and production build to `dist/`
- `pnpm lint` / `pnpm fmt`: oxlint / oxfmt
