import type { RawEntity } from '../identity';
import { richEntries, richText, type RichText } from './text';

/**
 * Homebrew books: chapters of sections, written as 5etools `book` (contents) and `bookData`
 * (text) in the pack, so the Library lists them and the reader shows them like official books.
 */

export interface BookSectionForm extends RichText {
  name: string;
}

export interface BookChapterForm extends RichText {
  name: string;
  sections: BookSectionForm[];
}

export interface BookForm {
  name: string;
  /** Used in links; made from the name when new. */
  id: string;
  /** Shown under the title in the Library ("Rules and lore for the Gunslinger"). */
  description: string;
  author: string;
  chapters: BookChapterForm[];
}

export const emptyBook = (): BookForm => ({
  name: '',
  id: '',
  description: '',
  author: '',
  chapters: [{ name: '', text: '', sections: [] }],
});

const isObj = (v: unknown): v is RawEntity =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** `The Gunslinger's Guide` → `TheGunslingersGuide`. */
export function bookIdFor(name: string): string {
  return (
    name
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('')
      .slice(0, 32) || 'Book'
  );
}

/** The book's contents and its text. */
export function formToBook(
  form: BookForm,
  source: string,
  base: RawEntity = {},
): { book: RawEntity; bookData: RawEntity } {
  const id = form.id.trim() || bookIdFor(form.name);
  const chapters = form.chapters.filter((c) => c.name.trim() || c.text.trim() || c.sections.length);
  return {
    book: {
      ...base,
      name: form.name.trim(),
      id,
      source,
      group: 'homebrew',
      ...(form.author.trim() ? { author: form.author.trim() } : {}),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      contents: chapters.map((c) => ({
        name: c.name.trim() || 'Chapter',
        headers: c.sections.filter((s) => s.name.trim()).map((s) => s.name.trim()),
      })),
    },
    bookData: {
      id,
      source,
      data: chapters.map((c) => ({
        type: 'section',
        name: c.name.trim() || 'Chapter',
        entries: [
          ...richEntries(c),
          // A section without a name is a block between sections (a table, a box): as it is.
          ...c.sections
            .filter((s) => s.name.trim() || s.text.trim() || s.original)
            .flatMap((s) =>
              s.name.trim()
                ? [{ type: 'entries', name: s.name.trim(), entries: richEntries(s) }]
                : richEntries(s),
            ),
        ],
      })),
    },
  };
}

export function bookToForm(book: RawEntity, bookData: RawEntity | undefined): BookForm {
  const data = Array.isArray(bookData?.data) ? (bookData.data as unknown[]) : [];
  return {
    name: text(book.name),
    id: text(book.id),
    description: text(book.description),
    author: text(book.author),
    chapters: data.filter(isObj).map((chapter) => {
      const entries = Array.isArray(chapter.entries) ? (chapter.entries as unknown[]) : [];
      // Named `entries` blocks are its sections; everything before the first is the chapter's
      // own text.
      const first = entries.findIndex((e) => isObj(e) && e.type === 'entries' && text(e.name));
      const own = first < 0 ? entries : entries.slice(0, first);
      const rest = first < 0 ? [] : entries.slice(first);
      return {
        name: text(chapter.name),
        ...richText(own),
        sections: rest.map((e) =>
          isObj(e) && e.type === 'entries' && text(e.name)
            ? { name: text(e.name), ...richText(e.entries) }
            : { name: '', ...richText([e]) },
        ),
      };
    }),
  };
}
