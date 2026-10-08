import { Button, cn } from '@boh/ui';
import { ExternalLink } from 'lucide-react';
import { useEffect } from 'react';
import { AppLink } from '../AppLink';
import {
  addDays,
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
} from './model';
import { useCalendar } from './store';

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
  const weeks = monthWeeks(cal, today.year, today.month);
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
          {cal.months[today.month]?.name} · {formatYear(cal, today.year)}
        </caption>
        <tbody>
          {weeks.map((row, i) => (
            <tr key={i}>
              {row.map((day, j) => {
                if (day === null) return <td key={j} />;
                const date = { ...today, day };
                const events = eventsOn(cal, date).filter((e) => !forPlayers || !e.secret);
                return (
                  <td key={j} className="p-px">
                    <span
                      title={events.map((e) => e.name).join(', ') || undefined}
                      className={cn(
                        'flex h-6 flex-col items-center justify-center rounded',
                        sameDay(date, today) && 'bg-accent font-bold text-accent-fg',
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
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
