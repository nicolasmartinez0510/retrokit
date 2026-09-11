import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  signal,
} from '@angular/core';
import { AuthService } from '../core/auth.service';
import { resolveAvatarId } from '../core/avatars';
import { AvatarPickerComponent } from './avatar-picker.component';
import { UserAvatarComponent } from './user-avatar.component';

@Component({
  selector: 'app-avatar-menu',
  imports: [UserAvatarComponent, AvatarPickerComponent],
  template: `
    <div class="wrap">
      <button
        type="button"
        class="avatar-btn"
        (click)="toggle($event)"
        title="Cambiar avatar"
        aria-label="Cambiar avatar"
        [attr.aria-expanded]="open()"
      >
        <app-user-avatar
          [avatarId]="avatarId()"
          [seed]="seed()"
          [name]="name()"
          size="chip"
        />
      </button>
      @if (open()) {
        <div class="popover" (click)="$event.stopPropagation()">
          <app-avatar-picker
            [avatarId]="draft"
            (avatarIdChange)="pick($event)"
            mode="panel"
            label="Tu avatar"
          />
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      line-height: 0;
    }
    .wrap {
      position: relative;
      display: flex;
      align-items: center;
      line-height: 0;
    }
    .avatar-btn {
      appearance: none;
      border: none;
      background: transparent;
      padding: 0;
      margin: 0;
      width: 30px;
      height: 30px;
      cursor: pointer;
      border-radius: 50%;
      display: grid;
      place-items: center;
      line-height: 0;
      flex-shrink: 0;
    }
    .avatar-btn:hover {
      outline: 2px solid var(--color-sky-mid);
      outline-offset: 1px;
    }
    .popover {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      z-index: 40;
      width: min(24rem, calc(100vw - 2rem));
      padding: 0.75rem;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }
  `,
})
export class AvatarMenuComponent {
  private readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  avatarId = input<string | null | undefined>(null);
  seed = input('');
  name = input('');

  readonly open = signal(false);
  draft = '';

  toggle(event: Event) {
    event.stopPropagation();
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.draft = resolveAvatarId(this.avatarId(), this.seed());
    this.open.set(true);
  }

  pick(id: string) {
    this.draft = id;
    this.open.set(false);
    if (id === this.avatarId()) return;
    this.auth.updateMe({ avatarId: id }).subscribe();
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
