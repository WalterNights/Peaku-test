---
name: stitch-mcp-workflow
description: Use ALWAYS when working on UI/UX for `apps/frontend` (Angular 18 + Material + Tailwind) in this project. Encapsula el flujo Stitch (Google) vía MCP — descubrimiento de proyectos, extracción de design tokens, fetch de screens y conversión a componentes Angular Material idiomáticos. Triggers — Spanish "diseño", "Stitch", "mockup", "UI/UX", "design tokens", "paleta", "tipografía", "screen", "pantalla", "convertir HTML a Angular" — English "design", "Stitch", "mockup", "UI/UX", "design tokens", "palette", "typography", "screen", "convert HTML to Angular". Evita tener que re-leer docs/03-plan-frontend.md §1.1 cada vez.
---

# Stitch MCP Workflow (PeaKu-prueba)

Esta skill condensa el flujo de diseño con Google Stitch para que **no necesites re-leer la doc** en cada sesión. Fuente original: [docs/03-plan-frontend.md §1.1](../../docs/03-plan-frontend.md#L14). Si entran en conflicto, manda la doc — pero avisá al usuario.

## TL;DR del flujo

1. **Diseñar en Stitch** los screens principales (login, lista de productos, formulario crear/editar). Modo Experimental = alta fidelidad.
2. **Extraer design tokens UNA vez** → volcar a `apps/frontend/DESIGN.md` (single source of truth visual).
3. **Mapear tokens a Tailwind + Angular Material** (mismas variables CSS compartidas).
4. **Generar componentes pantalla por pantalla** vía MCP, adaptando a Material idiomático.
5. **Iterar**: cambio en Stitch → re-fetch vía MCP → diff contra componente actual.

## Dónde vive la config

- **`.mcp.json` en el root del proyecto** (gitignored) — define el server `stitch` con `command`, `args`, y `env.STITCH_API_KEY`. Esto es lo que Claude Code lee para spawn-ear MCP servers locales.
- **`.claude/settings.local.json`** (gitignored) — sólo lleva `"enabledMcpjsonServers": ["stitch"]` para autorizar el server del `.mcp.json`.

NO pongas el bloque `"mcpServers": {...}` adentro de `settings.local.json` — Claude Code lo ignora. El nombre `enabledMcpjsonServers` es la pista: refiere a entradas de `.mcp.json`.

## Proyecto activo de PeaKu en Stitch (sesión 2026-05-21)

| Recurso | ID |
|---|---|
| Project | `7310815548639251933` (título: *PeaKu — E-commerce Agropecuario*) |
| Design system (asset) | `assets/596430d1ddac4333b077314c930e4fe3` (derivado de `apps/frontend/DESIGN.md`) |
| Screen Login (UI con HTML) | `9dc104030b7d4c77a066be10c7bc3d93` (título *PeaKu - Login Screen*) |
| Asset foto del campo (usado por login) | `031b5cfc1aa94444987fe92cc85f8207` — sólo screenshot, sin HTML |
| Screen Register (UI con HTML) | `047f0a26689140e6b5ff52bdbb043b39` (título *PeaKu - Crear cuenta*) |
| Asset foto manos con granos (usado por register) | `080199f7e88745b78c16a19de2a5bfcf` — sólo screenshot, sin HTML |
| Screen Lista productos | `c08f53d407864ee78cdaf289b03b1595` (título *PeaKu - Mis Productos*) |
| Screen Form producto (editar) | `c604e5345b92436497a44bb4d3d71717` (título *PeaKu - Editar Producto*) |
| Screen DESIGN.md (sistema) | `638125203203454843` |

Cuando uses tools del MCP siempre referenciá estos IDs. Si vas a generar screens nuevos, pasá `designSystem: "assets/596430d1ddac4333b077314c930e4fe3"` para consistencia.

**Aprendizaje no-obvio**: `generate_screen_from_text` puede generar **dos** screens en una llamada — el screen UI con HTML codificable, y un asset PNG aparte (cuando el prompt incluye descripción detallada de imagen). El primer `outputComponents[0].design.screens[0]` que devuelve el tool puede ser el asset, no el UI. Verificar siempre con `list_screens` para identificar el screen con `htmlCode.downloadUrl` no vacío — ese es el UI real. Los exports están en [`apps/frontend/stitch-exports/`](../../apps/frontend/stitch-exports/README.md) (auto-contenidos, sin dependencia de CDN externo).

## Tools del MCP `stitch` (verificadas 2026-05-21)

| Tool | Para qué sirve |
|------|----------------|
| `list_projects` | Lista los proyectos del usuario en Stitch. Filter `view=owned` / `view=shared`. |
| `get_project` | Trae info completa de un proyecto (incluye design system, screen instances, thumbnails). |
| `create_project` | Crea proyecto nuevo. Sólo necesita `title`. |
| `list_screens` | Lista screens de un proyecto por `projectId`. |
| `get_screen` | Trae el HTML/Tailwind/code crudo de un screen. **Template plano, no Material idiomático.** |
| `generate_screen_from_text` | Genera screen desde prompt. Pasar `designSystem`, `deviceType` (DESKTOP/MOBILE/TABLET/AGNOSTIC), `modelId` (preferir `GEMINI_3_1_PRO`). Demora minutos, NO reintentar — si timeout, pollear `get_screen`. |
| `edit_screens` | Edita screens existentes. |
| `generate_variants` | Genera variantes (mobile, A/B, etc.) de un screen. |
| `upload_design_md` | Sube DESIGN.md base64-encoded. Devuelve `selectedScreenInstance` para usar en `create_design_system_from_design_md`. |
| `create_design_system_from_design_md` | Convierte DESIGN.md subido en design system aplicable. Devuelve `assetId`. |
| `apply_design_system` / `update_design_system` / `list_design_systems` / `create_design_system` | Operaciones del design system. |
| `download_assets` | Baja assets generados. |

> El response de `generate_screen_from_text` y `get_screen` incluye una `screenshot.downloadUrl` (Google CDN) — sirve como vista previa visual sin tool aparte. El response también puede ser muy grande y caer al disco como tool result; usar Node/Python para parsear `outputComponents[].design.screens[0].id` sin leer el HTML completo en contexto.

> Si las tools no aparecen en la sesión actual (revisa el listado `mcp__stitch__*`), el wrapper requiere **reinicio completo de Claude Code** — en VS Code eso significa **"Developer: Reload Window"** desde la paleta de comandos (`Ctrl+Shift+P`), NO cerrar/abrir el panel. El watcher de config no recarga MCP servers en caliente.

## Pre-flight check (antes de invocar tools del MCP)

1. Verificar que `.mcp.json` en el root del proyecto tiene el bloque `mcpServers.stitch` con `STITCH_API_KEY` no vacío.
2. Verificar que `.claude/settings.local.json` tiene `"enabledMcpjsonServers": ["stitch"]`.
3. Verificar que en el listado de tools aparezcan funciones `mcp__stitch__*`. Si no aparecen → pedir al usuario que haga "Developer: Reload Window" en VS Code antes de continuar.
4. **Nunca commitear** `.mcp.json` ni `.claude/settings.local.json` — `.gitignore` los excluye a ambos. Si vas a tocar esos archivos, no hagas `git add` sobre ellos.
5. Diagnóstico rápido si el server no arranca: correr `cmd //c "set STITCH_API_KEY=<key> && npx -y @_davideast/stitch-mcp doctor"` — valida API key + endpoint Stitch. Si el doctor pasa pero las tools no aparecen, el problema es el spawn del cliente (config en archivo incorrecto, falta reload, etc.), no del wrapper.

## Paso 1 — Extraer design tokens (correr UNA sola vez por proyecto)

Prompt-pattern del usuario que deberías reconocer y ejecutar:

> *"Usá el Stitch MCP — listá proyectos y traeme paleta, tipografía y spacing del proyecto '\<nombre\>'. Volcá todo a `apps/frontend/DESIGN.md`."*

Pasos:

1. `list_projects` → identificar el ID del proyecto correcto.
2. `get_screen_code` + `get_screen_image` sobre 2-3 screens representativos.
3. Inferir tokens del CSS/Tailwind extraído (colores hex, font-families, spacing scale, radii, shadows).
4. Escribir `apps/frontend/DESIGN.md` con secciones: **Paleta** (primary, accent, warn, neutral), **Tipografía** (family, sizes, weights), **Spacing**, **Radii**, **Shadows**.

`apps/frontend/DESIGN.md` es **single source of truth visual** — toda decisión de UI posterior cita este archivo.

## Paso 2 — Mapear tokens a Tailwind + Material

- **Paleta** → `apps/frontend/tailwind.config.ts` en `theme.extend.colors`.
- **La misma paleta** → custom theme Angular Material vía `mat.define-theme()`. Así Material y Tailwind comparten variables CSS (no duplicás colores).
- **Tipografía** → `mat.define-typography-config()` + `font-family` de Tailwind apuntando al mismo stack.

## Paso 3 — Generar componentes pantalla por pantalla

Prompt-pattern del usuario:

> *"Usá el Stitch MCP — `get_screen_image` de la pantalla '\<nombre\>' y `get_screen_code`. Adaptá el HTML a un standalone Angular 18 component usando \<MatTable+MatPaginator | MatStepper | etc.\>, Tailwind para layout, signals para state. Aplicá `OnPush`."*

Reglas de adaptación obligatorias (Stitch entrega HTML plano, vos lo hacés Material idiomático):

- `<button>` plano → `<button mat-raised-button>` / `mat-stroked-button` / `mat-icon-button` según contexto.
- `<input>` suelto → `<mat-form-field>` con `<mat-label>` (nunca placeholder-as-label).
- Tablas HTML → `MatTable` + `MatPaginator` + `MatSort`.
- Modales → `MatDialog`.
- Selects → `MatSelect`.
- Validar el output contra la skill [`angular-clean-code`](angular-clean-code.md): standalone, signals, `OnPush`, `@if/@for`, no `any`, a11y.

## Paso 4 — Iteración

Cuando el usuario actualiza el diseño en Stitch:

1. Re-fetch del screen vía `get_screen_image` + `get_screen_code`.
2. Diff visual contra el componente actual.
3. Aplicar sólo los cambios diff — no re-generar el componente desde cero (perderías la lógica Material/signals/store).

## Caveats honestos

- Stitch genera **templates Angular crudos**, no componentes Material idiomáticos → el paso 3 SIEMPRE requiere adaptación manual.
- El wrapper `@_davideast/stitch-mcp` está marcado **experimental**. Si rompe: fallback a OAuth con `gcloud auth application-default login` + `STITCH_USE_SYSTEM_GCLOUD=true` (ver `stitch.withgoogle.com/docs/mcp/setup/`).
- La API key de Stitch vive sólo en `.claude/settings.local.json` (gitignored). Nunca la incluyas en código, docs, ni mensajes de commit.

## Stack frontend al que se integra esto

- Angular ≥ 18, standalone components, signals
- Angular Material + Tailwind CSS (theming compartido)
- NgRx Signal Store para estado
- Reactive Forms tipados
- Reglas completas en skill [`angular-clean-code`](angular-clean-code.md)