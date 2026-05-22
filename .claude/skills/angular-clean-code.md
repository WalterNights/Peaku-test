---
name: angular-clean-code
description: Use when writing, reviewing, or refactoring Angular code in this project. Enforces Angular 18+ idioms (standalone components, signals, control flow), NgRx Signal Store for state, OnPush, lazy routes, typed Reactive Forms, no `any`, accessibility basics. Triggers — Spanish "código Angular", "componente Angular", "signal store", "reactive form" — English "Angular component", "Angular service", "SignalStore", "Angular template".
---

# Angular Clean Code (PeaKu-prueba)

You are reviewing or writing Angular code for `apps/frontend`. Apply strictly.

## Stack constraints

- Angular ≥ 18 (standalone components only — no NgModules except Material's).
- Signals + `@if/@for/@switch` (no `*ngIf`, no `*ngFor` in new code).
- NgRx Signal Store (`@ngrx/signals`) for any state shared across components.
- Reactive Forms — strictly typed with `FormBuilder.nonNullable.group({...})`.
- Angular Material for primitives (tables, dialogs, forms) + Tailwind for layout.
- TypeScript `strict: true` with `noImplicitAny`, `strictNullChecks`.

## Component rules

- **Always** `changeDetection: ChangeDetectionStrategy.OnPush`. Without it → 🔴.
- **Always** `standalone: true`.
- Inputs/outputs via signals when possible (`input()`, `output()`, `model()`).
- One component per file. File name matches selector kebab-case.
- No logic in templates beyond simple expressions. Computed values go in `computed()` or a method.
- Use `<mat-form-field>` with `<mat-label>` — never placeholder-as-label (a11y).
- All clickable icons have `aria-label` or visible text.

## Template idioms

```html
@if (store.loading()) {
  <app-loading-skeleton />
} @else if (store.error()) {
  <app-error-state [error]="store.error()" />
} @else {
  @for (item of store.items(); track item.id) {
    <app-product-row [product]="item" />
  } @empty {
    <app-empty-state cta="Crear primer producto" />
  }
}
```

Flag `*ngIf` / `*ngFor` in new code as 🟡 (legacy syntax).
Missing `track` in `@for` → 🔴 (perf bug).

## State management — NgRx Signal Store

When state is shared across components or persists across navigations, use Signal Store:

```ts
export const ProductsStore = signalStore(
  { providedIn: 'root' },
  withState<ProductsState>(initialState),
  withComputed((store) => ({
    totalPages: computed(() => Math.ceil(store.total() / store.limit())),
    hasItems: computed(() => store.items().length > 0),
  })),
  withMethods((store, api = inject(ProductsApi)) => ({
    async loadPage(page: number, limit: number) {
      patchState(store, { loading: true, error: null });
      try {
        const res = await firstValueFrom(api.list({ page, limit }));
        patchState(store, { items: res.items, total: res.total, page, limit, loading: false });
      } catch (err) {
        patchState(store, { error: toErrorMessage(err), loading: false });
      }
    },
  })),
);
```

Flag as 🔴 if you see:
- Services with `BehaviorSubject` used as ad-hoc state for shared data → migrate to SignalStore.
- `subscribe()` in components without a corresponding cleanup (use `takeUntilDestroyed()` or `async` pipe).

## HTTP

- All HTTP via `HttpClient`.
- Interceptors live in `core/interceptors/`:
  - `auth.interceptor` (attaches `Authorization: Bearer ...`).
  - `error.interceptor` (translates 4xx/5xx into user-friendly messages + handles 401 → refresh).
  - `correlation-id.interceptor` (UUID per request, propagated to gateway).
- Never inject `HttpClient` directly into a component. Wrap in a `*.api.ts` service (`AuthApi`, `ProductsApi`).
- API services return `Observable<T>` (consumers can subscribe or convert to promise).

## Forms

- Reactive Forms only (no template-driven).
- Typed forms:
  ```ts
  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
  ```
- Custom validators in `shared/validators/`, never inline in components.
- Disable submit button when `form.invalid || form.pending || loading()`.
- Show errors only when `control.touched && control.invalid`.

## Routing

- Routes in `<feature>.routes.ts` files.
- Lazy load every feature: `loadComponent: () => import('./...')` or `loadChildren`.
- `canActivate: [authGuard]` for protected routes.
- Use `provideRouter(appRoutes, withComponentInputBinding())` — bind route params to component inputs.

## Performance must-haves

| Rule | Why |
|------|-----|
| `OnPush` in every component | Cuts CD cycles. |
| `@for ... track item.id` | Stable identity, less DOM thrashing. |
| `NgOptimizedImage` for `<img>` | Lazy + responsive srcset. |
| Lazy routes per feature | Smaller initial bundle. |
| `@defer` for below-the-fold blocks | Defer expensive widgets. |
| `debounceTime(300)` on search inputs | Fewer requests. |

## Error & loading UX

- No `alert()`.
- Use `MatSnackBar` for transient feedback.
- Skeletons (`shared/ui/loading-skeleton`) over spinners.
- Empty states with CTA, not blank screens.
- Errors translated to user language (`"No se pudo cargar la lista"`), never raw JSON.

## Accessibility

- Every interactive element reachable by keyboard.
- `tabindex` only when strictly necessary (avoid > 0).
- Color contrast ≥ AA (Material default theme passes).
- Form fields have explicit `<label>` or `<mat-label>`.
- Live regions (`aria-live`) for async error/success announcements.

## What NOT to do

- ❌ `any` without a `// FIXME:` and a typed-ticket reference.
- ❌ `subscribe()` without unsubscribe management.
- ❌ Logic in HTML attributes (no `[hidden]="user.role === 'admin' && features.x.enabled"` — extract to computed).
- ❌ Two-way binding (`[(ngModel)]`) on top of Reactive Forms.
- ❌ DOM manipulation via `ElementRef` (use Renderer2 or, better, structural directives).
- ❌ Logic in services that should live in stores.
- ❌ `console.log` in committed code.

## Output format when reviewing

```
🔴 Critical (correctness, perf, security, a11y)
  - apps/frontend/src/app/.../file.ts:NN — <issue> → <fix>

🟡 Important
  - <path:line> — <issue> → <fix>

🟢 Nice to have
  - <path:line> — <issue> → <fix>
```

Always cite file path + line.
