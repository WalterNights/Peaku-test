---
name: dependency-security-check
description: BLOCKING — invoke ALWAYS before any package install, version bump, dependency add, or base image change, regardless of who initiated it (user request OR your own initiative). This is non-optional. The skill audits CVEs, provenance, release age and engine compatibility BEFORE installing, enforcing the project's supply-chain policy from docs/04-seguridad.md §13. Triggers — Spanish "instalar paquete", "agregar dependencia", "agregar dep", "agregá X", "instalá Y", "subir versión", "bump", "actualizar paquete", "actualizar versión", "subir Node", "subir pnpm", "agregar al package.json" — English "install package", "add dependency", "add dep", "upgrade", "bump version", "update package", "pin version", "add to package.json", "switch base image". Also self-invoke when YOU decide that a new dependency, override or base-image change is needed — even if the user didn't ask.
---

# Dependency Security Check — pre-install gate

This skill enforces the project's supply-chain policy. **Run BEFORE any package install, version bump, or base image change, regardless of who initiated it.** Do not invoke `pnpm install`, `npm install`, `pnpm add`, or modify versions until every pre-flight check below passes (or the user explicitly accepts the risk in writing).

**This applies to your own initiative too**: if while implementing a task you decide that you need to add a new dependency, override a transitive version, or bump a base image, **stop and invoke this skill first**. Do not justify "it's a small bump, it's just a devDep, it's just an override" — the past incidents (`eslint-config-prettier@9.1.2`, `axios@1.7.9`, `node:22.13`, `pnpm@11.0.0`) were all "small" decisions that introduced real CVEs.

The goal is to never repeat what happened with `eslint-config-prettier@9.1.2`, `mongoose@8.9.0`, `axios@1.7.9`, `node:22.13-alpine`, `pnpm@11.0.0` — versions chosen without an audit and that turned out to have CVEs or operational bugs.

## When this skill MUST be invoked

### A. Triggered by user request
- "instalá X" / "install X" / "add Y as a dep" / "bumpea Z" / "upgrade pnpm" / "subí Node".
- User asks "qué versión de X debería usar".

### B. Triggered by YOUR OWN initiative (equally mandatory)
This is the critical part. Even if the user did NOT ask, run this skill when:

- You are about to edit `package.json` / `pnpm-workspace.yaml` / `.npmrc` to add or upgrade a version, *because the task you're working on requires it*.
- You are about to change `FROM node:X` in any Dockerfile.
- You are about to add an `override` in `pnpm-workspace.yaml`.
- You are about to run `pnpm install`, `pnpm add`, `npm install`, `npm i`, `pnpm dlx` — **even if the install is implicit** (e.g., scaffolding `nest new`, `ng new`, `create-react-app`, `npx create-*`).
- You are about to suggest a dependency in a code snippet ("podemos usar la lib X") — verify it before recommending.
- You are about to write a new test that pulls a `@types/*` package not currently in the project.
- You are reading an error message that suggests "install package Y to fix" and you are about to do it.

### C. Anti-patterns to catch yourself in

If you think any of these, **STOP and invoke this skill**:
- "Es solo una devDep, no afecta producción". ← `eslint-config-prettier` era devDep y fue compromised.
- "Es solo un patch bump, no debería romper nada". ← `axios 1.7.9` era un patch reciente con SSRF.
- "Es un paquete super conocido, debe estar bien". ← `chalk`, `debug` fueron comprometidos en sep-2025 con 2.6B descargas/sem.
- "Voy a usar `^X` así toma el último". ← floating versions en Docker = unreproducible + vulnerable.
- "El error dice instalar X, lo instalo". ← stack traces no auditan CVEs.

If you skipped this skill and then realize you should have invoked it, **stop, run the checks now, and revert the install if anything is 🔴**.

## Pre-install checklist (run for EACH package)

### 1. Last known-good version

Search the npm registry for the latest release. Use WebFetch / WebSearch as needed.

```
Query template (WebSearch):
  "<package-name> CVE 2025 2026 security"
  "<package-name> npm latest version"
  "site:github.com/advisories <package-name>"
```

For Node.js base images: also check `nodejs.org/en/blog/vulnerability` for the current security releases page.

### 2. Active CVEs

For each candidate version of the package (the one the user wants + the latest available):

- Search GitHub Security Advisories (`github.com/advisories`).
- Search Snyk DB (`security.snyk.io/package/npm/<name>`).
- Search the package's own changelog for "security" / "vuln" / "CVE" mentions.

Build a table:

```
| Version | CVEs | Fixed in | Severity |
```

🔴 if any **high/critical** unpatched CVE in the candidate version.
🟡 if **medium** unpatched, or only patched in a major-bump version.
✅ if no known CVEs.

### 3. Release age (vs `minimumReleaseAge: 1440`)

The project's `pnpm-workspace.yaml` enforces a 24h cooldown. If the user wants a version released < 24h ago:

🔴 **Refuse**. Explain that the cooldown would have stopped the chalk/debug compromise of Sep-2025 (the malicious version was published, detected, and reverted in ~2h).

If the user insists, ask them to write "I accept the cooldown bypass risk" before proceeding.

### 4. Provenance attestation

Check `npm view <package>@<version>` for the `attestations` field (or the npm web UI shows a "Provenance" badge).

- ✅ Has provenance signed by a known CI (GitHub Actions, GitLab, etc.).
- 🟡 No provenance but the package is widely-used and maintained.
- 🔴 No provenance + recent maintainer change + low download count → potential typosquat.

### 5. Maintenance status

- Last commit date in the source repo.
- Open issues / PRs ratio.
- Multiple maintainers (single-maintainer is a supply-chain risk after Qix/chalk compromise).

🟡 If last release > 12 months ago **and** package still receives downloads, flag for "consider replacement" but don't block.

🔴 If marked deprecated or archived.

### 6. Engine compatibility

For the candidate version, check `engines.node` and `engines.pnpm` in its `package.json`.

```
npm view <package>@<version> engines
```

If it requires a Node/pnpm version we don't have:
- Are we willing to bump Node/pnpm? → run this same skill recursively on the Node/pnpm upgrade.
- If not → use the latest version compatible with current engines.

### 7. Transitive dependencies

Quick scan of the candidate package's direct deps. Red flags:

- Pulls in any **deprecated** package as transitive (`request`, `node-fetch <3`, `glob <8`, `inflight`, `rimraf <4`, `npmlog`).
- Pulls in `lodash <4.17.24`, `axios <1.16.0`, `mongoose <8.9.5`, `multer <2.1.1`, `tar <7.5.11`, `cookie <0.7.2`, `cross-spawn <7.0.6` (versions with known CVEs we already override).

If detected, plan an `override` in `pnpm-workspace.yaml` for the same.

### 8. Specific to Docker base images

When asked to change `FROM node:X` or `FROM <other>:Y`:

- Confirm the tag is currently published (not pulled / quarantined).
- Verify it's not a deprecated minor (Node 22.11 was vulnerable; 22.13 still had 8+ unpatched CVEs of Jan-2026).
- Confirm OS base is supported (Alpine for pure-JS, Debian-slim for native deps like bcrypt/sharp/argon2).
- Verify `engines.node` of the project matches.

## Output format (mandatory)

Before executing any install command, emit the report:

```
🔍 Dependency security check — <package-name>@<version>

1. Last known-good   : <version> (published YYYY-MM-DD)
2. Active CVEs       : ✅ none | 🟡 medium <CVE-id> patched in X | 🔴 high <CVE-id> unpatched
3. Release age       : ✅ > 24h | 🔴 < 24h, ABORT
4. Provenance        : ✅ signed by <CI> | 🟡 none, widely used | 🔴 no provenance + suspicious
5. Maintenance       : ✅ active | 🟡 stale (last release N months ago) | 🔴 deprecated
6. Engine compat     : ✅ matches | 🟡 requires bump | 🔴 incompatible
7. Transitive risks  : ✅ clean | ⚠️ pulls <bad-dep>, will add override
8. Verdict           : ✅ PROCEED | ⚠️ PROCEED WITH OVERRIDE | 🔴 BLOCK

Sources:
  - <url>
  - <url>
```

If verdict is 🔴, **do not run the install**. Ask the user how to proceed.
If verdict is ⚠️, run the install AND add the necessary override in `pnpm-workspace.yaml` in the same change.

## After install (mandatory follow-up)

Run these in order:

```bash
# 1. Audit production deps (high/critical → fail)
pnpm audit --prod --audit-level=high

# 2. Verify ECDSA signatures from registry (pnpm 11.1+)
pnpm audit signatures

# 3. Detect packages running postinstall scripts that aren't on the allowlist
pnpm install --dry-run 2>&1 | grep -i "ignored build"

# 4. Check for deprecated transitive deps introduced
pnpm install 2>&1 | grep -i "deprecated"
```

If anything fails, roll back: revert the package.json change + `pnpm install` to restore the previous lockfile state.

## Documentation duty

After a confirmed install:

1. Update [`docs/04-seguridad.md`](../../docs/04-seguridad.md) §13.3 with the new package + version + reason.
2. If you added an `override`, document the CVE it mitigates in `pnpm-workspace.yaml` as a comment.
3. Mention in the commit message: `feat(deps): add <pkg>@<version> — <verdict from check>`.

## Hard limits (never violate)

- **Never** install a package with a known **high or critical CVE** unless the user explicitly writes "I accept CVE <ID>".
- **Never** install a version < 24h since publication (the cooldown is a defense, not a hint).
- **Never** install a `*-latest`, `^X` floating range in a Dockerfile — Docker images need exact pins for reproducibility.
- **Never** disable `minimumReleaseAge`, `blockExoticSubdeps`, or `allowBuilds` whitelist to make an install succeed. If you find yourself wanting to, stop and ask.

## What to do if the user pushes back

If the user insists on an unsafe install ("dale, instalalo igual"):

1. Show the report again, highlight the 🔴.
2. Offer alternatives: a safer version, a similar package, an override workaround.
3. If they still insist, document **in writing** the bypass in the next commit message: "chore(deps): user-accepted CVE-XXXX in <pkg>@<v>".
4. Do the install.

The audit trail matters more than the right call. A documented bypass is fixable; an undocumented one is invisible.
