import { HttpErrorResponse } from '@angular/common/http';

export type AuthErrorContext = 'login' | 'register' | 'switch';

/**
 * Convierte un error HTTP del backend en un mensaje amigable para el usuario.
 * El `context` permite que el copy sea específico (ej: 401 en login es
 * "creds inválidos", pero en switch-role es "sesión expirada").
 */
export function parseAuthError(err: unknown, context: AuthErrorContext): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 401) {
      if (context === 'login') return 'Email o contraseña incorrectos.';
      if (context === 'switch') return 'Tu sesión expiró. Volvé a iniciar sesión.';
      return 'No autorizado.';
    }
    if (err.status === 409) return 'Ese email ya está registrado.';
    if (err.status === 400) {
      const messages = extractValidationMessages(err.error);
      return messages.length > 0 ? messages.join(' ') : 'Los datos enviados no son válidos.';
    }
    if (err.status === 404 && context === 'switch') {
      return 'El cambio de rol no está disponible (endpoint dev no habilitado).';
    }
    if (err.status === 429) {
      return 'Demasiados intentos. Esperá un momento e intentá de nuevo.';
    }
    if (err.status === 0) {
      return 'No pudimos conectar con el servidor. Verificá tu conexión.';
    }
    if (err.status >= 500) {
      return 'Algo salió mal en el servidor. Intentá más tarde.';
    }
  }
  return 'Algo salió mal. Intentá de nuevo.';
}

function extractValidationMessages(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];
  const maybeMessage = (body as { message?: unknown }).message;
  if (Array.isArray(maybeMessage)) {
    return maybeMessage.filter((m): m is string => typeof m === 'string');
  }
  if (typeof maybeMessage === 'string') return [maybeMessage];
  return [];
}
