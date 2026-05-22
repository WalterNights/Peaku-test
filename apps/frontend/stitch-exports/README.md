# Stitch Exports — PeaKu

> Fuente de verdad visual aprobada por el usuario el 2026-05-21.
> Estos archivos son la referencia exacta para la implementación Angular en `apps/frontend/`.
> **No editar manualmente** — si querés iterar el diseño, hacelo en Stitch y volvé a exportar (ver §Re-export).

## Estructura

```
stitch-exports/
├── README.md                       # este archivo
├── login/
│   ├── screen.html                 # HTML+Tailwind crudo de Stitch (auto-contenido)
│   ├── preview.png                 # screenshot del diseño aprobado
│   └── metadata.json               # IDs, dimensiones, link al proyecto Stitch
├── register/
│   ├── screen.html
│   ├── preview.png
│   └── metadata.json
├── products-list/
│   ├── screen.html
│   ├── preview.png
│   └── metadata.json
├── product-form/
│   ├── screen.html
│   ├── preview.png
│   └── metadata.json
└── assets/
    ├── login-field.jpg             # foto editorial del campo (login)
    └── register-hands.jpg          # close-up de manos sosteniendo granos (register)
```

Los `screen.html` se pueden abrir directamente en el navegador (doble-click) — son auto-contenidos: cargan Tailwind desde CDN y la única imagen externa que existía (la foto del campo en el login) fue reemplazada por una ruta relativa local (`../assets/login-field.jpg`).

## Cómo usar estos exports

**Política aprobada**: hybrid (opción C) — conservar 100% del look visual de Stitch.

| Pantalla | Implementación Angular planeada |
|---|---|
| Login | HTML+Tailwind directo (1:1 con `login/screen.html`), sin Material |
| Header / layout / badges / eyebrows / cards | HTML+Tailwind directo desde los exports |
| Tabla de productos | `MatTable` + `MatPaginator` con custom theme que mimetiza el design system |
| Form producto | `MatFormField` + `MatSelect` + `MatSlideToggle` con el mismo custom theme |
| Imagen del login | Servida desde `apps/frontend/public/assets/login-field.jpg` (copiada al bootstrap) |

Todo el resto (paleta, tipografía, eyebrows, badges, spacing, radius) sigue [apps/frontend/DESIGN.md](../DESIGN.md) — single source of truth.

## Proyecto Stitch de origen

- **Project**: `projects/7310815548639251933` — *PeaKu — E-commerce Agropecuario*
- **Design system asset**: `assets/596430d1ddac4333b077314c930e4fe3` (derivado de `apps/frontend/DESIGN.md`)
- **URL**: [stitch.withgoogle.com](https://stitch.withgoogle.com) → buscar el proyecto en tu lista

Para más detalles del flujo Stitch ⇄ Claude ⇄ Angular, ver la skill `.claude/skills/stitch-mcp-workflow.md`.

## Re-export (si el diseño se itera)

Si en Stitch retocás un screen y querés bajar la nueva versión:

1. Identificar el `screenId` actualizado (puede cambiar si lo regenerás desde cero, no cambia si lo edita `edit_screens`).
2. Llamar `mcp__stitch__get_screen` con el resource name → tomar `htmlCode.downloadUrl` + `screenshot.downloadUrl`.
3. Bajar ambos archivos sobreescribiendo `<screen>/screen.html` y `<screen>/preview.png`.
4. Re-parsear el HTML buscando `<img src=...>` y `url(...)` por nuevas URLs externas; bajarlas a `assets/` y reemplazar las URLs en el HTML por la ruta relativa.
5. Actualizar `metadata.json` (especialmente el `screenId` si cambió y `generatedAt`).
6. Re-ejecutar la implementación Angular del screen afectado.

## Lo que NO está acá

- **Versiones mobile**: aún no generadas. La doc dice que se generan después con `generate_variants` o `generate_screen_from_text` + `deviceType: MOBILE`.
- **Pantalla "Crear producto"**: el actual es modo *editar*. La versión create del form vendría como variante.
- **Modal de historial de producto**: sugerencia del modelo, no generada.
