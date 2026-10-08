import { parseFrontmatter, removeProperty, setProperty } from '@boh/journal';
import { Button, cn } from '@boh/ui';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MonitorUp,
  Moon as MoonIcon,
  NotebookPen,
  Pencil,
  Pin,
  Plus,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppLink } from '../../app/AppLink';
import {
  addDays,
  addEvent,
  addMonths,
  dayNumber,
  DATE_PROPERTY,
  eventsOn,
  formatDate,
  formatYear,
  fromCalendarium,
  gameDateValue,
  monthWeeks,
  MOON_PHASES,
  moonEvent,
  moonPhase,
  newCalendar,
  parseGameDate,
  removeEvent,
  sameDay,
  seasonOf,
  setToday,
  updateEvent,
  type Calendar,
  type CalendarDate,
  type CalendarEvent,
} from '../../app/calendar/model';
import { sendToPlayers } from '../../app/boards/player';
import { useCalendar } from '../../app/calendar/store';
import { useActiveCampaign } from '../../app/campaigns/store';
import { notePagePath } from '../../app/journal/paths';
import { useJournal } from '../../app/journal/store';
import { usePageTitle } from '../../app/tabs/usePageTitle';
import { CalendarEditor } from './CalendarEditor';

const noteName = (path: string) => path.split('/').pop()?.replace(/\.md$/i, '') ?? path;

/** The campaign's notes pinned to a day by their `in_game_date` property. */
function useDatedNotes(): { path: string; date: CalendarDate }[] {
  const notes = useJournal((s) => s.notes);
  return useMemo(() => {
    const out: { path: string; date: CalendarDate }[] = [];
    for (const [path, text] of notes) {
      const date = parseGameDate(parseFrontmatter(text).data[DATE_PROPERTY]);
      if (date) out.push({ path, date });
    }
    return out;
  }, [notes]);
}

/** The campaign's calendar: today in the world, the months with their events and notes. */
export function CalendarPage() {
  usePageTitle('Calendar');
  const campaign = useActiveCampaign();
  const { calendar, loaded, load, save, campaignId } = useCalendar();
  const journal = useJournal();
  useEffect(() => {
    if (campaign) void load(campaign.id);
  }, [campaign, load]);
  useEffect(() => {
    if (campaign && journal.campaignId !== campaign.id) void journal.load(campaign.id);
  }, [campaign, journal]);

  if (!campaign) return <p className="p-8 text-muted">Open a campaign to see its calendar.</p>;
  if (!loaded || campaignId !== campaign.id) return <p className="p-8 text-muted">Loading…</p>;
  if (!calendar) return <StartCalendar campaignName={campaign.name} onStart={save} />;
  return <CalendarView calendar={calendar} campaignId={campaign.id} save={save} />;
}

function StartCalendar({
  campaignName,
  onStart,
}: {
  campaignName: string;
  onStart: (c: Calendar) => void;
}) {
  const notes = useJournal((s) => s.notes);
  const [error, setError] = useState<string | null>(null);
  const importFile = async (file: File) => {
    try {
      const paths = [...notes.keys()];
      // A vault path (`08_Adventures/Act_I_Timeline.md`) → the journal note of that name.
      const notePath = (vault: string) => {
        const name = noteName(vault).replace(/_/g, ' ').toLowerCase();
        return paths.find((p) => noteName(p).replace(/_/g, ' ').toLowerCase() === name) ?? null;
      };
      const cal = fromCalendarium(JSON.parse(await file.text()), notePath);
      if (cal) onStart(cal);
      else setError(`${file.name} has no Calendarium calendar.`);
    } catch {
      setError(`${file.name} is not a Calendarium data file.`);
    }
  };
  return (
    <div className="mx-auto max-w-xl px-4 py-10 text-center">
      <CalendarDays className="mx-auto mb-3 h-10 w-10 text-accent-ink" aria-hidden />
      <h1 className="mb-2 font-serif text-2xl font-bold">A calendar for {campaignName}</h1>
      <p className="mb-6 text-muted">
        Track the in-game date, the world&apos;s festivals and what happened on which day.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          variant="primary"
          onClick={() => {
            onStart(newCalendar(`Calendar of ${campaignName}`));
          }}
        >
          Start a calendar
        </Button>
        <label className="inline-flex cursor-pointer items-center rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-sunken">
          Import from Calendarium…
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Calendarium data file"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file);
            }}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const PHASE_GLYPHS = ['●', '◔', '◑', '◕', '○', '◕', '◑', '◔'];

function CalendarView({
  calendar: cal,
  campaignId,
  save,
}: {
  calendar: Calendar;
  campaignId: string;
  save: (c: Calendar) => void;
}) {
  // Shown in the player window: it follows the calendar as time moves on.

  const [shown, setShown] = useState({ year: cal.today.year, month: cal.today.month });
  const [selected, setSelected] = useState<CalendarDate>(cal.today);
  const [editing, setEditing] = useState(false);
  const dated = useDatedNotes();
  const season = seasonOf(cal, cal.today);
  const week = Math.max(1, cal.weekdays.length);
  const move = (date: CalendarDate) => {
    save(setToday(cal, date));
    setShown({ year: date.year, month: date.month });
    setSelected(date);
  };
  const go = (months: number) => {
    const d = addMonths(cal, { ...shown, day: 1 }, months);
    setShown({ year: d.year, month: d.month });
  };
  const weeks = monthWeeks(cal, shown.year, shown.month);
  const color = (id: string | undefined) => cal.categories.find((c) => c.id === id)?.color;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
      <header className="mb-4 flex flex-wrap items-center gap-3 border-b-2 border-accent pb-3">
        <h1 className="min-w-0 flex-1 font-serif text-2xl font-bold">{cal.name}</h1>
        <Button
          variant="ghost"
          onClick={() => {
            void sendToPlayers([{ kind: 'calendar' }], campaignId);
          }}
        >
          <MonitorUp className="h-4 w-4" aria-hidden /> Send to players
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setEditing(true);
          }}
        >
          <Settings2 className="h-4 w-4" aria-hidden /> Edit calendar
        </Button>
      </header>
      {editing && (
        <CalendarEditor
          calendar={cal}
          onSave={(next) => {
            save(next);
            setEditing(false);
          }}
          onClose={() => {
            setEditing(false);
          }}
        />
      )}

      <section
        aria-label="Today"
        className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border bg-surface-2 p-4"
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Today</p>
          <p className="font-serif text-xl font-bold">{formatDate(cal, cal.today)}</p>
          <p className="flex flex-wrap gap-x-3 text-sm text-muted">
            {season && <span>{season.name}</span>}
            {cal.moons.map((m) => {
              const phase = moonPhase(cal, m, cal.today);
              return (
                <span key={m.name} title={`${m.name}: ${MOON_PHASES[phase] ?? ''}`}>
                  <span aria-hidden>{PHASE_GLYPHS[phase]}</span> {m.name}: {MOON_PHASES[phase]}
                </span>
              );
            })}
          </p>
        </div>
        <div role="group" aria-label="Move time" className="ml-auto flex flex-wrap gap-1.5">
          <Button
            variant="ghost"
            onClick={() => {
              move(addDays(cal, cal.today, -1));
            }}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> A day back
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              move(addDays(cal, cal.today, 1));
            }}
          >
            Next day
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              move(addDays(cal, cal.today, week));
            }}
          >
            +1 week
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              move(addMonths(cal, cal.today, 1));
            }}
          >
            +1 month
          </Button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Month">
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => {
                go(-1);
              }}
              className="rounded p-1.5 hover:bg-sunken"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <h2 className="flex-1 text-center font-serif text-lg font-bold">
              {cal.months[shown.month]?.name} · {formatYear(cal, shown.year)}
            </h2>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => {
                go(1);
              }}
              className="rounded p-1.5 hover:bg-sunken"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="overflow-x-auto">
            <div
              className="grid border-t border-l border-border text-sm"
              style={{ gridTemplateColumns: 'repeat(' + String(week) + ', minmax(0, 1fr))' }}
            >
              {!cal.months[shown.month]?.intercalary && (
                <>
                  {cal.weekdays.map((w) => (
                    <div
                      key={w}
                      className="truncate border-r border-b border-border px-1 py-1 text-center text-[11px] font-semibold tracking-wide text-muted uppercase"
                    >
                      {w}
                    </div>
                  ))}
                </>
              )}
              {weeks.flatMap((row, i) =>
                row.map((day, j) => {
                  if (day === null)
                    return (
                      <div
                        key={String(i) + '-' + String(j)}
                        className="border-r border-b border-border"
                      />
                    );
                  const date = { ...shown, day };
                  const events = eventsOn(cal, date);
                  const notes = dated.filter((n) => sameDay(n.date, date));
                  const isToday = sameDay(date, cal.today);
                  const isSelected = sameDay(date, selected);
                  const moons = cal.moons.filter((m) => moonEvent(cal, m, date) !== null);
                  return (
                    <div
                      key={String(i) + '-' + String(j)}
                      className="border-r border-b border-border"
                    >
                      <button
                        type="button"
                        aria-label={formatDate(cal, date)}
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelected(date);
                        }}
                        className={cn(
                          'flex h-full min-h-14 w-full flex-col gap-0.5 overflow-hidden p-0.5 text-left hover:bg-sunken sm:min-h-20 sm:p-1',
                          isSelected && 'bg-accent-soft',
                        )}
                      >
                        <span className="flex items-center gap-1">
                          <span
                            className={cn(
                              'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold',
                              isToday && 'bg-accent text-accent-fg',
                            )}
                          >
                            {day}
                          </span>
                          {moons.map((m) => (
                            <span key={m.name} aria-hidden title={m.name} className="text-xs">
                              {moonEvent(cal, m, date) === 'new' ? '●' : '○'}
                            </span>
                          ))}
                        </span>
                        {events.slice(0, 3).map((e) => (
                          <span
                            key={e.id}
                            className="truncate border-l-4 pl-1 text-[11px] leading-tight"
                            style={{ borderColor: color(e.category) ?? 'currentColor' }}
                          >
                            {e.name}
                          </span>
                        ))}
                        {notes.slice(0, 2).map((n) => (
                          <span key={n.path} className="truncate text-[11px] text-muted">
                            <NotebookPen className="mr-0.5 inline h-3 w-3" aria-hidden />
                            {noteName(n.path)}
                          </span>
                        ))}
                        {events.length + notes.length > 5 && (
                          <span className="text-[11px] text-muted">
                            +{events.length + notes.length - 5} more
                          </span>
                        )}
                      </button>
                    </div>
                  );
                }),
              )}
            </div>
          </div>
        </section>

        <DayPanel
          calendar={cal}
          date={selected}
          notes={dated.filter((n) => sameDay(n.date, selected)).map((n) => n.path)}
          save={save}
          onToday={() => {
            move(selected);
          }}
        />
      </div>
    </div>
  );
}

function DayPanel({
  calendar: cal,
  date,
  notes,
  save,
  onToday,
}: {
  calendar: Calendar;
  date: CalendarDate;
  notes: string[];
  save: (c: Calendar) => void;
  onToday: () => void;
}) {
  const journal = useJournal();
  const [form, setForm] = useState<CalendarEvent | 'new' | null>(null);
  const [pin, setPin] = useState('');
  const events = eventsOn(cal, date);
  const season = seasonOf(cal, date);
  const allNotes = [...journal.notes.keys()].sort((a, b) =>
    noteName(a).localeCompare(noteName(b), 'en'),
  );
  const pinNote = (path: string, value: string | null) => {
    const text = journal.notes.get(path);
    if (text === undefined) return;
    journal.setText(
      path,
      value === null
        ? removeProperty(text, DATE_PROPERTY)
        : setProperty(text, DATE_PROPERTY, value),
    );
  };
  return (
    <aside aria-label="Day" className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <div>
        <h2 className="font-serif text-lg font-bold">{formatDate(cal, date)}</h2>
        <p className="text-sm text-muted">
          {season?.name}
          {cal.moons.map((m) => (
            <span key={m.name} className="ml-2">
              <MoonIcon className="inline h-3 w-3" aria-hidden /> {m.name}:{' '}
              {MOON_PHASES[moonPhase(cal, m, date)]}
            </span>
          ))}
        </p>
        {!sameDay(date, cal.today) && (
          <Button variant="ghost" onClick={onToday}>
            Make it today
          </Button>
        )}
      </div>

      <PanelSection title="Events">
        {events.length === 0 && <p className="text-sm text-muted">Nothing on this day.</p>}
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="text-sm">
              <div className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      cal.categories.find((c) => c.id === e.category)?.color ?? 'currentColor',
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{e.name}</span>
                  {e.secret && <span className="ml-1 text-xs text-muted">(secret)</span>}
                  {e.date.year === undefined && (
                    <span className="ml-1 text-xs text-muted">(every year)</span>
                  )}
                  {e.description && <span className="block text-muted">{e.description}</span>}
                  {e.note && (
                    <AppLink
                      to={notePagePath(e.note, journal.notes.get(e.note))}
                      className="block text-link hover:underline"
                    >
                      {noteName(e.note)}
                    </AppLink>
                  )}
                </span>
                <button
                  type="button"
                  aria-label={`Edit ${e.name}`}
                  onClick={() => {
                    setForm(e);
                  }}
                  className="rounded p-1 text-muted hover:bg-sunken"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${e.name}`}
                  onClick={() => {
                    save(removeEvent(cal, e.id));
                  }}
                  className="rounded p-1 text-muted hover:bg-sunken"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {form ? (
          <EventForm
            key={form === 'new' ? 'new' : form.id}
            calendar={cal}
            date={date}
            event={form === 'new' ? null : form}
            notes={allNotes}
            onSave={(e) => {
              save(form === 'new' ? addEvent(cal, e) : updateEvent(cal, form.id, e));
              setForm(null);
            }}
            onCancel={() => {
              setForm(null);
            }}
          />
        ) : (
          <Button
            variant="ghost"
            onClick={() => {
              setForm('new');
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> Add an event
          </Button>
        )}
      </PanelSection>

      <PanelSection title="Notes on this day">
        {notes.length === 0 && <p className="text-sm text-muted">No note pinned here.</p>}
        <ul className="space-y-1">
          {notes.map((path) => (
            <li key={path} className="flex items-center gap-2 text-sm">
              <AppLink
                to={notePagePath(path, journal.notes.get(path))}
                className="min-w-0 flex-1 truncate text-link hover:underline"
              >
                {noteName(path)}
              </AppLink>
              <button
                type="button"
                aria-label={`Unpin ${noteName(path)}`}
                onClick={() => {
                  pinNote(path, null);
                }}
                className="rounded p-1 text-muted hover:bg-sunken"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <select
            value={pin}
            aria-label="Note to pin"
            onChange={(e) => {
              setPin(e.target.value);
            }}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">Pin a note to this day…</option>
            {allNotes.map((p) => (
              <option key={p} value={p}>
                {noteName(p)}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            disabled={!pin}
            onClick={() => {
              pinNote(pin, gameDateValue(date));
              setPin('');
            }}
          >
            <Pin className="h-4 w-4" aria-hidden /> Pin
          </Button>
        </div>
      </PanelSection>
    </aside>
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2 border-t border-border pt-3">
      <h3 className="font-serif text-sm font-bold tracking-wide text-accent-ink uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

const inputClass = 'w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm';

function EventForm({
  calendar: cal,
  date,
  event,
  notes,
  onSave,
  onCancel,
}: {
  calendar: Calendar;
  date: CalendarDate;
  event: CalendarEvent | null;
  notes: string[];
  onSave: (e: Omit<CalendarEvent, 'id'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(event?.name ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [category, setCategory] = useState(event?.category ?? cal.categories[0]?.id ?? '');
  const [yearly, setYearly] = useState(event ? event.date.year === undefined : false);
  const [secret, setSecret] = useState(event?.secret ?? false);
  const [note, setNote] = useState(event?.note ?? '');
  const [days, setDays] = useState(() =>
    event?.end ? Math.max(1, dayDiff(cal, event, event.end) + 1) : 1,
  );
  const start = event ? { year: event.date.year ?? date.year, ...event.date } : date;
  return (
    <form
      aria-label={event ? `Edit ${event.name}` : 'New event'}
      className="space-y-2 rounded-md border border-border bg-surface-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const end = days > 1 ? addDays(cal, start, days - 1) : null;
        onSave({
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          date: {
            ...(yearly ? {} : { year: start.year }),
            month: start.month,
            day: start.day,
          },
          ...(end ? { end } : {}),
          ...(category ? { category } : {}),
          ...(note ? { note } : {}),
          ...(secret ? { secret: true } : {}),
        });
      }}
    >
      <label className="block text-sm">
        <span className="font-medium">Name</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Description</span>
        <textarea
          value={description}
          rows={2}
          onChange={(e) => {
            setDescription(e.target.value);
          }}
          className={inputClass}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          <span className="font-medium">Category</span>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
            }}
            className={inputClass}
          >
            <option value="">None</option>
            {cal.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Lasts (days)</span>
          <input
            type="number"
            min={1}
            value={days}
            onChange={(e) => {
              setDays(Math.max(1, Number(e.target.value) || 1));
            }}
            className={inputClass}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium">Journal note</span>
        <select
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
          }}
          className={inputClass}
        >
          <option value="">None</option>
          {notes.map((p) => (
            <option key={p} value={p}>
              {noteName(p)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={yearly}
          onChange={(e) => {
            setYearly(e.target.checked);
          }}
        />
        Every year
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={secret}
          onChange={(e) => {
            setSecret(e.target.checked);
          }}
        />
        Secret (not shown to players)
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit">
          Save event
        </Button>
      </div>
    </form>
  );
}

function dayDiff(cal: Calendar, event: CalendarEvent, end: CalendarDate): number {
  const start = { year: event.date.year ?? end.year, month: event.date.month, day: event.date.day };
  return dayNumber(cal, end) - dayNumber(cal, start);
}
