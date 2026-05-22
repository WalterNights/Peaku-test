/**
 * Configuración de entorno para `ng serve` (dev local).
 *
 * Para producción se reemplaza vía `fileReplacements` en angular.json
 * (cuando exista `environment.prod.ts`). Por ahora la app sólo corre
 * en dev local contra el gateway en localhost:4050.
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:4050',
};
