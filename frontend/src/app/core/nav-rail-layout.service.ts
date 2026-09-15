import { Injectable, signal } from '@angular/core';

const EXPANDED_KEY = 'retrokit_nav_expanded';

@Injectable({ providedIn: 'root' })
export class NavRailLayoutService {
  readonly expanded = signal(readExpanded());

  toggle() {
    const next = !this.expanded();
    this.expanded.set(next);
    try {
      localStorage.setItem(EXPANDED_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  setExpanded(value: boolean) {
    this.expanded.set(value);
    try {
      localStorage.setItem(EXPANDED_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
  }
}

function readExpanded() {
  try {
    return localStorage.getItem(EXPANDED_KEY) === '1';
  } catch {
    return false;
  }
}
