import { Injectable, signal } from '@angular/core';

export type ToastKind = 'ok' | 'error';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal('');
  readonly kind = signal<ToastKind>('ok');
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(message: string, kind: ToastKind = 'ok', ms = 2800) {
    if (this.timer) clearTimeout(this.timer);
    this.message.set(message);
    this.kind.set(kind);
    this.timer = setTimeout(() => {
      this.message.set('');
      this.timer = null;
    }, ms);
  }

  ok(message: string) {
    this.show(message, 'ok');
  }

  error(message: string) {
    this.show(message, 'error', 4200);
  }

  dismiss() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.message.set('');
  }
}
