import type { DiceTerm } from '@boh/dice';
import type DiceBox from '@3d-dice/dice-box-threejs';

/**
 * 3D dice: purely a display. The result is decided by our own secure roller first; the 3D dice
 * are then thrown so they land on those values. The library (three.js + physics, ~1 MB) loads
 * only the first time 3D dice are shown.
 */

export const DICE_3D_CONTAINER_ID = 'boh-dice-3d';
const SUPPORTED_FACES = new Set([4, 6, 8, 10, 12, 20, 100]);
const MAX_3D_DICE = 30;

let boxPromise: Promise<DiceBox> | null = null;

async function getBox(): Promise<DiceBox> {
  boxPromise ??= (async () => {
    const { default: Box } = await import('@3d-dice/dice-box-threejs');
    const box = new Box(`#${DICE_3D_CONTAINER_ID}`, {
      sounds: false,
      shadows: true,
      theme_material: 'plastic',
      theme_customColorset: {
        name: 'bag-of-holding',
        foreground: '#ffffff',
        background: '#b42a2a',
        outline: '#5c1414',
        texture: 'none',
        material: 'plastic',
      },
      gravity_multiplier: 400,
      light_intensity: 0.8,
      baseScale: 90,
      strength: 1.4,
    });
    await box.initialize();
    window.addEventListener('resize', () => {
      box.resizeWorld();
    });
    return box;
  })();
  return boxPromise;
}

/** Notation for predetermined dice: `2d20+1d6@14,3,5`, or null when 3D can't show these dice. */
export function notationFor(terms: DiceTerm[]): string | null {
  const shown = terms.filter((t) => t.dice.length > 0);
  if (shown.length === 0) return null;
  if (shown.some((t) => !SUPPORTED_FACES.has(t.faces))) return null;
  if (shown.reduce((n, t) => n + t.dice.length, 0) > MAX_3D_DICE) return null;
  const notation = shown.map((t) => `${String(t.dice.length)}d${String(t.faces)}`).join('+');
  const values = shown.flatMap((t) => t.dice.map((d) => d.value));
  return `${notation}@${values.join(',')}`;
}

/** Throws the dice on screen and resolves when they settle (or immediately if not showable). */
export async function show3dDice(terms: DiceTerm[]): Promise<void> {
  const notation = notationFor(terms);
  if (!notation) return;
  try {
    const box = await getBox();
    await box.roll(notation);
  } catch (error) {
    console.warn('3D dice unavailable', error);
  }
}

export function clear3dDice(): void {
  void boxPromise?.then((box) => {
    box.clearDice();
  });
}
