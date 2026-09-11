import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { httpErrorMessage } from '../../core/http-error';
import { Template } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-templates-page',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Plantillas</h1>
          <p class="subtitle">
            Plantillas globales de retrospectiva con columnas personalizables
          </p>
        </div>
        <a class="btn-primary" routerLink="/templates/new">
          <svg class="plus-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 4.5a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V5.25A.75.75 0 0 1 12 4.5Z"
            />
          </svg>
          Nueva plantilla
        </a>
      </div>

      <div class="template-list">
        @for (tpl of templates(); track tpl.id) {
          <div class="card template-card">
            <div class="template-main">
              <h2>{{ tpl.name }}</h2>
              @if (tpl.description) {
                <p class="desc">{{ tpl.description }}</p>
              }
              <p class="meta">{{ tpl.columns.length }} columnas</p>
              <ul class="cols">
                @for (col of tpl.columns; track col.id) {
                  <li>
                    @if (col.logoUrl) {
                      <img class="col-logo-sm" [src]="col.logoUrl" alt="" />
                    } @else if (col.icon) {
                      <span class="col-icon">{{ col.icon }}</span>
                    }
                    <strong>{{ col.title }}</strong>
                    @if (col.description) {
                      — {{ col.description }}
                    }
                  </li>
                }
              </ul>
            </div>
            <div class="template-actions">
              <a
                class="icon-btn edit"
                [routerLink]="['/templates', tpl.id]"
                title="Editar"
                aria-label="Editar plantilla"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                  />
                </svg>
              </a>
              <button
                type="button"
                class="icon-btn trash"
                title="Borrar"
                aria-label="Borrar plantilla"
                (click)="remove(tpl)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                  />
                </svg>
              </button>
            </div>
          </div>
        } @empty {
          <div class="empty-state card">
            <strong>No hay plantillas</strong>
            Creá la primera para usarla al iniciar una retrospectiva.
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .template-list {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .template-card {
      padding: 1.15rem 1.25rem;
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
    }
    .template-main {
      flex: 1;
      min-width: 0;
    }
    .template-main h2 {
      font-size: 1.1rem;
      margin-bottom: 0.35rem;
    }
    .desc {
      color: var(--color-text-muted);
      font-size: 0.9rem;
      margin-bottom: 0.4rem;
    }
    .meta {
      font-size: 0.8rem;
      color: var(--color-brand);
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .cols {
      margin: 0;
      padding-left: 1.1rem;
      font-size: 0.85rem;
      color: var(--color-text-muted);
      li {
        margin-bottom: 0.2rem;
      }
      strong {
        color: var(--color-text);
      }
    }
    .col-logo-sm,
    .col-icon {
      width: 18px;
      height: 18px;
      object-fit: contain;
      vertical-align: middle;
      margin-right: 0.25rem;
    }
    .col-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
    }
    .template-actions {
      display: flex;
      gap: 0.35rem;
      flex-shrink: 0;
    }
    .plus-icon {
      width: 1.05em;
      height: 1.05em;
      display: block;
      flex-shrink: 0;
      fill: currentColor;
    }
    .icon-btn {
      appearance: none;
      flex-shrink: 0;
      width: 1.85rem;
      height: 1.85rem;
      padding: 0;
      border-radius: 8px;
      display: grid;
      place-items: center;
      background: transparent;
      border: 1.5px solid transparent;
      cursor: pointer;
      text-decoration: none;
      color: var(--color-text-muted);
      svg {
        width: 1.1rem;
        height: 1.1rem;
        display: block;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.75;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      &.edit {
        color: var(--color-brand);
        &:hover { background: var(--color-sky-soft); }
      }
      &.trash {
        color: var(--color-danger);
        &:hover { background: var(--color-danger-soft); }
      }
    }
    @media (max-width: 640px) {
      .template-card {
        flex-direction: column;
      }
    }
  `,
})
export class TemplatesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  templates = signal<Template[]>([]);

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.api.listTemplates().subscribe({
      next: (list) => this.templates.set(list),
      error: (e) =>
        this.toast.error(
          httpErrorMessage(e, 'No se pudieron cargar las plantillas'),
        ),
    });
  }

  remove(tpl: Template) {
    if (
      !confirm(
        `¿Borrar la plantilla “${tpl.name}”? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    this.api.deleteTemplate(tpl.id).subscribe({
      next: () => {
        this.templates.set(this.templates().filter((t) => t.id !== tpl.id));
        this.toast.ok('Plantilla borrada');
      },
      error: (e) =>
        this.toast.error(httpErrorMessage(e, 'No se pudo borrar la plantilla')),
    });
  }
}
