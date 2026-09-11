import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { AVATARS, randomAvatarId } from '../core/avatars';
import { UserAvatarComponent } from './user-avatar.component';

@Component({
  selector: 'app-avatar-picker',
  imports: [NgTemplateOutlet, UserAvatarComponent],
  template: `
    <div class="picker" [class.compact]="mode() === 'compact'">
      @if (mode() === 'compact') {
        <span class="picker-label">{{ label() }}</span>
        <div class="preview-wrap">
          <button
            type="button"
            class="preview-btn"
            (click)="toggle($event)"
            [attr.aria-expanded]="open()"
            [attr.aria-label]="'Cambiar avatar'"
          >
            <app-user-avatar [avatarId]="avatarId()" [name]="label()" size="xl" />
          </button>
          @if (open()) {
            <ng-container *ngTemplateOutlet="panelTpl" />
          }
        </div>
        <span class="hint">{{ open() ? 'Elegí uno' : 'Click para cambiar' }}</span>
      } @else {
        <ng-container *ngTemplateOutlet="panelTpl" />
      }
      <ng-template #panelTpl>
        <div
          class="panel"
          [class.popover]="mode() === 'compact'"
          (click)="$event.stopPropagation()"
        >
          <div class="picker-head">
            @if (mode() === 'panel') {
              <span class="picker-label">{{ label() }}</span>
            }
            <button type="button" class="btn-ghost btn-sm" (click)="shuffle()">
              Otro al azar
            </button>
          </div>
          <div class="grid" role="listbox" [attr.aria-label]="label()">
            @for (a of avatars; track a.id) {
              <button
                type="button"
                class="choice"
                role="option"
                [class.selected]="avatarId() === a.id"
                [attr.aria-selected]="avatarId() === a.id"
                [attr.aria-label]="a.label"
                [title]="a.label"
                (click)="select(a.id)"
              >
                <app-user-avatar [avatarId]="a.id" [name]="a.label" size="lg" />
              </button>
            }
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .picker.compact {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
    }
    .preview-wrap {
      position: relative;
      width: 72px;
      height: 72px;
    }
    .picker-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-text-muted);
    }
    .hint {
      font-size: 0.8rem;
      color: var(--color-text-muted);
    }
    .preview-btn {
      appearance: none;
      border: none;
      background: transparent;
      padding: 0;
      margin: 0;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      cursor: pointer;
      display: grid;
      place-items: center;
      line-height: 0;
    }
    .preview-btn:hover,
    .preview-btn[aria-expanded='true'] {
      box-shadow: 0 0 0 3px var(--color-sky-mid);
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }
    .popover {
      position: absolute;
      top: calc(100% + 0.5rem);
      left: 50%;
      transform: translateX(-50%);
      z-index: 40;
      width: max-content;
      padding: 0.75rem;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }
    .picker-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .popover .picker-head {
      justify-content: flex-end;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(6, 48px);
      justify-content: center;
      gap: 0.55rem;
    }
    .choice {
      appearance: none;
      -webkit-appearance: none;
      box-sizing: border-box;
      width: 48px;
      height: 48px;
      min-width: 48px;
      min-height: 48px;
      margin: 0;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: transparent;
      cursor: pointer;
      display: grid;
      place-items: center;
      line-height: 0;
    }
    .choice:hover {
      outline: 2px solid var(--color-sky-mid);
      outline-offset: 2px;
    }
    .choice.selected {
      outline: 2px solid var(--color-brand);
      outline-offset: 2px;
    }
    @media (max-width: 520px) {
      .grid {
        grid-template-columns: repeat(4, 48px);
      }
    }
  `,
})
export class AvatarPickerComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  avatarId = model.required<string>();
  label = input('Elegí tu avatar');
  mode = input<'compact' | 'panel'>('compact');
  readonly avatars = AVATARS;
  readonly open = signal(false);

  toggle(event: Event) {
    event.stopPropagation();
    this.open.update((v) => !v);
  }

  select(id: string) {
    this.avatarId.set(id);
    if (this.mode() === 'compact') this.open.set(false);
  }

  shuffle() {
    let next = randomAvatarId();
    if (this.avatars.length > 1) {
      while (next === this.avatarId()) next = randomAvatarId();
    }
    this.avatarId.set(next);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent) {
    if (this.mode() !== 'compact' || !this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.open.set(false);
  }
}
