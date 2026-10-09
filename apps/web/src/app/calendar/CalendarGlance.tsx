import { Button, cn } from '@boh/ui';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '../AppLink';
import {
  addDays,
  addMonths,
  eventsOn,
  formatDate,
  formatYear,
  monthWeeks,
  MOON_PHASES,
  moonPhase,
  sameDay,
  seasonOf,
  setToday,
  upcoming,
  type Calendar,
  type CalendarDate,
} from './model';
import { useCalendar } from './store';
import { DayEvents } from './DayEvents';

/**
 * The campaign's calendar at a glance, for a board card or the player window: today, the season
 * and moons, this month, and what comes in the next days. Players never see secret events.
 */
export function CalendarGlance({
  campaignId,
  calendar: given,
  forPlayers = false,
}: {
  campaignId: string | undefined;
  /** Sent by the DM's window (the player window shows it as it is now). */
  calendar?: Calendar;
  forPlayers?: boolean;
}) {
  const stored = useCalendar();
  const { loaded, load, reload, save, campaignId: loadedFor } = stored;
  const cal = given ?? stored.calendar;
  /** The month shown (today's unless browsed) and the day opened in it. */
  const [shift, setShift] = useState(0);
  const [picked, setPicked] = useState<CalendarDate | null>(null);
  useEffect(() => {
    if (campaignId) void load(campaignId);
  }, [campaignId, load]);
  // In the player window, a calendar card follows the file as the DM moves time on.
  useEffect(() => {
    if (!forPlayers || given) return;
    const t = setInterval(() => void reload(), 5000);
    return () => {
      clearInterval(t);
    };
  }, [forPlayers, given, reload]);
  if (!campaignId) return <p className="text-muted">Calendars belong to campaigns.</p>;
  if (!given && (!loaded || loadedFor !== campaignId))
    return <p className="text-muted">Loading…</p>;
  if (!cal)
    return (
      <p className="text-muted">
        No calendar yet.{' '}
        {!forPlayers && (
          <AppLink to="/calendar" className="text-link hover:underline">
            Start one
          </AppLink>
        )}
      </p>
    );
  const today = cal.today;
  const season = seasonOf(cal, today);
  const shown = addMonths(cal, { ...today, day: 1 }, shift);
  const weeks = monthWeeks(cal, shown.year, shown.month);
  const browse = (by: number) => {
    setShift(shift + by);
    setPicked(null);
  };
  const coming = upcoming(cal, today, 30).filter((u) => !forPlayers || !u.event.secret);
  const color = (id: string | undefined) => cal.categories.find((c) => c.id === id)?.color;
  return (
    <div className={cn('space-y-3', forPlayers ? 'text-lg' : 'text-sm')}>
      <div>
        <p className={cn('font-serif font-bold', forPlayers ? 'text-3xl' : 'text-base')}>
          {formatDate(cal, today)}
        </p>
        <p className="text-muted">
          {[
            season?.name,
            ...cal.moons.map((m) => `${m.name}: ${MOON_PHASES[moonPhase(cal, m, today)] ?? ''}`),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <table className="w-full table-fixed border-collapse text-center text-xs">
        <caption className="pb-1 text-left font-semibold">
          <span className="flex items-center gap-1">
            <span className="flex-1">
              {cal.months[shown.month]?.name} · {formatYear(cal, shown.year)}
            </span>
            {shift !== 0 && (
              <button
                type="button"
                onClick={() => {
                  browse(-shift);
                }}
                className="rounded px-1.5 text-xs font-normal text-link hover:underline"
              >
                This month
              </button>
            )}
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => {
                browse(-1);
              }}
              className="rounded p-0.5 text-muted hover:bg-sunken hover:text-text"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => {
                browse(1);
              }}
              className="rounded p-0.5 text-muted hover:bg-sunken hover:text-text"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </span>
        </caption>
        <tbody>
          {weeks.map((row, i) => (
            <tr key={i}>
              {row.map((day, j) => {
                if (day === null) return <td key={j} />;
                const date = { year: shown.year, month: shown.month, day };
                const events = eventsOn(cal, date).filter((e) => !forPlayers || !e.secret);
                const open = picked !== null && sameDay(date, picked);
                return (
                  <td key={j} className="p-px">
                    <button
                      type="button"
                      aria-label={formatDate(cal, date)}
                      aria-pressed={open}
                      title={events.map((e) => e.name).join(', ') || undefined}
                      onClick={() => {
                        setPicked(open ? null : date);
                      }}
                      className={cn(
                        'flex h-6 w-full flex-col items-center justify-center rounded hover:bg-sunken',
                        sameDay(date, today) &&
                          'bg-accent font-bold text-accent-fg hover:bg-accent',
                        open && 'ring-2 ring-accent',
                      )}
                    >
                      {day}
                      {events.length > 0 && (
                        <span
                          aria-hidden
                          className="h-1 w-1 rounded-full"
                          style={{ backgroundColor: color(events[0]?.category) ?? 'currentColor' }}
                        />
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {picked && (
        <DayEvents
          cal={cal}
          date={picked}
          forPlayers={forPlayers}
          {...(given ? {} : { save })}
          onClose={() => {
            setPicked(null);
          }}
        />
      )}
      <section aria-label="Coming up">
        <h4 className="font-semibold">Coming up</h4>
        {coming.length === 0 ? (
          <p className="text-muted">Nothing in the next days.</p>
        ) : (
          <ul className="space-y-0.5">
            {coming.slice(0, 6).map(({ date, event }) => (
              <li key={event.id} className="flex gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color(event.category) ?? 'currentColor' }}
                />
                <span className="min-w-0 flex-1">
                  {event.name}
                  <span className="text-muted">
                    {' '}
                    — {sameDay(date, today) ? 'today' : formatDate(cal, date, false)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {!forPlayers && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
          <Button
            variant="ghost"
            onClick={() => {
              save(setToday(cal, addDays(cal, today, 1)));
            }}
          >
            Next day
          </Button>
          <AppLink
            to="/calendar"
            className="ml-auto inline-flex items-center gap-1 text-xs text-link hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open the calendar
          </AppLink>
        </div>
      )}
    </div>
  );
}
