import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { httpErrorMessage } from '../../core/http-error';
import { ToastService } from '../../core/toast.service';
import { UserAvatarComponent } from '../../shared/user-avatar.component';

type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  avatarId?: string | null;
  isAdmin: boolean;
  createdAt: string;
};

@Component({
  selector: 'app-users-page',
  imports: [UserAvatarComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Usuarios</h1>
          <p class="subtitle">Administración general de cuentas de la app</p>
        </div>
      </div>

      @if (error()) {
        <p class="form-error">{{ error() }}</p>
      }

      <div class="list">
        @for (user of users(); track user.id) {
          <div class="card row">
            <div class="user-id">
              <app-user-avatar
                [avatarId]="user.avatarId"
                [seed]="user.id"
                [name]="user.name"
                size="md"
              />
              <div>
                <strong>{{ user.name }}</strong>
                <p class="meta">
                  {{ user.email }}
                  @if (user.isAdmin) {
                    · Administrador
                  }
                </p>
              </div>
            </div>
            <div class="row-actions">
              @if (!user.isAdmin && user.id !== currentUserId()) {
                <button
                  type="button"
                  class="icon-action danger"
                  (click)="confirmDelete(user)"
                  title="Borrar usuario"
                  aria-label="Borrar usuario"
                  [disabled]="deletingId() === user.id"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                    />
                  </svg>
                </button>
              }
            </div>
          </div>
        } @empty {
          <div class="empty-state card">
            <strong>No hay usuarios</strong>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.9rem 1.1rem;
    }
    .user-id {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }
    .user-id strong {
      display: block;
    }
    .meta {
      margin: 0.15rem 0 0;
      color: var(--color-text-muted);
      font-size: 0.85rem;
    }
    .row-actions {
      display: flex;
      gap: 0.35rem;
    }
    .icon-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border: none;
      border-radius: 0.45rem;
      background: transparent;
      color: var(--color-text-muted);
      cursor: pointer;
    }
    .icon-action:hover {
      background: var(--color-sky-soft);
      color: var(--color-text);
    }
    .icon-action.danger:hover {
      background: color-mix(in srgb, var(--color-danger, #c0392b) 18%, transparent);
      color: var(--color-danger, #c0392b);
    }
    .icon-action svg {
      width: 1.15rem;
      height: 1.15rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
    }
    .icon-action:disabled {
      opacity: 0.5;
      cursor: wait;
    }
  `,
})
export class UsersPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  users = signal<AdminUserRow[]>([]);
  error = signal('');
  deletingId = signal('');

  currentUserId() {
    return this.auth.user()?.id ?? '';
  }

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.api.listUsers().subscribe({
      next: (list) => {
        this.users.set(list);
        this.error.set('');
      },
      error: (e) =>
        this.error.set(httpErrorMessage(e, 'No se pudieron cargar los usuarios')),
    });
  }

  confirmDelete(user: AdminUserRow) {
    if (
      !confirm(
        `¿Borrar al usuario “${user.name}” (${user.email})? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    this.deletingId.set(user.id);
    this.api.deleteUser(user.id).subscribe({
      next: () => {
        this.users.set(this.users().filter((u) => u.id !== user.id));
        this.deletingId.set('');
        this.toast.ok('Usuario borrado');
      },
      error: (e) => {
        this.deletingId.set('');
        this.toast.error(httpErrorMessage(e, 'No se pudo borrar el usuario'));
      },
    });
  }
}
