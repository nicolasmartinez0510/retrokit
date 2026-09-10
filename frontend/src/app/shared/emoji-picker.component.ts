import {
  Component,
  ElementRef,
  HostListener,
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
        (click)="toggle($event)"
        title="Emoji"
        aria-label="Insertar emoji"
      >
        😊
      </button>
      @if (open()) {
        <div class="emoji-popover" role="listbox" aria-label="Emojis">
          @for (e of emojis; track e) {
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
  readonly emojis = EMOJIS;

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
