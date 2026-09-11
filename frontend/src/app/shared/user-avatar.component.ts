import { Component, computed, input } from '@angular/core';
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
  avatarId = input<string | null | undefined>(null);
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

  readonly src = computed(() =>
    avatarSrc(resolveAvatarId(this.avatarId(), this.seed() || this.name())),
  );

  readonly alt = computed(() => this.name() || 'Avatar');
}
