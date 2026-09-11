import { Component, input } from '@angular/core';

@Component({
  selector: 'app-brand-logo',
  host: {
    '[class.lockup]': 'lockup()',
  },
  template: `
    <svg viewBox="0 0 100 42" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M0 8C8 2 24 0 36 10C42 14 47 14 50 10C53 14 58 14 64 10C76 0 92 2 100 8C96 16 86 40 66 38C58 37 53 30 50 32C47 30 42 37 34 38C14 40 4 16 0 8Z"
      />
    </svg>
    @if (lockup()) {
      <span class="wordmark">Retrokit</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
      color: inherit;
    }
    :host.lockup {
      flex-direction: column;
      align-items: center;
      align-self: center;
      gap: 0.45rem;
      line-height: 1;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    :host.lockup svg {
      width: 5.75rem;
      height: auto;
      color: var(--color-brand);
    }
    .wordmark {
      font-family: var(--font-brand);
      font-weight: 800;
      font-size: 1.85rem;
      letter-spacing: -0.04em;
      color: var(--color-text);
      line-height: 1;
    }
  `,
})
export class BrandLogo {
  readonly lockup = input(false);
}
