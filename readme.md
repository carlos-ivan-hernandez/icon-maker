# Icon Maker

A small web app for turning an SVG into a 1024×1024 or 512×512 PNG app icon on a solid background.

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

## How it works

Everything runs in the browser. `src/lib/render.ts` has a single `drawIcon` function that the preview, the thumbnails and the export all share, so the PNG matches the preview exactly. Layout is stored in 512px layout space whatever the export size (zoom = the SVG's longest side as a fraction of the icon edge, plus an x/y offset from center), and the preview scales it to its own size.

`src/lib/svg.ts` gives every SVG explicit width/height from its viewBox before decoding, since SVGs with only a viewBox otherwise render at the wrong size in some browsers.

## Scripts

- `pnpm dev`: dev server
- `pnpm build`: typecheck and production build to `dist/`
- `pnpm lint` / `pnpm fmt`: oxlint / oxfmt
