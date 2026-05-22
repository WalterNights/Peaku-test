---
name: solid-review
description: Review code (TS, NestJS, Angular) against SOLID principles and emit a punch list of violations with file:line and concrete fixes. Triggers — Spanish "revisá SOLID", "review SOLID", "auditá principios SOLID" — English "SOLID review", "check SOLID", "review for SOLID violations". Use after generating non-trivial code or before committing a feature.
---

# SOLID Review

You are reviewing code against the five SOLID principles. Be specific: file path + line + violation + fix. No generalities.

## How to scan

Read the changed/specified files. For each class, function, or module, check the five principles below in order. Stop on first violation per principle per file, list it, move on.

## 1. S — Single Responsibility Principle

**A class/function has one reason to change.**

Red flags:
- A class with > 5 public methods that do unrelated things.
- A NestJS service that does: validation + DB access + HTTP call + business rule. → Split into use cases + repository + adapter.
- An Angular component with > 200 lines mixing template logic + HTTP + state mutation.
- A function with `&&` in its name (`getUserAndUpdateStats`).

Fix template:
> "Move <responsibility> into a separate <class type>. Reasoning: <change driver> changes independently of <other change driver>."

## 2. O — Open/Closed Principle

**Open for extension, closed for modification.**

Red flags:
- `switch` / `if-else` chain on a type discriminator that gets touched every time a new type is added. → Replace with strategy / polymorphism / map of handlers.
- Hardcoded list of payment processors / notification channels in a service. → Inject array of strategy implementations.

Acceptable exception: discriminated unions handled exhaustively when the union is closed and rarely changes.

Fix template:
> "Replace the switch on `<discriminator>` at <file>:<line> with a strategy map injected via DI. Each new variant adds an implementation, not an edit."

## 3. L — Liskov Substitution Principle

**Subtypes must be substitutable for their base type without breaking callers.**

Red flags:
- Subclass overrides a method to throw `NotSupportedException`.
- Subclass tightens preconditions (parent accepts `number`, child requires `positive number`) without documenting.
- Subclass loosens postconditions (parent guarantees non-null, child sometimes returns null).
- A repository implementation that silently no-ops `delete()` because the storage is read-only.

Fix template:
> "Either remove the inheritance (`<class>` doesn't satisfy `<base>`'s contract) or push the violated method into a more specific interface."

## 4. I — Interface Segregation Principle

**Clients shouldn't depend on methods they don't use.**

Red flags:
- A `UserService` interface with 15 methods, and most callers use only 2.
- An Angular service injected for one method, dragging in unrelated dependencies via constructor.
- A repository interface with `find*`, `save*`, `delete*`, `count*`, `aggregate*` — when consumers split cleanly into readers and writers.

Fix template:
> "Split `<Interface>` into `<ReaderInterface>` and `<WriterInterface>`. Update consumers to depend on the narrower one."

## 5. D — Dependency Inversion Principle

**Depend on abstractions, not concretions.**

Red flags:
- Use case importing `Model` from `mongoose`. → Inject `<X>Repository` interface; implement in `infrastructure/`.
- Use case importing `axios` directly. → Wrap behind `HttpClient` interface.
- Frontend component constructing `new SomeService()`. → Inject via DI.
- Domain entity decorated with `@Schema()` (Mongoose). → Separate persistence schema from domain entity.

Fix template:
> "Define `<Abstraction>` in `domain/` and inject it via token `<X_TOKEN>`. Move the current concrete dependency to `infrastructure/`."

## Cross-cutting smells to flag (bonus)

- **Primitive obsession**: a method taking `(string, string, string, number)` instead of a value object.
- **Feature envy**: method on class A that mostly manipulates state of class B → move it to B.
- **God object**: a class with > 10 collaborators.
- **Train wreck**: `a.b().c().d().e()` — violates Law of Demeter.
- **Static cling**: `SomeUtil.staticMethod()` in business logic — untestable, untyped DI.

## Output format

```
SOLID Review — <branch or feature name>

Files reviewed: N

🔴 Violations (must fix)
  1. [DIP] apps/products-service/src/application/use-cases/create-product.use-case.ts:18
     → Use case imports Mongoose `Model` directly.
     Fix: inject `ProductRepository` via PRODUCT_REPOSITORY_TOKEN.

  2. [SRP] apps/frontend/src/app/features/products/pages/product-list.page.ts:42-180
     → Component does HTTP, sorting, pagination, and CSV export.
     Fix: extract HTTP + state to `ProductsStore`, export logic to a `ProductsExporter` service.

🟡 Warnings (consider)
  ...

🟢 Notes (style)
  ...

Summary: X critical, Y warnings, Z notes. <one-line verdict>.
```

## When asked to fix

If the user also wants fixes applied (not just review), apply each 🔴 in order, smallest blast radius first, run lint + tests after each fix.
