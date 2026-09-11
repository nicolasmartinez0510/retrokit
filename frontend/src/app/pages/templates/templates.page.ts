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
        <a class="btn-primary" routerLink="/templates/new">Nueva plantilla</a>
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
              <a class="btn-secondary btn-sm" [routerLink]="['/templates', tpl.id]"
                >Editar</a
              >
              <button
                type="button"
                class="btn-danger btn-sm"
                (click)="remove(tpl)"
              >
                Borrar
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
      gap: 0.4rem;
      flex-shrink: 0;
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
