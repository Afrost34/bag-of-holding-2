import { moduleForPath } from '../../app/nav';

export interface ModulePlaceholderProps {
  path: string;
}

/** Stand-in page for a module that a later milestone builds. */
export function ModulePlaceholder({ path }: ModulePlaceholderProps) {
  const module = moduleForPath(path);
  if (!module) return null;
  const Icon = module.icon;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon className="h-8 w-8" aria-hidden />
        </span>
        <h1 className="mt-4 font-serif text-2xl font-bold">{module.label}</h1>
        <p className="mt-2 text-muted">{module.description}</p>
        {module.milestone !== undefined && (
          <p className="mt-4 inline-block rounded-md bg-sunken px-3 py-1 text-sm font-medium text-muted">
            Planned for milestone {module.milestone}
          </p>
        )}
      </div>
    </div>
  );
}
