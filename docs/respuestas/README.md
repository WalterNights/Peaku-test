# Respuestas teóricas — Ej. 3, 4, 5

Carpeta con los **3 ejercicios teóricos** que pide el PDF de la prueba, listos para consolidar en un único PDF de entrega.

| # | Ejercicio | Archivo |
|---|---|---|
| 3 | Arquitectura de microservicios para e-commerce agropecuario | [`ejercicio-3-microservicios.md`](./ejercicio-3-microservicios.md) |
| 4 | Optimización de rendimiento web (mobile-first, ≥ 3 técnicas) | [`ejercicio-4-rendimiento.md`](./ejercicio-4-rendimiento.md) |
| 5 | Seguridad en APIs y Cloud (OAuth vs JWT, fuerza bruta, MongoDB, deploy) | [`ejercicio-5-seguridad.md`](./ejercicio-5-seguridad.md) |

> **Sección uso de IA**: el contenido del Ej. "Uso de IA" del PDF vive en [`../05-uso-ia.md`](../05-uso-ia.md). Conviene incluirla en el PDF final.

---

## Cómo armar el PDF de entrega

### Opción A — Pandoc (recomendada — output limpio, sin VS Code)

```bash
# Instalar pandoc + LaTeX (una sola vez)
# Windows: choco install pandoc miktex
# macOS:   brew install pandoc basictex
# Linux:   apt install pandoc texlive-xetex

# Desde el root del repo:
pandoc \
  docs/respuestas/ejercicio-3-microservicios.md \
  docs/respuestas/ejercicio-4-rendimiento.md \
  docs/respuestas/ejercicio-5-seguridad.md \
  docs/05-uso-ia.md \
  -o PeaKu-Respuestas-Teoricas.pdf \
  --pdf-engine=xelatex \
  --toc \
  --metadata title="PeaKu — Respuestas Teóricas" \
  --metadata author="Walter Hernández" \
  --metadata date="$(date +%Y-%m-%d)" \
  -V geometry:margin=2cm \
  -V mainfont="Inter" \
  -V monofont="JetBrains Mono"
```

Output: **`PeaKu-Respuestas-Teoricas.pdf`** con índice, ~12-15 páginas.

### Opción B — VS Code Markdown PDF (sin instalar nada extra)

1. Instalar la extensión **Markdown PDF** (`yzane.markdown-pdf`) en VS Code.
2. Abrir cada `.md` por separado.
3. `Ctrl+Shift+P` → `Markdown PDF: Export (pdf)`.
4. Combinar los 4 PDFs con cualquier merger (Adobe, online, [pdftk](https://www.pdftk.org/)):
   ```bash
   pdftk ejercicio-3-microservicios.pdf ejercicio-4-rendimiento.pdf \
         ejercicio-5-seguridad.pdf 05-uso-ia.pdf \
     cat output PeaKu-Respuestas-Teoricas.pdf
   ```

### Opción C — Marp (slides → PDF)

Si querés un formato más visual tipo slides:

```bash
npm install -g @marp-team/marp-cli
marp docs/respuestas/ejercicio-4-rendimiento.md --pdf
```

(Requiere un `marp: true` en el frontmatter de cada `.md` — no agregado por default.)

---

## Estructura recomendada del PDF final

```
1. Carátula (título + autor + fecha)
2. Tabla de contenidos
3. Ejercicio 3 — Arquitectura de Microservicios          (~3-4 págs)
4. Ejercicio 4 — Optimización de Rendimiento Web         (~2-3 págs)
5. Ejercicio 5 — Seguridad en APIs y Cloud               (~3-4 págs)
6. Uso de IA (herramientas, prompts, validaciones)       (~2-3 págs)
```

Total estimado: **12-15 páginas A4**, en línea con lo que el PDF de la prueba sugiere (no menciona límite explícito).

---

## Antes de enviar el PDF

Verificá:
- [ ] Que cada ejercicio tenga **título, consigna explícita, respuesta**.
- [ ] Que las referencias al código del repo apunten a archivos que existen (`apps/...`, `docs/...`).
- [ ] Que no haya ningún token/API key copiado por error.
- [ ] Que el `Uso de IA` esté incluido — es un requisito del PDF.

Después seguí el [`PRE-ENTREGA-CHECKLIST.md`](../../PRE-ENTREGA-CHECKLIST.md) en la raíz para limpiar el repo antes de comprimirlo y enviarlo junto con el PDF.
