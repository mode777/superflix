export type ToastKind = 'info' | 'success' | 'error';

export interface ToastMessage {
  id: number;
  message: string;
  kind: ToastKind;
}

type Listener = (toasts: ToastMessage[]) => void;

let nextId = 1;
let toasts: ToastMessage[] = [];
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener(toasts);
}

export function showToast(
  message: string,
  options: { kind?: ToastKind; durationMs?: number } = {},
): void {
  const id = nextId++;
  const toast: ToastMessage = { id, message, kind: options.kind ?? 'info' };
  toasts = [...toasts, toast];
  emit();

  window.setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== id);
    emit();
  }, options.durationMs ?? 4000);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}
