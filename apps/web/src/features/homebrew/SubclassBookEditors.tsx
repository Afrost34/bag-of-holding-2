import {
  ABILITY_IDS,
  bookToForm,
  emptyBook,
  emptySubclass,
  formToBook,
  formToSubclass,
  subclassToForm,
  type AbilityId,
  type BookChapterForm,
  type BookForm,
  type PackMeta,
  type RawEntity,
  type SubclassForm,
} from '@boh/data5e';
import { Entries } from '@boh/renderer';
import { Button } from '@boh/ui';
import { ArrowDown, ArrowUp, Plus, Table2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useListRows } from '../../app/data/lists';
import { ABILITY_NAMES } from './abilityNames';
import { FeatureList } from './FeatureList';
import { Grid, Section, Select, Text, TextArea } from './fields';
import { Layout } from './OptionEditors';

/**
 * Editors for homebrew subclasses (of any class, official or homebrew) and books (chapters of
 * sections, read in the Library like the official ones).
 */

export function SubclassEditor({
  pack,
  base,
  features: baseFeatures,
  classes: packClasses,
  onSave,
  onCancel,
}: {
  pack: PackMeta;
  base: RawEntity | null;
  features: readonly RawEntity[];
  /** The pack's own classes, offered first. */
  classes: readonly RawEntity[];
  onSave: (subclass: RawEntity, features: RawEntity[]) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SubclassForm>(() =>
    base ? subclassToForm(base, baseFeatures) : emptySubclass(),
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const rows = useListRows('classes');
  // Classes of the pack's rules (2024 or 2014), the pack's own first.
  const classOptions = useMemo(() => {
    const own = packClasses.map((c) => ({ name: String(c.name), source: pack.id }));
    const official = (rows ?? [])
      .filter((r) => r.edition === pack.edition && r.source.toLowerCase() !== pack.id.toLowerCase())
      .map((r) => ({ name: r.name, source: r.source }));
    const all = [...own, ...official];
    const current = form.className ? [{ name: form.className, source: form.classSource }] : [];
    return [...current, ...all].filter(
      (c, i, list) => list.findIndex((x) => x.name === c.name && x.source === c.source) === i,
    );
  }, [rows, packClasses, pack, form.className, form.classSource]);
  const { subclass, features } = formToSubclass(form, pack.edition, pack.id, base ?? {});
  const set = <K extends keyof SubclassForm>(key: K, value: SubclassForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };
  const classValue = form.className ? `${form.className}|${form.classSource}` : '';

  return (
    <Layout
      label="Subclass"
      problem={problem}
      saving={saving}
      onCancel={onCancel}
      onSave={() => {
        if (!form.name.trim()) {
          setProblem('Give the subclass a name.');
          return;
        }
        if (!form.className) {
          setProblem('Choose the class it belongs to.');
          return;
        }
        setSaving(true);
        void onSave(subclass, features).then((p) => {
          setProblem(p);
          setSaving(false);
        });
      }}
      preview={
        <div className="space-y-2 text-sm">
          <h3 className="font-serif text-lg font-bold">{form.name || 'New subclass'}</h3>
          {form.className && <p className="text-muted">{form.className} subclass</p>}
          {features.map((f) => (
            <section key={`${String(f.level)}-${String(f.name)}`}>
              <h4 className="font-serif font-bold">
                <span className="text-muted">Level {String(f.level)}: </span>
                {String(f.name)}
              </h4>
              <Entries entries={f.entries} />
            </section>
          ))}
        </div>
      }
    >
      <Section title="Basics">
        <Text
          label="Name"
          value={form.name}
          autoFocus
          onChange={(v) => {
            set('name', v);
          }}
        />
        <Grid>
          <Text
            label="Short name"
            value={form.shortName}
            placeholder={form.name || 'Desperado'}
            onChange={(v) => {
              set('shortName', v);
            }}
          />
          <Select
            label="Class"
            value={classValue}
            options={[
              { id: '', label: rows ? 'Choose a class' : 'Loading…' },
              ...classOptions.map((c) => ({
                id: `${c.name}|${c.source}`,
                label: c.source === pack.id ? `${c.name} (this pack)` : `${c.name} (${c.source})`,
              })),
            ]}
            onChange={(v) => {
              const [name = '', source = ''] = v.split('|');
              setForm((f) => ({ ...f, className: name, classSource: source }));
            }}
          />
        </Grid>
      </Section>
      <Section title="Spellcasting">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.caster}
            onChange={(e) => {
              set('caster', e.target.checked);
            }}
          />
          Casts spells (like the Eldritch Knight)
        </label>
        {form.caster && (
          <Select
            label="Spellcasting ability"
            value={form.spellAbility}
            options={ABILITY_IDS.map((a) => ({ id: a, label: ABILITY_NAMES[a] }))}
            onChange={(v) => {
              set('spellAbility', v as AbilityId);
            }}
          />
        )}
      </Section>
      <FeatureList
        features={form.features}
        firstLevel={3}
        onChange={(f) => {
          set('features', f);
        }}
      />
    </Layout>
  );
}

export function BookEditor({
  pack,
  base,
  bookData,
  onSave,
  onCancel,
}: {
  pack: PackMeta;
  base: RawEntity | null;
  bookData: RawEntity | undefined;
  onSave: (book: RawEntity, bookData: RawEntity) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<BookForm>(() =>
    base ? bookToForm(base, bookData) : { ...emptyBook(), author: pack.author },
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { book, bookData: text } = formToBook(form, pack.id, base ?? {});
  const setChapter = (i: number, patch: Partial<BookChapterForm>) => {
    setForm((f) => ({
      ...f,
      chapters: f.chapters.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    }));
  };
  const move = (i: number, by: -1 | 1) => {
    setForm((f) => {
      const chapters = [...f.chapters];
      const [c] = chapters.splice(i, 1);
      if (c) chapters.splice(Math.max(0, Math.min(chapters.length, i + by)), 0, c);
      return { ...f, chapters };
    });
  };

  return (
    <Layout
      label="Book"
      problem={problem}
      saving={saving}
      onCancel={onCancel}
      onSave={() => {
        if (!form.name.trim()) {
          setProblem('Give the book a title.');
          return;
        }
        setSaving(true);
        void onSave(book, text).then((p) => {
          setProblem(p);
          setSaving(false);
        });
      }}
      preview={
        <nav aria-label="Contents" className="space-y-2 text-sm">
          <h3 className="font-serif text-lg font-bold">{form.name || 'New book'}</h3>
          {form.description && <p className="text-muted">{form.description}</p>}
          <ol className="list-decimal space-y-1 pl-5">
            {form.chapters.map((c, i) => (
              <li key={i}>
                <span className="font-medium">{c.name || 'Chapter'}</span>
                {c.sections.some((s) => s.name) && (
                  <ul className="list-disc pl-4 text-muted">
                    {c.sections
                      .filter((s) => s.name)
                      .map((s, j) => (
                        <li key={j}>{s.name}</li>
                      ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </nav>
      }
    >
      <Section title="Book">
        <Text
          label="Title"
          value={form.name}
          autoFocus
          onChange={(v) => {
            setForm((f) => ({ ...f, name: v }));
          }}
        />
        <Grid>
          <Text
            label="Description"
            value={form.description}
            placeholder="Rules and lore for…"
            onChange={(v) => {
              setForm((f) => ({ ...f, description: v }));
            }}
          />
          <Text
            label="Author"
            value={form.author}
            onChange={(v) => {
              setForm((f) => ({ ...f, author: v }));
            }}
          />
        </Grid>
        <p className="text-xs text-muted">The pack’s cover is the book’s cover in the Library.</p>
      </Section>
      {form.chapters.map((c, i) => (
        <section
          key={i}
          aria-label={`Chapter ${String(i + 1)}`}
          className="space-y-2 rounded-lg border border-border p-3"
        >
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Text
                label={`Title of chapter ${String(i + 1)}`}
                value={c.name}
                onChange={(v) => {
                  setChapter(i, { name: v });
                }}
              />
            </div>
            <button
              type="button"
              aria-label={`Move chapter ${String(i + 1)} up`}
              disabled={i === 0}
              onClick={() => {
                move(i, -1);
              }}
              className="rounded p-1.5 text-muted hover:bg-sunken disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Move chapter ${String(i + 1)} down`}
              disabled={i === form.chapters.length - 1}
              onClick={() => {
                move(i, 1);
              }}
              className="rounded p-1.5 text-muted hover:bg-sunken disabled:opacity-30"
            >
              <ArrowDown className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Remove chapter ${String(i + 1)}`}
              onClick={() => {
                setForm((f) => ({ ...f, chapters: f.chapters.filter((_, j) => j !== i) }));
              }}
              className="rounded p-1.5 text-muted hover:bg-sunken"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <TextArea
            label={`Opening text of chapter ${String(i + 1)}`}
            hint="Paragraphs separated by a blank line; dice like 2d6 become rolls."
            value={c.text}
            onChange={(v) => {
              setChapter(i, { text: v });
            }}
          />
          {c.sections.map((s, j) => (
            <div key={j} className="ml-3 space-y-1 border-l-2 border-border pl-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Text
                    label={`Section ${String(j + 1)} of chapter ${String(i + 1)}`}
                    value={s.name}
                    placeholder={s.original && !s.name ? '(a table or box)' : 'Section title'}
                    onChange={(v) => {
                      setChapter(i, {
                        sections: c.sections.map((x, k) => (k === j ? { ...x, name: v } : x)),
                      });
                    }}
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Remove section ${String(j + 1)} of chapter ${String(i + 1)}`}
                  onClick={() => {
                    setChapter(i, { sections: c.sections.filter((_, k) => k !== j) });
                  }}
                  className="rounded p-1.5 text-muted hover:bg-sunken"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <TextArea
                label={`Text of section ${String(j + 1)} of chapter ${String(i + 1)}`}
                value={s.text}
                onChange={(v) => {
                  setChapter(i, {
                    sections: c.sections.map((x, k) => (k === j ? { ...x, text: v } : x)),
                  });
                }}
              />
              {s.original && (
                <p className="flex items-center gap-1 text-xs text-muted">
                  <Table2 className="h-3.5 w-3.5" aria-hidden /> Also has tables or lists, kept as
                  they are.
                </p>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setChapter(i, { sections: [...c.sections, { name: '', text: '' }] });
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> Add a section
          </Button>
        </section>
      ))}
      <Button
        type="button"
        onClick={() => {
          setForm((f) => ({
            ...f,
            chapters: [...f.chapters, { name: '', text: '', sections: [] }],
          }));
        }}
      >
        <Plus className="h-4 w-4" aria-hidden /> Add a chapter
      </Button>
    </Layout>
  );
}
