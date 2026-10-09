import type { Edition } from '@boh/data5e';

/**
 * Wild Shape: which Beasts a Druid can become, from the Beast Shapes tables (PHB 2014 and XPHB
 * 2024) and Circle of the Moon's Circle Forms.
 *
 *   2024: 4 known forms (CR 1/4, no fly) at 2; 6 (CR 1/2, no fly) at 4; 8 (CR 1) at 8.
 *         Circle Forms (level 3): max CR = druid level / 3, rounded down.
 *   2014: any beast seen; CR 1/4 without fly or swim at 2; CR 1/2 without fly at 4; CR 1 at 8.
 *         Circle Forms (level 2): CR 1, and from level 6 druid level / 3, rounded down.
 */

export interface WildShapeLimits {
  /** How many forms are known (2024); null when any eligible beast will do (2014). */
  known: number | null;
  /** Highest challenge rating a form may have. */
  maxCr: number;
  /** Whether forms may have a fly speed, and a swim speed. */
  fly: boolean;
  swim: boolean;
}

export function wildShapeLimits(
  druidLevel: number,
  edition: Edition,
  /** The character has Circle Forms (Circle of the Moon). */
  circleForms = false,
): WildShapeLimits | null {
  if (druidLevel < 2) return null;
  const base = druidLevel >= 8 ? 1 : druidLevel >= 4 ? 0.5 : 0.25;
  const fly = druidLevel >= 8;
  if (edition === '2024') {
    const moon = circleForms && druidLevel >= 3 ? Math.floor(druidLevel / 3) : 0;
    return {
      known: druidLevel >= 8 ? 8 : druidLevel >= 4 ? 6 : 4,
      maxCr: Math.max(base, moon),
      fly,
      swim: true,
    };
  }
  const moon = circleForms ? (druidLevel >= 6 ? Math.floor(druidLevel / 3) : 1) : 0;
  return { known: null, maxCr: Math.max(base, moon), fly, swim: druidLevel >= 4 };
}

/** What eligibility needs to know of a creature (a monster list row has it all). */
export interface FormCandidate {
  name: string;
  /** Creature type as listed ("Beast"). */
  type: string;
  cr: number | null;
  /** Movement modes ("Walk", "Fly", "Swim"…). */
  speeds: readonly string[];
}

/** Whether a creature can be a Wild Shape form within these limits (a Beast, not a swarm). */
export function isEligibleForm(c: FormCandidate, limits: WildShapeLimits): boolean {
  if (c.type.toLowerCase() !== 'beast' || /^swarm of /i.test(c.name)) return false;
  if (c.cr === null || c.cr > limits.maxCr) return false;
  const modes = c.speeds.map((s) => s.toLowerCase());
  if (!limits.fly && modes.includes('fly')) return false;
  if (!limits.swim && modes.includes('swim')) return false;
  return true;
}

/** "1/4", "1/2", "1", "2": a challenge rating as written. */
export function crLabel(cr: number): string {
  return cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr);
}
