import { AppLink } from '../../app/AppLink';

export function NotFoundPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16 text-center">
      <div>
        <h1 className="font-serif text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-muted">This page doesn&apos;t exist, or it moved.</p>
        <AppLink to="/" className="mt-4 inline-block font-medium text-link hover:underline">
          Go home
        </AppLink>
      </div>
    </div>
  );
}
