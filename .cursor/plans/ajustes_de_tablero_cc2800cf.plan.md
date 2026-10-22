---
name: Ajustes de tablero
overview: Corregir el “Estoy listo” para que cada fase arranque con el suyo, ocultar las tarjetas también al facilitador salvo que la fase lo permita, dejar las columnas a ancho fijo y centradas, y unificar el alta de tarjetas que son solo imagen.
todos:
  - id: ready-reset
    content: Migración que deja el listo copiado solo en la primera fase de cada tipo, y checkbox que se recrea al cambiar de fase
    status: completed
  - id: facilitator-see
    content: Flag facilitatorSeesCards (default false) en catálogo, snapshot, editor y tablero
    status: completed
  - id: column-width
    content: Columnas del tablero a 20rem, centradas, con scroll horizontal si no entran
    status: completed
  - id: image-upload
    content: En solo imagen, un botón Subir imagen / GIF que crea la tarjeta
    status: completed
  - id: rebuild
    content: Rebuild de web y api y avisar la URL
    status: completed
  - id: column-height
    content: Columnas vacías al alto de su contenido, sin estirarse con las que tienen tarjetas
    status: completed
  - id: empty-gap
    content: Sacar el hueco en blanco del tamaño por defecto de una columna sin tarjetas
    status: completed
  - id: image-icon
    content: El control opcional Imagen / GIF pasa a ser un ícono
    status: completed
isProject: true
---

# Ajustes de tablero y de fase

## Estoy listo y el cupo de tarjetas

El cupo ya cuenta solo las tarjetas de la fase (`createdInPhaseId` en [retros.service.ts](backend/src/retros/retros.service.ts), `cardQuotaWhere` y `myCommentCount`). El “listo” también es por fase (`ParticipantPhaseReady`). Al cambiar de fase, el tablero pide de nuevo ese flag: si en la fase nueva no hay fila, el checkbox queda destildado. Al volver a una fase anterior se recupera el listo de esa fase.

Lo que lo deja marcado al pasar de fase es el backfill de [20261022120000_phase_limits](backend/prisma/migrations/20261022120000_phase_limits/migration.sql): si el flag viejo de la persona estaba en true, lo copió a **todas** las fases que crean tarjetas (y lo mismo con votos y semáforo). Por eso la segunda fase de tarjetas hereda el listo de la primera. El checkbox, además, queda trabado cuando el cupo de esa fase ya está lleno (`readyLocked`).

- Migración correctiva: por persona, dejar el listo copiado solo en la primera fase de cada tipo (la primera que crea tarjetas, la primera que vota, la de semáforo) y borrar las copias de las fases siguientes. Lo que se marcó después, en una fase concreta, no se toca: solo se borran filas que están en true en más de una fase del mismo tipo y que coinciden con ese copiado masivo (todas las fases de ese tipo en true). Si la persona marcó listo en dos fases a propósito después del cambio, esas dos filas se conservan solo si no están en true en todas las fases del tipo; si el backfill las dejó todas en true, se conserva la primera y se limpian el resto. Es el caso que se ve hoy al cambiar de fase.
- El contador “Tus comentarios”, el `(n)` del progreso y el auto-listo al llegar al máximo siguen usando solo las tarjetas creadas en la fase actual. El bloqueo de desmarcar también.
- El checkbox se vuelve a crear al cambiar el id de fase (en [retro.page.html](frontend/src/app/pages/retro/retro.page.html)), para que el navegador no deje el tick de la fase anterior.

## El facilitador y las tarjetas ocultas o borrosas

Hoy el tablero salta la visibilidad si la persona es facilitadora:

```1786:1787:backend/src/retros/retros.service.ts
const othersVisibility =
  forReport || facilitator || !caps ? 'visible' : caps.othersVisibility;
```

Eso pasa a ser un ajuste de la fase, en el catálogo (`Phase`) y en el snapshot de la retro (`RetroPhase`). Nombre: `facilitatorSeesCards`, default `false`.

- Con el default, borrosas u ocultas aplican también al facilitador. Sus propias tarjetas, si participa, siguen viéndose.
- El checkbox del editor de fases, en Visibilidad: “El facilitador puede ver las tarjetas ocultas o borrosas”. Solo tiene sentido si la visibilidad no es “visibles”; si lo es, queda apagado con el mismo aviso que “revelar al marcar listo”. Al normalizar, si las tarjetas están visibles el flag se guarda en false.
- Se copia al crear la retro, igual que el resto de capacidades. No se edita en Ajustes de la retro ni cambia el catálogo.
- El informe y la retro cerrada siguen mostrando todo: ahí ya no corre la fase.
- Chip en el listado de fases solo cuando la excepción está activa.
- Hay que enhebrar el campo en schema, migración (default false en fases y en retros ya creadas), [phase-rules.ts](backend/src/retros/phase-rules.ts) y su copia del frontend, DTO y servicio de fases, editor, modelos y `getBoard`.

## Columnas de ancho fijo, centradas

En [retro.page.scss](frontend/src/app/pages/retro/retro.page.scss) el tablero es `repeat(auto-fit, minmax(240px, 1fr))`, así que cada columna crece hasta llenar la fila.

- Ancho fijo de 20rem, sin crecer ni achicarse.
- La fila se centra cuando entran menos columnas de las que caben.
- Si no entran, se scrollea en horizontal. El contenedor usa `width: max-content; min-width: 100%` y `justify-content: center`, para que el centrado no recorte la primera columna al scrollear.
- No cambia el plan de acción ni la grilla del semáforo.

## Solo imagen o GIF

En una fase `image_only`, el composer de [retro.page.html](frontend/src/app/pages/retro/retro.page.html) muestra “Imagen / GIF” y, debajo, “Añadir” deshabilitado hasta elegir un archivo.

- Ese caso queda en un solo botón, “Subir imagen / GIF”, que abre el selector. Al elegir el archivo se crea la tarjeta, sin el otro control ni un segundo clic en Añadir.
- Texto, o texto más imagen, siguen con campo, control de imagen opcional y “Añadir”. Ese control opcional quedó como ícono (ver más abajo).
- Editar una tarjeta no cambia el flujo; el mismo ícono reemplaza el texto “Imagen / GIF”.

Al terminar, rebuild de `web` y `api` y aviso de http://localhost:8090.

## Columnas al alto de su contenido

En [retro.page.scss](frontend/src/app/pages/retro/retro.page.scss) la fila estiraba todas las columnas (`align-items: stretch`), cada una tenía `min-height: 280px` y el composer bajaba con `margin-top: auto`. Una columna sin tarjetas quedaba tan alta como la que más tenía, con un hueco en blanco entre el título y el campo.

- La fila usa `align-items: flex-start`. Cada columna mide título, consigna, tarjetas y composer, y crece solo cuando se agrega algo en esa columna.
- La consigna reserva siempre tres renglones (`min-height` de `.col-desc`), aunque el texto entre en menos o falte. Así las columnas vacías arrancan a la misma altura. Si la consigna pasa de tres renglones, esa columna crece.
- Se sacó el alto mínimo de `.column` y el del listado (`.cards` queda `flex: 0 0 auto` y `min-height: 0`). El composer ya no se empuja al fondo.
- En agrupación, el listado vacío conserva un pad de 2.75rem (`.cards.drop-pad` cuando `canGroupDrag()` en [retro.page.html](frontend/src/app/pages/retro/retro.page.html)) para poder soltar una tarjeta ahí.

## Imagen / GIF como ícono

En el composer y al editar, el control opcional “Imagen / GIF” es un botón de 2rem (`.image-pick.icon-only`) con el ícono `#imagePickIcon`, al lado del de emojis. `title` y `aria-label` siguen diciendo “Imagen / GIF”. El botón principal de una fase solo imagen, “Subir imagen / GIF”, sigue con texto: comparte la clase `.image-pick` y no lleva `.icon-only`.
