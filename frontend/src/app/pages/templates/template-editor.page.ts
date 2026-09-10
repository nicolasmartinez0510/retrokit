import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { TemplateColumnInput } from '../../core/models';

type EditableColumn = TemplateColumnInput & { key: string };

@Component({
  selector: 'app-template-editor-page',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>{{ isNew() ? 'Nueva plantilla' : 'Editar plantilla' }}</h1>
          <p class="subtitle">
            Definí nombre, descripción y columnas con título e icono
          </p>
        </div>
        <a class="btn-secondary" routerLink="/templates">Volver</a>
      </div>

      @if (error()) {
        <p class="form-error">{{ error() }}</p>
      }

      <form class="card panel" (ngSubmit)="save()">
        <div class="field">
          <label>Nombre</label>
          <input [(ngModel)]="name" name="name" required minlength="2" />
        </div>
        <div class="field">
          <label>Descripción</label>
          <textarea
            [(ngModel)]="description"
            name="description"
            rows="2"
          ></textarea>
        </div>

        <div class="columns-header">
          <h2>Columnas</h2>
          <button type="button" class="btn-secondary btn-sm" (click)="addColumn()">
            Agregar columna
          </button>
        </div>

        <div class="columns">
          @for (col of columns(); track col.key; let i = $index) {
            <div class="column-row card">
              <div class="col-fields">
                <div class="field icon-field">
                  <label>Icono</label>
                  <input
                    [(ngModel)]="col.icon"
                    [name]="'icon-' + col.key"
                    maxlength="4"
                    placeholder="♥"
                  />
                </div>
                <div class="field grow">
                  <label>Título</label>
                  <input
                    [(ngModel)]="col.title"
                    [name]="'title-' + col.key"
                    required
                  />
                </div>
                <div class="field grow">
                  <label>Descripción</label>
                  <input
                    [(ngModel)]="col.description"
                    [name]="'desc-' + col.key"
                    placeholder="Pregunta guía para el equipo"
                  />
                </div>
              </div>
              <div class="col-actions">
                <button
                  type="button"
                  class="btn-ghost btn-sm"
                  (click)="move(i, -1)"
                  [disabled]="i === 0"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="btn-ghost btn-sm"
                  (click)="move(i, 1)"
                  [disabled]="i === columns().length - 1"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="btn-danger btn-sm"
                  (click)="removeColumn(i)"
                  [disabled]="columns().length <= 1"
                >
                  Quitar
                </button>
              </div>
            </div>
          }
        </div>

        <section class="preview">
          <h3>Vista previa</h3>
          <ul class="preview-cols">
            @for (col of columns(); track col.key) {
              <li>
                <strong>{{ col.icon || '•' }} {{ col.title || 'Sin título' }}</strong>
                @if (col.description) {
                  — {{ col.description }}
                }
              </li>
            }
          </ul>
        </section>

        <div class="form-actions">
          <button class="btn-primary" type="submit" [disabled]="saving()">
            {{ saving() ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: `
    .panel {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .columns-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      h2 {
        font-size: 1.05rem;
      }
    }
    .columns {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .column-row {
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .col-fields {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
    }
    .icon-field {
      width: 72px;
      input {
        text-align: center;
      }
    }
    .grow {
      flex: 1 1 160px;
    }
    .col-actions {
      display: flex;
      gap: 0.35rem;
      justify-content: flex-end;
    }
    .preview {
      background: var(--color-sky-soft);
      border-radius: var(--radius-sm);
      padding: 0.85rem 1rem;
      h3 {
        font-size: 0.9rem;
        margin-bottom: 0.5rem;
      }
    }
    .preview-cols {
      margin: 0;
      padding-left: 1.1rem;
      font-size: 0.85rem;
      color: var(--color-text-muted);
      li {
        margin-bottom: 0.25rem;
      }
      strong {
        color: var(--color-text);
      }
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
    }
  `,
})
export class TemplateEditorPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  isNew = signal(true);
  templateId: string | null = null;
  name = '';
  description = '';
  columns = signal<EditableColumn[]>([]);
  error = signal('');
  saving = signal(false);
  private keySeq = 0;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || id === 'new') {
      this.isNew.set(true);
      this.columns.set([
        this.makeColumn({ title: '', description: '', icon: '▶', position: 0 }),
        this.makeColumn({ title: '', description: '', icon: '■', position: 1 }),
        this.makeColumn({ title: '', description: '', icon: '↻', position: 2 }),
      ]);
      return;
    }

    this.isNew.set(false);
    this.templateId = id;
    this.api.getTemplate(id).subscribe({
      next: (tpl) => {
        this.name = tpl.name;
        this.description = tpl.description || '';
        this.columns.set(
          tpl.columns.map((c) =>
            this.makeColumn({
              id: c.id,
              title: c.title,
              description: c.description || '',
              icon: c.icon || '',
              position: c.position,
            }),
          ),
        );
      },
      error: (e) =>
        this.error.set(e?.error?.message || 'No se pudo cargar la plantilla'),
    });
  }

  addColumn() {
    if (this.columns().length >= 8) {
      this.error.set('Máximo 8 columnas por plantilla');
      return;
    }
    this.error.set('');
    this.columns.set([
      ...this.columns(),
      this.makeColumn({
        title: '',
        description: '',
        icon: '•',
        position: this.columns().length,
      }),
    ]);
  }

  removeColumn(index: number) {
    if (this.columns().length <= 1) return;
    this.columns.set(this.columns().filter((_, i) => i !== index));
  }

  move(index: number, delta: number) {
    const next = [...this.columns()];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    this.columns.set(next);
  }

  save() {
    const cols = this.columns();
    if (!this.name.trim() || this.name.trim().length < 2) {
      this.error.set('El nombre debe tener al menos 2 caracteres');
      return;
    }
    if (!cols.length || cols.some((c) => !c.title.trim())) {
      this.error.set('Cada columna necesita un título');
      return;
    }
    if (cols.length > 8) {
      this.error.set('Máximo 8 columnas por plantilla');
      return;
    }

    const payload = {
      name: this.name.trim(),
      description: this.description.trim() || null,
      columns: cols.map((c, i) => ({
        ...(c.id ? { id: c.id } : {}),
        title: c.title.trim(),
        description: c.description?.trim() || null,
        icon: c.icon?.trim() || null,
        position: i,
      })),
    };

    this.saving.set(true);
    this.error.set('');

    const req = this.isNew()
      ? this.api.createTemplate(payload)
      : this.api.updateTemplate(this.templateId!, payload);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigateByUrl('/templates');
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(e?.error?.message || 'No se pudo guardar');
      },
    });
  }

  private makeColumn(
    data: Omit<TemplateColumnInput, 'position'> & { position?: number },
  ): EditableColumn {
    this.keySeq += 1;
    return {
      key: `col-${this.keySeq}`,
      id: data.id,
      title: data.title,
      description: data.description ?? '',
      icon: data.icon ?? '',
      position: data.position ?? 0,
    };
  }
}
