import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'retrokit_theme';

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function readStoredTheme(): Theme | null {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

function resolveTheme(): Theme {
  return readStoredTheme() ?? systemTheme();
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(resolveTheme());

  private followsSystem = readStoredTheme() === null;

  constructor() {
    this.apply(this.theme());

    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (event) => {
        if (!this.followsSystem) return;
        this.apply(event.matches ? 'dark' : 'light');
      });
  }

  toggle() {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.followsSystem = false;
    localStorage.setItem(THEME_KEY, next);
    this.apply(next);
  }

  private apply(theme: Theme) {
    this.theme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
  }
}
