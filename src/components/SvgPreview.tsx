/** The edited SVG on a checkerboard, so transparent areas are visible. */
export function SvgPreview({size, markup}: {size: number; markup: string | null}) {
  const url = markup ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}` : null;

  return (
    <div
      className='flex items-center justify-center rounded-md p-8 shadow-lg ring-1 ring-border'
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
      {url && (
        <img
          src={url}
          alt='Edited SVG'
          className='h-full w-full object-contain'
        />
      )}
    </div>
  );
}
