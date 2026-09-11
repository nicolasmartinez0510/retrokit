import {
  Component,
  ElementRef,
  HostListener,
  booleanAttribute,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

const EMOJIS = [
  '😀',
  '😃',
  '😄',
  '😁',
  '😅',
  '😂',
  '🤣',
  '😊',
  '🙂',
  '😉',
  '😍',
  '🥰',
  '😎',
  '🤔',
  '🤨',
  '😐',
  '😕',
  '😟',
  '😢',
  '😭',
  '😤',
  '😠',
  '🤯',
  '😱',
  '😴',
  '🥱',
  '👍',
  '👎',
  '👏',
  '🙌',
  '🤝',
  '💪',
  '✌️',
  '🤞',
  '👋',
  '🙏',
  '❤️',
  '🧡',
  '💛',
  '💚',
  '💙',
  '💜',
  '🖤',
  '💔',
  '💯',
  '✨',
  '⭐',
  '🔥',
  '💡',
  '🎉',
  '🎊',
  '✅',
  '❌',
  '⚠️',
  '❓',
  '❗',
  '📌',
  '📝',
  '💬',
  '🗣️',
  '🧠',
  '👀',
  '🚀',
  '🎯',
  '🏆',
  '🥇',
  '🐛',
  '🛠️',
  '⚙️',
  '🔗',
  '⏱️',
  '📅',
  '☕',
  '🍕',
  '🍩',
  '🌈',
  '☀️',
  '🌧️',
  '⛈️',
  '❄️',
];

@Component({
  selector: 'app-emoji-picker',
  standalone: true,
  template: `
    <div class="emoji-wrap">
      <button
        type="button"
        class="btn-ghost btn-sm emoji-trigger"
        [class.icon-only]="iconOnly()"
        (click)="toggle($event)"
        [title]="title()"
        [attr.aria-label]="title()"
      >
        @if (iconOnly()) {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <circle cx="9" cy="10" r="1.1" fill="currentColor" stroke="none" />
            <circle cx="15" cy="10" r="1.1" fill="currentColor" stroke="none" />
            <path d="M8.4 14.4c.9 1.4 2.2 2.1 3.6 2.1s2.7-.7 3.6-2.1" />
          </svg>
        } @else {
          {{ label() }}
        }
      </button>
      @if (open()) {
        <div
          class="emoji-popover"
          [class.down]="placement() === 'down'"
          role="listbox"
          aria-label="Emojis"
        >
          @for (e of emojis(); track e) {
            <button
              type="button"
              class="emoji-btn"
              (click)="pick(e, $event)"
              [attr.aria-label]="e"
            >
              {{ e }}
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .emoji-wrap {
      position: relative;
      display: inline-flex;
    }
    .emoji-trigger {
      font-size: 1.1rem;
      padding: 0.25rem 0.45rem;
      line-height: 1;
    }
    .emoji-trigger.icon-only {
      width: 2rem;
      height: 2rem;
      padding: 0;
      font-size: inherit;
    }
    .emoji-trigger svg {
      width: 1.15rem;
      height: 1.15rem;
      display: block;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .emoji-popover {
      position: absolute;
      bottom: calc(100% + 0.35rem);
      left: 0;
      z-index: 40;
      display: grid;
      grid-template-columns: repeat(8, 1.75rem);
      gap: 0.15rem;
      padding: 0.5rem;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow);
      max-height: 12rem;
      overflow-y: auto;
      width: max-content;
    }
    .emoji-popover.down {
      bottom: auto;
      top: calc(100% + 0.35rem);
    }
    .emoji-btn {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 1.15rem;
      line-height: 1.75rem;
      width: 1.75rem;
      height: 1.75rem;
      padding: 0;
      border-radius: 4px;
    }
    .emoji-btn:hover {
      background: var(--color-sky-soft);
    }
  `,
})
export class EmojiPickerComponent {
  readonly picked = output<string>();
  readonly open = signal(false);
  readonly prepend = input<string[]>([]);
  readonly label = input('😊');
  readonly title = input('Insertar emoji');
  readonly placement = input<'up' | 'down'>('up');
  readonly iconOnly = input(false, { transform: booleanAttribute });
  readonly emojis = computed(() => [...this.prepend(), ...EMOJIS]);

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  toggle(event: Event) {
    event.stopPropagation();
    this.open.update((v) => !v);
  }

  pick(emoji: string, event: Event) {
    event.stopPropagation();
    this.picked.emit(emoji);
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent) {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.open.set(false);
  }
}
