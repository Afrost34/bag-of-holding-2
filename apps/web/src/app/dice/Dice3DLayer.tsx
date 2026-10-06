import { DICE_3D_CONTAINER_ID } from './dice3d';
import { useDiceSettings } from './store';

/** Full-screen, click-through surface the 3D dice are thrown onto. */
export function Dice3DLayer() {
  const threeD = useDiceSettings((s) => s.threeD);
  if (!threeD) return null;
  return (
    <div
      id={DICE_3D_CONTAINER_ID}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[45] print:hidden [&>canvas]:h-full [&>canvas]:w-full"
    />
  );
}
