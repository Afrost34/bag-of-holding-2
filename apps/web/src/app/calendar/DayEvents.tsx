import { Button } from '@boh/ui';
import { EyeOff, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { askConfirm } from '../confirm';
import {
  addEvent,
  eventsOn,
  formatDate,
  removeEvent,
  sameDay,
  setToday,
  type Calendar,
  type CalendarDate,
} from './model';

const field = 'rounded border border-border bg-surface px-2 py-1 text-sm text-text';

/**
 * A day opened on the calendar card: what happens then and, for the DM (`save`), a quick way to
 * add an event, remove one, or make it today. Players never see secret events.
 */
export function DayEvents({
  cal,
  date,
  forPlayers,
  save,
  onClose,
}: {
  cal: Calendar;
  date: CalendarDate;
  forPlayers: boolean;
  /** Absent where the calendar is only shown (the player window). */
  save?: (cal: Calendar) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [secret, setSecret] = useState(false);
  const events = eventsOn(cal, date).filter((e) => !forPlayers || !e.secret);
  const edit = save && !forPlayers ? save : undefined;
  const color = (id: string | undefined) => cal.categories.find((c) => c.id === id)?.color;
  const add = () => {
    if (!edit || !name.trim()) return;
    edit(
      addEvent(cal, {
        name: name.trim(),
        date: { year: date.year, month: date.month, day: date.day },
        ...(category ? { category } : {}),
        ...(secret ? { secret: true } : {}),
      }),
    );
    setName('');
    setSecret(false);
  };
  return (
    <section aria-label="Day" className="space-y-2 rounded-md bg-sunken p-2">
      <div className="flex items-center gap-2">
        <h4 className="flex-1 font-semibold">{formatDate(cal, date)}</h4>
        {edit && !sameDay(date, cal.today) && (
          <Button
            variant="ghost"
            onClick={() => {
              edit(setToday(cal, date));
            }}
          >
            Make today
          </Button>
        )}
        <button
          type="button"
          aria-label="Close the day"
          onClick={onClose}
          className="rounded p-1 text-muted hover:bg-surface hover:text-text"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {events.length === 0 ? (
        <p className="text-muted">Nothing on this day.</p>
      ) : (
        <ul className="space-y-1">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color(e.category) ?? 'currentColor' }}
              />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{e.name}</span>
                {e.secret && (
                  <EyeOff
                    className="ml-1 inline h-3.5 w-3.5 text-muted"
                    aria-label="Kept from the players"
                  />
                )}
                {e.description && <span className="block text-muted">{e.description}</span>}
              </span>
              {edit && (
                <button
                  type="button"
                  aria-label={`Remove ${e.name}`}
                  onClick={() => {
                    void askConfirm({
                      title: `Remove “${e.name}”?`,
                      ...(e.date.year === undefined
                        ? { message: 'It comes every year: it goes from every year.' }
                        : {}),
                      confirmLabel: 'Remove',
                    }).then((ok) => {
                      if (ok) edit(removeEvent(cal, e.id));
                    });
                  }}
                  className="rounded p-1 text-muted hover:bg-surface hover:text-text"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {edit && (
        <form
          aria-label="New event"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            value={name}
            aria-label="Event name"
            placeholder="New event…"
            onChange={(e) => {
              setName(e.target.value);
            }}
            className={`${field} min-w-0 flex-1`}
          />
          {cal.categories.length > 0 && (
            <select
              aria-label="Event category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
              }}
              className={field}
            >
              <option value="">No category</option>
              {cal.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={secret}
              onChange={(e) => {
                setSecret(e.target.checked);
              }}
            />
            Secret
          </label>
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            Add
          </Button>
        </form>
      )}
    </section>
  );
}
