import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@boh/ui';
import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MapScene } from '../../app/maps/scene';

/** Sizes offered, against the map's own; the largest a browser can draw is about 16k pixels. */
const SIZES = [0.25, 0.5, 1, 1.5, 2] as const;
const MAX_SIDE = 16384;
const PIN_SIZES = [0.5, 1, 2, 3, 4, 6, 8] as const;
/** The preview's width (pixels). */
const PREVIEW = 560;

/**
 * Exporting a map as a picture: its size, how big the pins are (they keep one size on screen
 * while zooming, so a picture needs one of its own) and the grid, with a preview of the result.
 */
export function ExportDialog({
  scene,
  name,
  width,
  height,
  hasGrid,
  onClose,
}: {
  scene: MapScene;
  name: string;
  width: number;
  height: number;
  hasGrid: boolean;
  onClose: () => void;
}) {
  const sizes = SIZES.filter((s) => Math.max(width, height) * s <= MAX_SIDE);
  const [scale, setScale] = useState<number>(sizes.includes(1) ? 1 : (sizes.at(-1) ?? 1));
  // On a big map, pins drawn at screen size come out small: start them larger.
  const [pinScale, setPinScale] = useState<number>(
    Math.max(width, height) > 4000 ? 4 : Math.max(width, height) > 2000 ? 2 : 1,
  );
  const [withGrid, setWithGrid] = useState(hasGrid);
  const [preview, setPreview] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      const canvas = scene.exportCanvas({
        withGrid,
        pinScale,
        scale: Math.min(1, PREVIEW / width),
      });
      if (live) setPreview(canvas.toDataURL('image/png'));
    }, 150);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [scene, withGrid, pinScale, width]);

  const save = async () => {
    setExporting(true);
    try {
      const blob = await scene.exportPng({ withGrid, pinScale, scale });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name || 'map'}.png`;
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 10_000);
      onClose();
    } finally {
      setExporting(false);
    }
  };
  const field = 'rounded border border-border bg-surface px-2 py-1 text-sm';

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[92vh] w-[min(94vw,40rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-xl">
          <div className="flex items-center gap-2">
            <Dialog.Title className="flex-1 font-serif text-lg font-bold">
              Export as a picture
            </Dialog.Title>
            <Dialog.Close aria-label="Close" className="rounded p-1 hover:bg-sunken">
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Choose the picture's size, the pins' size and the grid, then export.
          </Dialog.Description>
          <div className="flex min-h-40 items-center justify-center rounded-md border border-border bg-sunken p-2">
            {preview ? (
              <img
                src={preview}
                alt="Preview of the exported map"
                className="max-h-[45vh] max-w-full object-contain"
              />
            ) : (
              <p className="text-sm text-muted">Drawing the preview…</p>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="font-medium">Size</span>
              <select
                aria-label="Export size"
                value={scale}
                onChange={(e) => {
                  setScale(Number(e.target.value));
                }}
                className={field}
              >
                {sizes.map((s) => (
                  <option key={s} value={s}>
                    {Math.round(width * s)} × {Math.round(height * s)} px ({s * 100}%)
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">Pin size</span>
              <select
                aria-label="Pin size"
                value={pinScale}
                onChange={(e) => {
                  setPinScale(Number(e.target.value));
                }}
                className={field}
              >
                {PIN_SIZES.map((s) => (
                  <option key={s} value={s}>
                    × {s}
                  </option>
                ))}
              </select>
            </label>
            {hasGrid && (
              <label className="flex items-center gap-1.5 pb-1">
                <input
                  type="checkbox"
                  checked={withGrid}
                  onChange={(e) => {
                    setWithGrid(e.target.checked);
                  }}
                />
                Grid
              </label>
            )}
            <span className="flex-1" />
            <Button variant="primary" disabled={exporting} onClick={() => void save()}>
              <Download className="h-4 w-4" aria-hidden /> {exporting ? 'Exporting…' : 'Export'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
