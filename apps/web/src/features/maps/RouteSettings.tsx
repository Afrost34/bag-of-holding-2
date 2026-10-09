import { Button } from '@boh/ui';
import { CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { addDays, formatDate, setToday } from '../../app/calendar/model';
import { useCalendar } from '../../app/calendar/store';
import type { MapDoc, MapItem } from '../../app/maps/model';
import {
  formatDistance,
  formatDuration,
  routeLength,
  speedsOf,
  type DistanceUnit,
} from '../../app/maps/travel';

type Route = Extract<MapItem, { kind: 'route' }>;

const field = 'mt-1 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-text';

/**
 * A route's name and colour, how far it goes and how long it takes at each of the map's speeds,
 * and the way to spend that time: the campaign's calendar moves on by the days of the journey.
 */
export function RouteSettings({
  item,
  doc,
  set,
}: {
  item: Route;
  doc: MapDoc;
  set: (change: (i: MapItem) => MapItem) => void;
}) {
  const stops = Math.floor(item.points.length / 2);
  const distance = doc.scale ? routeLength(item.points, doc.scale) : null;
  return (
    <>
      <label className="block text-sm">
        Name
        <input
          value={item.label}
          onChange={(e) => {
            const label = e.target.value;
            set((i) => (i.kind === 'route' ? { ...i, label } : i));
          }}
          className={field}
        />
      </label>
      <label className="block text-sm">
        Colour
        <input
          type="color"
          value={item.color}
          onChange={(e) => {
            const color = e.target.value;
            set((i) => (i.kind === 'route' ? { ...i, color } : i));
          }}
          className="mt-1 block h-8 w-16"
        />
      </label>
      <label className="block text-sm">
        Line
        <select
          value={item.dash ?? 'solid'}
          onChange={(e) => {
            const v = e.target.value;
            set((i) => {
              if (i.kind !== 'route') return i;
              const { dash: _was, ...rest } = i;
              return v === 'dashed' || v === 'dotted' ? { ...rest, dash: v } : rest;
            });
          }}
          className={field}
        >
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </label>
      <p className="text-sm text-muted">
        {stops} stops, {stops - 1} {stops === 2 ? 'leg' : 'legs'}.
      </p>
      {doc.scale && distance !== null ? (
        <Journey
          distance={distance}
          unit={doc.scale.unit}
          speeds={speedsOf(doc.scale, doc.travel)}
          campaign={doc.campaign}
        />
      ) : (
        <p className="text-sm text-muted">
          Give the map its real size (Map › Scale and travel) to see how far and how long.
        </p>
      )}
    </>
  );
}

function Journey({
  distance,
  unit,
  speeds,
  campaign,
}: {
  distance: number;
  unit: DistanceUnit;
  speeds: readonly { name: string; perDay: number }[];
  campaign: string | undefined;
}) {
  const { calendar, campaignId, load, save } = useCalendar();
  const [moved, setMoved] = useState<string | null>(null);
  useEffect(() => {
    if (campaign) void load(campaign);
  }, [campaign, load]);
  const shown = campaign !== undefined && campaignId === campaign ? calendar : null;
  return (
    <div aria-label="Journey" className="space-y-2">
      <p className="font-serif text-lg font-bold">{formatDistance(distance, unit)}</p>
      <ul className="space-y-1 text-sm">
        {speeds
          .filter((s) => s.perDay > 0)
          .map((s) => {
            const days = distance / s.perDay;
            const whole = Math.max(1, Math.ceil(days));
            return (
              <li key={s.name} className="flex flex-wrap items-center gap-2">
                <span className="flex-1">
                  {s.name}: <strong>{formatDuration(days)}</strong>
                </span>
                {shown && (
                  <Button
                    variant="ghost"
                    aria-label={`Advance the calendar ${String(whole)} ${whole === 1 ? 'day' : 'days'} (${s.name})`}
                    onClick={() => {
                      const today = addDays(shown, shown.today, whole);
                      save(setToday(shown, today));
                      setMoved(formatDate(shown, today));
                    }}
                  >
                    <CalendarDays className="h-4 w-4" aria-hidden /> +{whole}{' '}
                    {whole === 1 ? 'day' : 'days'}
                  </Button>
                )}
              </li>
            );
          })}
      </ul>
      {moved && (
        <p role="status" className="text-sm text-muted">
          Today is now {moved}.
        </p>
      )}
    </div>
  );
}
