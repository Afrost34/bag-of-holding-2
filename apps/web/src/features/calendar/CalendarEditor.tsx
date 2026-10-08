import { Button } from '@boh/ui';
import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Calendar } from '../../app/calendar/model';

/**
 * The calendar's make-up: its name, weekdays, months, moons, seasons and event categories, one
 * per line ("Name, days" and so on), and how years are written.
 */

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
const parts = (line: string) => line.split(',').map((p) => p.trim());
const number = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== '' ? n : fallback;
};
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'category';

export function CalendarEditor({
  calendar: cal,
  onSave,
  onClose,
}: {
  calendar: Calendar;
  onSave: (next: Calendar) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(cal.name);
  const [yearFormat, setYearFormat] = useState(cal.yearFormat);
  const [overflow, setOverflow] = useState(cal.overflow);
  const [weekdays, setWeekdays] = useState(cal.weekdays.join('\n'));
  const [months, setMonths] = useState(
    cal.months
      .map((m) => `${m.name}, ${String(m.days)}${m.intercalary ? ', festival' : ''}`)
      .join('\n'),
  );
  const [moons, setMoons] = useState(
    cal.moons
      .map((m) => `${m.name}, ${String(m.cycle)}, ${String(m.offset)}, ${m.color}`)
      .join('\n'),
  );
  const [seasons, setSeasons] = useState(
    cal.seasons.map((s) => `${s.name}, ${String(s.days)}, ${s.color}`).join('\n'),
  );
  const [categories, setCategories] = useState(
    cal.categories.map((c) => `${c.name}, ${c.color}`).join('\n'),
  );
  const [error, setError] = useState<string | null>(null);

  const build = (): Calendar | string => {
    const monthList = lines(months).map((l) => {
      const [n, d, f] = parts(l);
      return {
        name: n ?? 'Month',
        days: Math.max(1, Math.round(number(d, 30))),
        ...(f?.toLowerCase().startsWith('festival') ? { intercalary: true } : {}),
      };
    });
    if (monthList.length === 0) return 'A calendar needs at least one month.';
    const categoryList = lines(categories).map((l) => {
      const [n, c] = parts(l);
      const old = cal.categories.find((x) => x.name === n);
      return { id: old?.id ?? slug(n ?? ''), name: n ?? 'Category', color: c ?? '#6b7280' };
    });
    return {
      ...cal,
      name: name.trim() || cal.name,
      yearFormat: yearFormat.includes('{year}') ? yearFormat : `${yearFormat} {year}`,
      overflow,
      weekdays: lines(weekdays),
      months: monthList,
      moons: lines(moons).map((l) => {
        const [n, cycle, offset, color] = parts(l);
        return {
          name: n ?? 'Moon',
          cycle: Math.max(1, number(cycle, 30)),
          offset: number(offset, 0),
          color: color ?? '#e5e7eb',
        };
      }),
      seasons: lines(seasons).map((l) => {
        const [n, days, color] = parts(l);
        return {
          name: n ?? 'Season',
          days: Math.max(1, number(days, 90)),
          color: color ?? '#6b7280',
        };
      }),
      categories: categoryList,
      today: {
        ...cal.today,
        month: Math.min(cal.today.month, monthList.length - 1),
        day: Math.min(
          cal.today.day,
          monthList[Math.min(cal.today.month, monthList.length - 1)]?.days ?? 1,
        ),
      },
    };
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit calendar"
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
    >
      <form
        className="w-full max-w-2xl space-y-4 rounded-lg border border-border bg-surface p-5 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          const next = build();
          if (typeof next === 'string') setError(next);
          else onSave(next);
        }}
      >
        <div className="flex items-center">
          <h2 className="flex-1 font-serif text-xl font-bold">Edit calendar</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-sunken"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              className={inputClass}
            />
          </Field>
          <Field label="Years are written" hint="{year} is the number, e.g. Year {year}">
            <input
              value={yearFormat}
              onChange={(e) => {
                setYearFormat(e.target.value);
              }}
              className={inputClass}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={overflow}
            onChange={(e) => {
              setOverflow(e.target.checked);
            }}
          />
          Weeks run on from one month to the next (otherwise each month starts on the first weekday)
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Weekdays" hint="One per line">
            <textarea
              rows={7}
              value={weekdays}
              onChange={(e) => {
                setWeekdays(e.target.value);
              }}
              className={inputClass}
            />
          </Field>
          <Field label="Months" hint="Name, days (add “, festival” for days outside the week)">
            <textarea
              rows={7}
              value={months}
              onChange={(e) => {
                setMonths(e.target.value);
              }}
              className={inputClass}
            />
          </Field>
          <Field label="Moons" hint="Name, days per cycle, offset, colour">
            <textarea
              rows={3}
              value={moons}
              onChange={(e) => {
                setMoons(e.target.value);
              }}
              className={inputClass}
            />
          </Field>
          <Field label="Seasons" hint="Name, days, colour (from the first day of the year)">
            <textarea
              rows={3}
              value={seasons}
              onChange={(e) => {
                setSeasons(e.target.value);
              }}
              className={inputClass}
            />
          </Field>
          <Field label="Event categories" hint="Name, colour">
            <textarea
              rows={3}
              value={categories}
              onChange={(e) => {
                setCategories(e.target.value);
              }}
              className={inputClass}
            />
          </Field>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Save calendar
          </Button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  'w-full rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-sm';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {hint && <span className="block text-xs text-muted">{hint}</span>}
      {children}
    </label>
  );
}
