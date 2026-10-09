/**
 * The DM screen card's quick-reference tables: the rules a DM looks up mid-session, in our own
 * words (game rules, not book text). Conditions and actions come from the 5etools data instead.
 * Dice in a cell (`2d10`) become roll chips.
 */

export type Edition = '2014' | '2024';

export interface ScreenTable {
  title: string;
  columns: string[];
  rows: string[][];
  /** A line under the table. */
  note?: string;
}

export const SCREEN_SECTIONS = [
  { id: 'conditions', label: 'Conditions' },
  { id: 'actions', label: 'Actions' },
  { id: 'checks', label: 'Checks' },
  { id: 'combat', label: 'Combat' },
  { id: 'exploration', label: 'Exploration' },
  { id: 'hazards', label: 'Objects & hazards' },
] as const;

export type ScreenSection = (typeof SCREEN_SECTIONS)[number]['id'];

/** The tables of a section, as the edition has them (conditions and actions come from data). */
export function screenTables(section: ScreenSection, edition: Edition): ScreenTable[] {
  const is2024 = edition === '2024';
  switch (section) {
    case 'conditions':
    case 'actions':
      return [];
    case 'checks':
      return [
        {
          title: 'Difficulty Class',
          columns: ['Task', 'DC'],
          rows: [
            ['Very easy', '5'],
            ['Easy', '10'],
            ['Medium', '15'],
            ['Hard', '20'],
            ['Very hard', '25'],
            ['Nearly impossible', '30'],
          ],
        },
        {
          title: 'Skills by ability',
          columns: ['Ability', 'Skills'],
          rows: [
            ['Strength', 'Athletics'],
            ['Dexterity', 'Acrobatics, Sleight of Hand, Stealth'],
            ['Constitution', '—'],
            ['Intelligence', 'Arcana, History, Investigation, Nature, Religion'],
            ['Wisdom', 'Animal Handling, Insight, Medicine, Perception, Survival'],
            ['Charisma', 'Deception, Intimidation, Performance, Persuasion'],
          ],
        },
        {
          title: 'Passive checks',
          columns: ['Rule', 'Value'],
          rows: [
            ['Passive score', '10 + the check’s modifier'],
            ['Advantage / Disadvantage', '+5 / −5'],
            ['Group check', 'Succeeds if at least half the group succeeds'],
          ],
        },
      ];
    case 'combat':
      return [
        {
          title: 'Cover',
          columns: ['Cover', 'Effect'],
          rows: [
            ['Half', '+2 to AC and Dexterity saves (at least half the body covered)'],
            ['Three-quarters', '+5 to AC and Dexterity saves (about three-quarters covered)'],
            ['Total', 'Can’t be targeted directly'],
          ],
        },
        {
          title: 'Size and space',
          columns: ['Size', 'Space', 'Squares'],
          rows: [
            ['Tiny', '2½ by 2½ ft', '4 per square'],
            ['Small', '5 by 5 ft', '1'],
            ['Medium', '5 by 5 ft', '1'],
            ['Large', '10 by 10 ft', '2 by 2'],
            ['Huge', '15 by 15 ft', '3 by 3'],
            ['Gargantuan', '20 by 20 ft or more', '4 by 4'],
          ],
        },
        {
          title: 'Quick rules',
          columns: ['Rule', 'How it works'],
          rows: [
            [
              'Concentration',
              is2024
                ? 'Constitution save on damage: DC 10 or half the damage, whichever is higher (up to DC 30)'
                : 'Constitution save on damage: DC 10 or half the damage, whichever is higher',
            ],
            ['Critical hit', 'Roll the attack’s damage dice twice, then add modifiers'],
            ['Unseen attacker', 'Advantage on attacks; attacks against it have Disadvantage'],
            ['Ranged attack in melee', 'Disadvantage when an enemy is within 5 feet'],
            ['Long range', 'Disadvantage beyond normal range'],
            ['Difficult terrain', 'Each foot of movement costs 1 extra foot'],
            ['Death saves', '10 or higher succeeds; three of either; 1 = two failures, 20 = 1 HP'],
          ],
        },
      ];
    case 'exploration':
      return [
        {
          title: 'Travel pace',
          columns: ['Pace', 'Minute', 'Hour', 'Day', 'Effect'],
          rows: is2024
            ? [
                ['Fast', '400 ft', '4 miles', '30 miles', 'Disadvantage on Perception'],
                ['Normal', '300 ft', '3 miles', '24 miles', 'Disadvantage on Stealth'],
                ['Slow', '200 ft', '2 miles', '18 miles', 'Advantage on Perception and Survival'],
              ]
            : [
                ['Fast', '400 ft', '4 miles', '30 miles', '−5 to passive Perception'],
                ['Normal', '300 ft', '3 miles', '24 miles', '—'],
                ['Slow', '200 ft', '2 miles', '18 miles', 'Able to use Stealth'],
              ],
          note: 'Forced march: past 8 hours, a Constitution save each hour (DC 10 + 1 per extra hour) or gain Exhaustion.',
        },
        {
          title: 'Light and vision',
          columns: ['Light', 'Effect'],
          rows: [
            ['Bright light', 'Normal vision'],
            ['Dim light', 'Lightly obscured: Disadvantage on Perception checks that rely on sight'],
            ['Darkness', 'Heavily obscured: effectively Blinded'],
            ['Darkvision', 'Within range: dim light as bright, darkness as dim (no colour)'],
            [
              'Blindsight / Truesight',
              'Perceive without sight / see through illusions and the invisible',
            ],
          ],
        },
        {
          title: 'Falling, breath and jumps',
          columns: ['Rule', 'How it works'],
          rows: [
            ['Falling', '1d6 bludgeoning per 10 feet fallen (up to 20d6); lands Prone'],
            ['Holding breath', '1 + Constitution modifier minutes (at least 30 seconds)'],
            [
              'Suffocating',
              is2024
                ? 'Out of breath: 1 Exhaustion level at the end of each turn, removed when it can breathe'
                : 'Out of breath: Constitution modifier rounds (at least 1), then 0 HP and dying',
            ],
            ['Long jump', 'Strength score in feet with a 10-foot run-up; half standing'],
            ['High jump', '3 + Strength modifier feet with a 10-foot run-up; half standing'],
          ],
        },
      ];
    case 'hazards':
      return [
        {
          title: 'Object Armor Class',
          columns: ['Material', 'AC'],
          rows: [
            ['Cloth, paper, rope', '11'],
            ['Crystal, glass, ice', '13'],
            ['Wood, bone', '15'],
            ['Stone', '17'],
            ['Iron, steel', '19'],
            ['Mithral', '21'],
            ['Adamantine', '23'],
          ],
        },
        {
          title: 'Object hit points',
          columns: ['Size', 'Fragile', 'Resilient'],
          rows: [
            ['Tiny (bottle, lock)', '2 (1d4)', '5 (2d4)'],
            ['Small (chest, lute)', '3 (1d6)', '10 (3d6)'],
            ['Medium (barrel, chandelier)', '4 (1d8)', '18 (4d8)'],
            ['Large (cart, window)', '5 (1d10)', '27 (5d10)'],
          ],
        },
        {
          title: 'Improvised damage',
          columns: ['Levels', 'Setback', 'Dangerous', 'Deadly'],
          rows: [
            ['1–4', '1d10', '2d10', '4d10'],
            ['5–10', '2d10', '4d10', '10d10'],
            ['11–16', '4d10', '10d10', '18d10'],
            ['17–20', '10d10', '18d10', '24d10'],
          ],
          note: 'Hot coals 1d10 · lightning strike 2d10 · collapsing tunnel 4d10 · lava 10d10 and up.',
        },
        {
          title: 'Trap save DCs and attacks',
          columns: ['Danger', 'Save DC', 'Attack bonus'],
          rows: [
            ['Setback', '10–11', '+3 to +5'],
            ['Dangerous', '12–15', '+6 to +8'],
            ['Deadly', '16–20', '+9 to +12'],
          ],
        },
      ];
  }
}

/** A cell split into text and dice (`2d10`, `1d6`), for roll chips. */
export function diceParts(text: string): { text: string; dice?: true }[] {
  const out: { text: string; dice?: true }[] = [];
  let last = 0;
  for (const m of text.matchAll(/\b\d+d\d+\b/g)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], dice: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
