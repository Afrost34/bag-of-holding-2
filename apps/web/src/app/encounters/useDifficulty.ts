import { encounterDifficulty, type EncounterDifficulty, type EncounterRules } from '@boh/rules';
import { useEffect, useMemo, useState } from 'react';
import { useCampaigns } from '../campaigns/store';
import { useCharacters } from '../characters/store';
import { loadEntity } from '../data/entities';
import type { Encounter } from './model';

export interface PartyMember {
  name: string;
  level: number;
}

export interface EncounterInfo {
  rules: EncounterRules;
  /** Milestone campaigns show no XP (difficulty only); outside campaigns XP shows. */
  showXp: boolean;
  /** Who the difficulty is worked out for. */
  party: PartyMember[];
  /** Typed in by hand (not the campaign's characters). */
  partyByHand: boolean;
  /** Monster key → challenge rating, once read. */
  crs: ReadonlyMap<string, unknown>;
  difficulty: EncounterDifficulty | null;
}

/**
 * An encounter's party (the campaign's characters, or levels typed in by hand) and difficulty
 * under the campaign's edition (2014 thresholds, or the 2024 budget for 2024 and mixed).
 */
export function useEncounterInfo(encounter: Encounter | undefined): EncounterInfo {
  const { characters, loaded, load } = useCharacters();
  const campaign = useCampaigns((s) => s.campaigns.find((c) => c.id === encounter?.campaign));
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const keys = (encounter?.monsters ?? []).map((m) => m.key).join('\n');
  const [crs, setCrs] = useState<ReadonlyMap<string, unknown>>(new Map());
  useEffect(() => {
    let live = true;
    const list = keys ? keys.split('\n') : [];
    void Promise.all(list.map(async (k) => [k, (await loadEntity(k))?.data.cr] as const)).then(
      (pairs) => {
        if (live) setCrs(new Map(pairs));
      },
    );
    return () => {
      live = false;
    };
  }, [keys]);

  return useMemo(() => {
    const rules: EncounterRules = campaign?.edition === '2014' ? '2014' : '2024';
    const byHand = encounter?.party;
    const party: PartyMember[] = byHand
      ? byHand.map((level, i) => ({ name: `Character ${String(i + 1)}`, level }))
      : characters
          .filter((c) => encounter?.campaign && c.campaign === encounter.campaign)
          .map((c) => ({
            name: c.name,
            level: Math.max(
              1,
              c.decisions.classes.reduce((n, x) => n + x.levels, 0),
            ),
          }));
    const monsters = (encounter?.monsters ?? []).flatMap((m) =>
      Array.from({ length: m.count }, () => crs.get(m.key)),
    );
    return {
      rules,
      showXp: campaign?.rules.advancement !== 'milestone',
      party,
      partyByHand: byHand !== undefined,
      crs,
      difficulty:
        encounter && party.length > 0
          ? encounterDifficulty(
              monsters,
              party.map((p) => p.level),
              rules,
            )
          : null,
    };
  }, [campaign?.edition, campaign?.rules.advancement, encounter, characters, crs]);
}
