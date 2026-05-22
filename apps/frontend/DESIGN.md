---
name: PeaKu Design System
colors:
  background: '#FAFAF7'
  foreground: '#1A1F1B'
  card: '#FFFFFF'
  card-foreground: '#1A1F1B'
  popover: '#FFFFFF'
  popover-foreground: '#1A1F1B'
  primary: '#1F6B3A'
  primary-foreground: '#FAFAF7'
  secondary: '#EFEDE5'
  secondary-foreground: '#1A1F1B'
  muted: '#EFEDE5'
  muted-foreground: '#5C6358'
  accent: '#E8A33D'
  accent-foreground: '#1A1F1B'
  destructive: '#A33A2A'
  destructive-foreground: '#FAFAF7'
  border: '#D9D6CC'
  input: '#D9D6CC'
  ring: '#E8A33D'
  success: '#1F6B3A'
  warning: '#E8A33D'
typography:
  display-xl:
    fontFamily: Manrope
    fontSize: 56px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.15'
    letterSpacing: -0.015em
  display-md:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  h2:
    fontFamily: Manrope
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.3'
  h3:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
  label-eyebrow:
    fontFamily: Manrope
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.14em
  mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
spacing:
  reading-column: 680px
  form-column: 480px
  container-max: 1280px
  section-py-desktop: 80px
  section-py-mobile: 48px
radius:
  base: 8px
  sm: 6px
  lg: 12px
  full: 9999px
---

# PeaKu — Design System

> Lenguaje visual del e-commerce agropecuario PeaKu. Esta es la fuente
> de verdad que se sube a Stitch (vía `create_design_system_from_design_md`)
> y la referencia humana cuando alguien dude de un detalle visual.

## 1. Principios

- **Moderno + agro**: tonos verdes y tierra reconocibles, pero con UI
  clean — nada de texturas rústicas, nada de serif editorial pesado,
  nada de íconos de tractor o espigas decorativos.
- **Pro y confiable**: este es un sitio de comercio agropecuario para
  productores y compradores serios — registro institucional, no
  marketplace cualquiera.
- **Restricción de color**: paleta cálida y contenida; el verde es el
  protagonista, el ámbar acentúa, el resto es neutro cálido.
- **Whitespace generoso**: ritmo respirado, no denso. Buenos paddings
  en secciones (`py-12 lg:py-20`).
- **Tipografía geométrica moderna**: Manrope para titulares y UI;
  Inter como fallback para body cuando hace falta más legibilidad en
  cuerpos largos.

## 2. Paleta de color

Tokens en HEX. Mapeo a CSS vars en `apps/frontend/src/styles/theme.scss`
y a Tailwind config en `apps/frontend/tailwind.config.ts`.

| Token | HEX | Uso |
|---|---|---|
| `--background` | `#FAFAF7` | Fondo principal (cream casi blanco, cálido). |
| `--foreground` | `#1A1F1B` | Texto principal (verde-negro, no negro puro). |
| `--card` | `#FFFFFF` | Fondo de cards y dialogs. |
| `--primary` | `#1F6B3A` | Verde campo. Buttons primary, header, links activos. |
| `--primary-foreground` | `#FAFAF7` | Cream sobre verde. |
| `--accent` | `#E8A33D` | Ámbar cosecha. Focus rings, badges destacados, links. |
| `--secondary` / `--muted` | `#EFEDE5` | Hints, filas alternas, backgrounds sutiles. |
| `--muted-foreground` | `#5C6358` | Texto secundario, eyebrows, helper text. |
| `--border` / `--input` | `#D9D6CC` | Bordes neutros cálidos. |
| `--destructive` | `#A33A2A` | Terracota. Errores, "eliminar" (NO rojo SaaS chillón). |
| `--success` | `#1F6B3A` | Reusa primary. |
| `--ring` | `#E8A33D` | Focus rings en ámbar. |

## 3. Tipografía

- **Titulares / UI**: **Manrope** (Google Fonts), weights 600–700.
- **Body**: **Inter** (Google Fonts), weights 400–600.
- **Mono** (SKUs, IDs, números técnicos): **JetBrains Mono**, weight 500.

### Escala

| Estilo | Tamaño | Line-height | Letter-spacing |
|---|---|---|---|
| `display-xl` | `3.5rem` (56px) | `1.1` | `-0.02em` |
| `display-lg` | `2.5rem` (40px) | `1.15` | `-0.015em` |
| `display-md` | `1.75rem` (28px) | `1.2` | `-0.01em` |
| h2 | `1.375rem` (22px) | `1.3` | normal |
| h3 | `1.125rem` (18px) | `1.4` | normal |
| body | `0.9375rem` (15px) | `1.6` | normal |
| body-sm | `0.8125rem` (13px) | `1.5` | normal |
| label-eyebrow | `0.6875rem` (11px) | `1.4` | `0.14em` UPPERCASE |
| mono | `0.8125rem` (13px) | normal | normal |

### Eyebrows

Etiquetas pequeñas sobre headings, en uppercase + tracking generoso
(`text-xs tracking-widest text-muted-foreground font-semibold`). Sello
editorial moderno sin pretensión. Útil sobre secciones grandes y sobre
grupos de campos en forms.

### Tabular nums

SKUs, precios, stock y cualquier columna numérica usan
`font-variant-numeric: tabular-nums` para alineación vertical limpia.

## 4. Spacing

Escala Tailwind default (4px base).

- **Sections**: `py-12 lg:py-20` (48–80px vertical).
- **Container**: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` (1280px).
- **Reading column** (artículos, copy largo): max-width 680px.
- **Form column**: max-width 480px.
- **Gap entre cards**: `gap-6` (24px).

## 5. Border radius

- **base** `8px` — buttons, inputs, badges, cards.
- **sm** `6px` — chips compactos, tags pequeños.
- **lg** `12px` — dialogs, popovers, hero panels.
- **full** — avatares (único uso de `rounded-full`).

NO usar `rounded-2xl` ni `rounded-3xl` — caen en estética AI-SaaS.

## 6. Sombras

Sutiles, nunca dramáticas.

- Cards en reposo: `border-1px` sólo, sin sombra.
- Cards interactivos (hover): `shadow-sm` (`0 1px 2px rgba(0,0,0,0.05)`).
- Popovers/dropdowns: `shadow-md` (`0 4px 12px rgba(26,31,27,0.08)`).
- NUNCA `shadow-xl` / `shadow-2xl`.

## 7. Componentes

### Button

Radius 8px, font-semibold, height regular 40px / sm 32px / lg 48px.

| Variant | Estilo |
|---|---|
| `default` | Fill `--primary` (verde campo), texto `--primary-foreground`. |
| `outline` | 1px border `--border`, fondo transparente, texto `--foreground`. |
| `ghost` | Sin border, hover `bg-muted`. |
| `destructive` | Fill `--destructive` (terracota), texto cream. |
| `accent` | Fill `--accent` (ámbar), texto `--foreground`. Uso esporádico. |

Focus: `ring-2 ring-accent ring-offset-2`.

### Input

- Height 40px, radius 8px.
- 1px border `--input`.
- Focus: border cambia a `--accent`, ring suave.
- `aria-invalid`: border `--destructive`.
- Placeholder en `--muted-foreground`.

### Label

`text-sm font-medium text-foreground` arriba del input. Sin uppercase
acá (los eyebrows son para secciones, no para labels de form).

### Card

- Radius 8px, `border-1px` `--border`, fondo `--card`.
- Padding default `p-6` (24px).
- Sin sombra en reposo.

### Badge / Chip

- Radius 6px, padding `px-2 py-0.5`, `text-xs font-medium`.
- Variants:
  - `default`: `bg-muted text-foreground` (categorías).
  - `success`: `bg-primary/10 text-primary` (en stock, activo).
  - `warning`: `bg-accent/15 text-accent-foreground` (low stock).
  - `destructive`: `bg-destructive/10 text-destructive` (sin stock, inactivo).

### Table (lista de productos)

- Header en `bg-muted/50`, eyebrow style (`text-xs uppercase tracking-wider text-muted-foreground`).
- Filas con `border-b border-border`, hover `bg-muted/30`.
- SKU en mono (`JetBrains Mono`).
- Precios y stock con `tabular-nums`.
- Acciones de fila: íconos lucide (edit, trash) en `--muted-foreground`,
  hover a `--foreground` (edit) o `--destructive` (delete).

### Header (top nav)

Layout: logotipo izquierda + nav center + user menu derecha.

- Background `bg-background/80 backdrop-blur` + `border-b border-border`.
- Logo: "PeaKu" en Manrope semibold, opcionalmente acompañado por un
  punto/separador en `--accent`.
- Nav links: `text-sm font-medium`, hover underline offset.
- User menu: avatar circular (32px) + nombre + caret.

### Dialog / Modal

- Radius 12px, fondo `--card`, padding `p-6`.
- Backdrop `bg-foreground/40 backdrop-blur-sm`.
- Animación: fade-in + scale-in (95% → 100%), sin bounce.

## 8. Detalles de marca

- **Eyebrows sobre secciones**: small caps + tracking generoso.
- **Numeración tabular** en SKUs, precios, stock.
- **Underline links con offset** `underline-offset-4` — convención
  hipertexto, nunca solo color.
- **Categorías** como badges sutiles (`bg-muted`), no como pills
  vibrantes.

## 9. Imagery

- Fotografía real de campo, cultivos, lotes, cosechas — luz natural,
  composición editorial. Nada de stock AI-generated.
- Overlay gradient `from-background to-transparent` sobre imagen
  cuando va texto encima.
- Sin carruseles automáticos en home.

## 10. Voice & tone

- **Español es-LA** (LATAM neutral, voseo donde natural).
- **Registro pro-cercano**: "Crear cuenta", "Iniciar sesión",
  "Mis productos", "Nuevo producto" — claridad sobre marketing.
- **Sin emojis** en UI. Excepción razonada: ninguna por ahora.
- **Texto de error específico**: "El SKU ya existe" en vez de
  "Algo salió mal".

## 11. Anti-patrones (qué NO hacer)

- ❌ `rounded-xl`, `rounded-2xl`, `rounded-3xl`.
- ❌ Gradientes vibrantes azul/violeta SaaS.
- ❌ Glassmorphism con bordes blanco/10.
- ❌ Sombras dramáticas (`shadow-xl`+).
- ❌ Íconos lucide-react decorativos (tractor, hoja, planta).
  Sólo íconos funcionales (search, plus, edit, trash, x, check).
- ❌ Hero con "floating feature cards" estilo Stripe.
- ❌ Emojis 🌱🚜🌾.
- ❌ Copy hyper-CTA tipo "Get started for free in seconds!".
- ❌ Verde fluo (`#00FF00`), verde neon, verde menta saturado.
- ❌ Negro puro (`#000`) — usar `--foreground` (`#1A1F1B`).
- ❌ Texturas de papel kraft o pasto.

## 12. Pantallas iniciales

Las 3 primeras pantallas a generar en Stitch (DESKTOP):

1. **Login** — split layout. Form a la izquierda (email + password,
   botón primary "Iniciar sesión", link "Crear cuenta" en accent).
   Imagen editorial de campo/cultivo a la derecha con overlay sutil.

2. **Lista de productos** — top bar con search (lucide `Search`) +
   filtro categoría (`Select`). Tabla con columnas: SKU (mono),
   Nombre, Categoría (badge), Precio (tabular), Stock (tabular),
   Estado (badge verde/rojo), Acciones. Paginación abajo derecha.
   CTA "+ Nuevo producto" arriba derecha en verde primary.

3. **Form producto** — dialog o página dedicada con campos: SKU,
   Nombre, Descripción (textarea 4 rows), Categoría (select),
   Precio (con prefijo `$`), Stock, Activo (switch). Footer con
   "Cancelar" (ghost) + "Guardar" (primary).