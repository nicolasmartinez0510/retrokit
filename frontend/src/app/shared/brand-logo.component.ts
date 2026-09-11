import { Component } from '@angular/core';

@Component({
  selector: 'app-brand-logo',
  template: `
    <svg viewBox="0 0 64 40" aria-hidden="true" focusable="false">
      <path
        d="M10 28C5 13 21 7 32 19C43 7 59 13 54 28"
        fill="none"
        stroke="currentColor"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path fill="currentColor" d="M32 25.5 37.4 37H26.6Z" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
      color: inherit;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  `,
})
export class BrandLogo {}
