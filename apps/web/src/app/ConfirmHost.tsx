import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@boh/ui';
import { answer, useConfirm } from './confirm';

/** Shows the question `askConfirm` asks (mounted once by the shell). */
export function ConfirmHost() {
  const pending = useConfirm((s) => s.pending);
  return (
    <Dialog.Root
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) answer(false);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50" />
        <Dialog.Content
          role="alertdialog"
          className="fixed top-1/2 left-1/2 z-[60] w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 space-y-3 rounded-lg border border-border bg-surface p-4 shadow-xl"
        >
          <Dialog.Title className="font-serif text-lg font-bold">{pending?.title}</Dialog.Title>
          {pending?.message ? (
            <Dialog.Description className="text-sm text-muted">
              {pending.message}
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">Confirm or cancel.</Dialog.Description>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                answer(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              autoFocus
              onClick={() => {
                answer(true);
              }}
            >
              {pending?.confirmLabel ?? 'OK'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
