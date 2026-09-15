---
name: Planillas fondo difuminado
overview: Mostrar el color/imagen de fondo de cada plantilla en las cards de `/templates`, con un leve blur y un velo semitransparente para que el texto siga legible sobre fondos claros.
todos:
  - id: card-theme-markup
    content: Bind backgroundColor/backgroundImageUrl y capa de imagen en template-card
    status: completed
  - id: card-blur-veil
    content: "CSS: blur leve en imagen + velo color-mix + z-index/acciones legibles"
    status: completed
  - id: rebuild-web
    content: Rebuild Docker web y avisar URL localhost
    status: completed
isProject: false
---

# Fondo difuminado en cards de plantillas

## Contexto

Los campos `backgroundColor` y `backgroundImageUrl` ya existen en `Template` (Prisma + API + modelo frontend) y se usan en el editor ([`template-editor.page.ts`](frontend/src/app/pages/templates/template-editor.page.ts)) y en el board en vivo ([`retro.page.scss`](frontend/src/app/pages/retro/retro.page.scss)).

Las cards de la lista en [`templates.page.ts`](frontend/src/app/pages/templates/templates.page.ts) hoy ignoran esos campos y usan el `.card` opaco (`background: var(--color-bg)`).

## Enfoque

Solo UI en la lista de plantillas. Sin cambios de backend.

En cada `.template-card` con tema:

1. Aplicar `backgroundColor` inline y clase `has-theme` si hay color o imagen.
2. Si hay `backgroundImageUrl`, capa absoluta tipo `.retro-scene-bg` / `.preview-bg` con `background-size: cover`.
3. **Difuminado leve** en la capa de imagen (`filter: blur(6px)` + `inset` negativo para no ver bordes).
4. **Velo semitransparente** encima (`::after` con `color-mix(in srgb, var(--color-bg) ~55%, transparent)`) para que fondos claros no maten el texto blanco/gris. El blur solo no alcanza con un color sólido claro.
5. Contenido (`.template-main`, `.template-actions`) con `z-index` por encima del fondo/velo.
6. Botones editar/borrar con fondo `color-mix` leve bajo `has-theme` para no perderse sobre la imagen.

Cards sin tema quedan iguales (`.card` actual).

## Archivo a tocar

- [`frontend/src/app/pages/templates/templates.page.ts`](frontend/src/app/pages/templates/templates.page.ts) — markup del `@for` + estilos locales (mismo patrón que el preview del editor).

## Fuera de alcance

- Selector de plantilla al crear retro (sigue siendo `<select>`).
- Board en vivo / preview del editor (ya tienen su tratamiento).
