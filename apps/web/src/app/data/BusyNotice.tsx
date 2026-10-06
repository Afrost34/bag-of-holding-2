import { Copy } from 'lucide-react';

/**
 * Shown when another tab or window of the app owns the 5etools database. The data reappears here
 * automatically once that one is closed.
 */
export function BusyNotice() {
  return (
    <div role="status" className="flex items-start gap-3 rounded-md bg-sunken p-3 text-sm">
      <Copy className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden />
      <p>
        <span className="block font-medium">Bag of Holding is open in another tab or window.</span>
        <span className="block text-muted">
          The 5etools data can only be used in one place at a time. Close the other one and it will
          appear here by itself. Tip: use the tabs inside the app instead of browser tabs.
        </span>
      </p>
    </div>
  );
}
