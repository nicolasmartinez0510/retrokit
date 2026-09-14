import { Component, computed, inject, input } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { avatarSrc, resolveAvatarId } from '../core/avatars';

@Component({
  selector: 'app-user-avatar',
  template: `
    <img [src]="src()" [alt]="alt()" draggable="false" />
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      vertical-align: middle;
      border-radius: 50%;
      overflow: hidden;
      background: transparent;
      line-height: 0;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  `,
  host: {
    '[style.width.px]': 'px()',
    '[style.height.px]': 'px()',
    '[attr.title]': 'name() || null',
  },
})
export class UserAvatarComponent {
  private readonly auth = inject(AuthService);

  avatarId = input<string | null | undefined>(null);
  /** When this is the signed-in user, prefer the live profile avatar. */
  ownerId = input<string | null | undefined>(null);
  seed = input('');
  name = input('');
  size = input<'sm' | 'md' | 'lg' | 'xl' | 'chip'>('md');

  readonly px = computed(() => {
    const s = this.size();
    if (s === 'sm') return 24;
    if (s === 'lg') return 48;
    if (s === 'xl') return 72;
    if (s === 'chip') return 30;
    return 32;
  });

  readonly src = computed(() => {
    const me = this.auth.user();
    const ownerId = this.ownerId();
    const live =
      ownerId && me?.id === ownerId && me.avatarId ? me.avatarId : this.avatarId();
    return avatarSrc(resolveAvatarId(live, this.seed() || this.name()));
  });

  readonly alt = computed(() => this.name() || 'Avatar');
}
