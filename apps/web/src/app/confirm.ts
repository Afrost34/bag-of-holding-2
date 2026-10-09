import { create } from 'zustand';

/**
 * Questions asked before something that cannot be undone, inside the app (never the browser's
 * own pop-up). `askConfirm` resolves to true when the user agrees; `ConfirmHost`, mounted once
 * by the shell, shows the question.
 */

export interface ConfirmRequest {
  /** The question ("Delete Clive?"). */
  title: string;
  /** What follows, if more needs saying. */
  message?: string;
  /** The button that agrees ("Delete"); "OK" by default. */
  confirmLabel?: string;
}

interface Pending extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

export const useConfirm = create<{ pending: Pending | null }>()(() => ({ pending: null }));

export function askConfirm(request: ConfirmRequest): Promise<boolean> {
  // A question still open is answered "no" by a new one.
  useConfirm.getState().pending?.resolve(false);
  return new Promise((resolve) => {
    useConfirm.setState({ pending: { ...request, resolve } });
  });
}

export function answer(ok: boolean) {
  const pending = useConfirm.getState().pending;
  useConfirm.setState({ pending: null });
  pending?.resolve(ok);
}
