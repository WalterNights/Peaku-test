# 📦 Pre-entrega — Checklist antes de comprimir el repo

> **NO COMMITEAR este archivo al repo final.** Se incluye para uso personal del candidato.
> Borrarlo (o moverlo a `docs/`) antes de comprimir si querés que el evaluador no lo vea.

---

## 🔴 Crítico — SECRETS

La API key de Stitch quedó referenciada en varios lugares durante el desarrollo. Antes de comprimir, **eliminá estos archivos** (todos están en `.gitignore`, pero comprimís la carpeta entera, no clonás el git):

```bash
# Desde la raíz del repo:
rm -f .mcp.json                         # API key Stitch
rm -f .claude/settings.local.json       # API key Stitch (duplicada)
rm -f .env                              # Secrets reales (JWT, Mongo URIs)

# Verificar que NO quedan referencias visibles:
grep -rE "AQ\.[A-Za-z0-9_-]{20,}" . --exclude-dir=node_modules --exclude-dir=.git
# Si encuentra algo → revisar y limpiar antes de seguir.
```

### 🟡 .git history contiene la key

Durante el desarrollo, la API key se commiteó en una versión previa del `.claude/settings.json` (entrada `Bash(cmd //c "set STITCH_API_KEY=...")`). El HEAD actual ya está limpio, **pero los commits viejos no**.

**Si vas a incluir `.git` en el ZIP**, dos opciones:

**Opción A — Eliminar `.git` del ZIP (simple, recomendada)**:
```bash
rm -rf .git    # el evaluador no necesita la history para evaluar el código
```

**Opción B — Limpiar history (avanzada)**:
```bash
# git filter-repo o BFG para eliminar la línea de todos los commits.
# Riesgoso, sólo si necesitás conservar history.
```

### 🛡 Recomendación final

**Rotá la API key de Stitch** desde https://stitch.withgoogle.com/settings antes de enviar. Aunque hagas todo lo anterior, una key expuesta es una key comprometida — siempre conviene rotarla.

---

## 🟢 Tamaño — qué sacar para reducir el ZIP

```bash
# Pesados, no aportan al evaluador:
rm -rf node_modules                                # 501 MB
rm -rf apps/*/dist apps/*/node_modules             # builds intermedios
rm -rf apps/frontend/dist                          # 1 MB
rm -rf apps/frontend/.angular                      # cache Angular
rm -rf coverage .nyc_output                        # si existen
rm -rf logs *.log                                  # logs locales
```

Después de esta limpieza, el ZIP debería pesar **< 5 MB** (solo código + docs + assets necesarios).

---

## 📋 Checklist completo en orden

Copiá y pegá este script desde la raíz del repo. **Hacé un backup antes** (ej. duplicar la carpeta):

```bash
# 1. Backup por las dudas
cp -r ../PeaKu-prueba ../PeaKu-prueba-backup-$(date +%Y%m%d)

# 2. Limpiar secrets + datos personales
rm -f .mcp.json
rm -f .claude/settings.local.json
rm -f .env
# .claude/settings.json tiene tu email personal en allow rules de git commit.
# Lo más simple: borrar el archivo entero (las skills siguen en .claude/skills/).
rm -f .claude/settings.json

# 3. Limpiar pesados
rm -rf node_modules
rm -rf apps/*/dist apps/*/node_modules
rm -rf apps/frontend/dist apps/frontend/.angular
rm -rf logs coverage .nyc_output

# 4. (Opcional pero recomendado) Eliminar .git
rm -rf .git

# 5. Verificar no haya keys leak
grep -rE "AQ\.[A-Za-z0-9_-]{20,}" . --exclude-dir=node_modules 2>&1 || echo "OK — no quedan keys"

# 6. (Opcional) Eliminar este checklist
rm PRE-ENTREGA-CHECKLIST.md

# 7. Comprimir desde el directorio padre
cd ..
zip -r PeaKu-prueba-entrega.zip PeaKu-prueba -x "*/node_modules/*" "*/.git/*" "*/dist/*"
```

---

## ✅ Verificación final antes de enviar

| Item | OK? |
|---|---|
| ZIP < 10 MB | ☐ |
| No contiene `node_modules/` | ☐ |
| No contiene `.mcp.json` ni `.claude/settings.local.json` | ☐ |
| No contiene `.env` (solo `.env.example`) | ☐ |
| `grep -r "AQ\." .` no devuelve nada | ☐ |
| README explica cómo correr el proyecto desde 0 | ☐ |
| `docs/respuestas/` tiene los 3 ejercicios teóricos | ☐ |
| Cuentas demo de seed funcionan (`admin@peaku.test` / `Admin1234!`) | ☐ |
| **API key de Stitch rotada** en la UI de Stitch | ☐ |

---

## ✉ Cómo enviar

1. Adjuntar el ZIP al mail.
2. En el cuerpo del mail, incluir:
   - Link a la URL pública del repo (si lo subiste a GitHub público después de la limpieza).
   - Resumen breve: 3 microservicios + Angular 21 + JWT + Swagger + CRUD + responsive + dev tools.
   - Instrucción mínima: "Para correr: `pnpm install && pnpm dev`. Detalles en README.md".
3. Adjuntar también el PDF teórico (si lo armaste con `pandoc` desde `docs/respuestas/`).
