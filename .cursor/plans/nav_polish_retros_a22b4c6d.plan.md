---
name: Nav polish retros
overview: Pulir rail (Miembros + Equipos, centrado colapsado, selector solo +Agregar), unificar invitaciones del admin (enlace/email/código), enriquecer Retros, popover de avatares, Panel con cards individuales, onboarding sin equipos, y salida de retro al origen.
todos:
  - id: rail-members-equipos
    content: "Rail: Miembros + Equipos; selector solo +Agregar; centrado colapsado"
    status: completed
  - id: members-page
    content: Ruta /teams/:id/members con listado + Invitar
    status: completed
  - id: invite-three-ways
    content: "Modal Invitar (enlace/email/código); fila admin con iconos editar/invitar/borrar"
    status: completed
  - id: retros-cards-enrich
    content: "API+UI: plantilla, #cards, fecha, rename; sin nombre equipo; align fase/trash"
    status: completed
  - id: modal-logo-icon
    content: "Modal crear: icono en vez de texto Logo"
    status: completed
  - id: avatar-popover-pos
    content: "Avatar menu: abrir popover hacia arriba y a la derecha (no se corte en el pie de la rail)"
    status: completed
  - id: panel-item-cards
    content: "Panel: una card por retro reciente y por accionable (sin card-list envolvente)"
    status: completed
  - id: create-invite-list
    content: "Crear equipo: Enter agrega email a listado de invitados"
    status: completed
  - id: invite-modal-toast
    content: "Modal Invitar: Enter/botón envía, toast y permanece abierto"
    status: completed
  - id: members-pending-invites
    content: "Miembros: listar invites pendientes + cancelar"
    status: completed
  - id: onboarding-home
    content: "Home sin equipos: crear/unir; rail solo con equipos"
    status: completed
  - id: remove-member-no-user-delete
    content: "Quitar miembro no borra User; toast + switch/home al ser removido"
    status: completed
  - id: invite-accept-panel
    content: "Aceptar invite → enterTeam + Panel; Unirme abre tab Unirse"
    status: completed
  - id: members-live-update
    content: "Miembros: refrescar al aceptar invite (socket team-invite-resolved)"
    status: completed
  - id: delete-team-confirm
    content: "Borrar equipo: confirmar escribiendo el nombre"
    status: completed
  - id: retro-exit-origin
    content: "Icono salir en retro (afuera del título) → Panel o Retros según origen"
    status: completed
  - id: docker-rebuild
    content: Rebuild api+web y avisar URL
    status: completed
isProject: true
---

# Pulido nav, invitaciones y cards de Retros

## Contexto

Varios ítems del plan anterior quedaron incompletos o regresaron: falta **Miembros** y **Equipos** en la rail principal; el selector tiene “Administrar equipos”; logos descentrados al colapsar; invitaciones sin enlace compartible; hub Retros aún muestra el nombre del equipo; cards sin plantilla/#tarjetas/fecha/rename; badge de fase desalineado vs trash; botón “Logo” textual en el modal.

## Cambios

### 1. Rail ([`app-nav-rail.component.ts`](frontend/src/app/shared/app-nav-rail.component.ts))

IA final:

```
Logo (centrado si colapsada)
[Selector] → lista + solo "+ Agregar" (abre TeamCreateJoinModal)
Panel / Retros / Acciones / Miembros / Equipos / Plantillas*
Tema · Avatar (+ Salir si expanded)
```

- Restaurar **Miembros** → `/teams/:activeId/members` (página nueva si no existe; si solo había `#members` en hub, crear ruta liviana reusando listado+invitar del admin).
- Restaurar **Equipos** → `/teams` en la rail (hoy solo está en el popover).
- Popover: **quitar** “Administrar equipos”; dejar **solo “+ Agregar”**.
- Colapsada: centrar horizontalmente brand + selector (`.rail-top`, `.brand`, `.team-btn` / `.team-initial` con `justify-content: center` / `margin-inline: auto`); expand sigue en fab del `main` ([`app.ts`](frontend/src/app/app.ts)).
- Active state: `RouterLinkActive` con `paths: 'exact'` para no marcar Retros y Acciones a la vez.

### 2. Vista Miembros

- Nueva ruta [`/teams/:id/members`](frontend/src/app/app.routes.ts) + page: listado miembros, join-requests, botón **Invitar** (email) y acceso a las 3 formas de invitación vía el mismo modal de compartir del admin (o sección Invitar con tabs).
- Facilitador: remover miembro (lógica que vivía en el hub).
- Listar **invites pendientes** del equipo + **cancelar** (`GET/DELETE` invites del team).
- Refresco en vivo al aceptar invite (`team-invite-resolved` → facilitators).

### 3. Admin Equipos — 3 formas de invitar ([`teams.page.ts`](frontend/src/app/pages/teams/teams.page.ts))

Unificar “Invitar” / “Código” en un modal **Invitar a {equipo}** con tres bloques:

1. **Enlace** — `origin + /join-team/{inviteCode}` + copiar (como el invite del hub viejo).
2. **Email** — búsqueda `GET /users/search` + `POST /teams/:id/invites` (ya existe). Enter / botón envía, toast, modal permanece abierto para seguir invitando.
3. **Código** — mostrar `inviteCode` + copiar.

Botones de fila (facilitador): **solo iconos** con `title` / `aria-label` — lápiz (Editar), persona+ (Invitar, abre el modal de 3 vías), basura (Borrar). Sin labels de texto ni botón “Código” suelto. La estrella de favorito se mantiene como icono.

Borrar equipo: confirmar escribiendo el **nombre exacto** del equipo.

### 4. Hub Retros ([`team.page.ts`](frontend/src/app/pages/team/team.page.ts))

- Quitar `h1` del nombre del equipo y el star del header; título de página = **Retrospectivas** (o solo historial + CTA).
- Mantener **Nueva retrospectiva** + listado.
- Cards enriquecidas:
  - plantilla (`template.name`)
  - cantidad de tarjetas
  - fecha de creación (formato legible)
  - **Editar** nombre (facilitador)
- Alinear verticalmente badge de fase y botón borrar (`align-items: center` en la fila de acciones; mismo `height`/line-box).

Backend: enriquecer listado en [`teams.service.ts`](backend/src/teams/teams.service.ts) (`retroSummarySelect` / `withMappedRetros`) con `template: { select: { name: true } }` y `_count: { select: { cards: true } }`. Extender [`RetroSummary`](frontend/src/app/core/models/index.ts).

Rename: `PATCH /retros/:id` con `{ title }` (facilitador); hoy settings no incluye title. Cliente `api.renameRetro`.

### 5. Modal crear equipo ([`team-create-join-modal.component.ts`](frontend/src/app/shared/team-create-join-modal.component.ts))

- Reemplazar label texto “Logo” por **botón/icono** (upload) sobre el preview o junto a él; `aria-label="Subir logo"`.
- Crear: **Enter** agrega el email al listado de invitados (chips) en vez de submit del form.
- Abrir en tab **Unirse** cuando el CTA es “Unirme” (`initialTab` + `linkedSignal`).

### 6. Selector de avatares ([`avatar-menu.component.ts`](frontend/src/app/shared/avatar-menu.component.ts))

Hoy el `.popover` usa `top: calc(100% + 0.5rem); right: 0` y se corta fuera del viewport porque el trigger está en el pie izquierdo de la rail.

- Abrir **hacia arriba y a la derecha**: `bottom: calc(100% + 0.5rem); left: 0; right: auto; top: auto`.
- Asegurar que el panel quede dentro del viewport (ancho `min(24rem, …)` ya existe; si hace falta, `max-height` + scroll).

### 7. Panel — cards individuales ([`dashboard.page.ts`](frontend/src/app/pages/dashboard/dashboard.page.ts))

Hoy “Retros recientes” y “Por caducar” usan un único `.card.list` que envuelve todas las filas y se estira (`flex: 1` + `align-items: stretch` en `.split`), dejando hueco vacío.

- Quitar el contenedor `.card.list` envolvente.
- Cada retro reciente y cada accionable = **una card propia** (mismo look de card del design system: borde, radio, sombra).
- Stack vertical con gap bajo cada `h2`; columnas del split con `align-items: start` para que la altura siga el contenido.
- Empty states: una sola card compacta (o mensaje sin card) cuando no hay ítems.

### 8. Onboarding sin equipos

- Si el usuario no tiene equipos: Panel muestra CTA **Crear equipo** / **Unirme**; **no** se muestra la rail hasta tener al menos un equipo (`ActiveTeamService.hasTeams`).
- Tras aceptar invite o unirse: `enterTeam` + navegar a Panel.

### 9. Quitar miembro / equipo stale

- `removeMember` **no** borra el `User` (solo membership); evita FK stuck.
- Al ser removido: socket `team-member-removed` → toast; si era el equipo activo, switch a otro o home onboarding.
- Facilitadores reciben `team-invite-resolved` para refrescar Miembros.

### 10. Salir de la retro

- Botón salir (puerta) **afuera a la izquierda** del contenedor del título, mismo fondo/borde de paneles sobre fondo de escena.
- Vuelve a **Panel** (`/dashboard`) o **Retros** (`/teams/:id`) según `router` state / `sessionStorage` al entrar; default = hub del equipo.

## Verificación

Rebuild `web` + `api`. Comprobar: rail con Miembros+Equipos; selector solo +Agregar; logos centrados colapsados; invite modal con enlace/email/código; iconos en fila de equipos; Retros sin nombre de equipo; cards con detalle + rename; fase alineada con trash; icono de logo en crear; popover de avatares visible hacia arriba/derecha; Panel con cards sueltas; onboarding sin rail; salir de retro al origen. URL: `http://localhost:8090`.
