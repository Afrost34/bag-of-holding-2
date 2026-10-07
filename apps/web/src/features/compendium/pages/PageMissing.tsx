import { AppLink } from '../../../app/AppLink';

/** The entry is not in the installed data (or its source was removed). */
export function PageMissing() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-serif text-2xl font-bold">Not found</h1>
      <p className="mt-2 text-muted">
        This entry is not in your data. Its source may be turned off or removed in an update.
      </p>
      <AppLink
        to="/settings/data"
        className="mt-4 inline-block font-medium text-link hover:underline"
      >
        Data & sources
      </AppLink>
    </div>
  );
}
