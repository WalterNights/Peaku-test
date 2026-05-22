import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

/**
 * Dialog de confirmación genérico, accesible y tematizado con la paleta PeaKu.
 *
 * Uso (desde cualquier componente):
 * ```
 * const ref = this.dialog.open(ConfirmDialogComponent, {
 *   data: { title, message, variant: 'destructive' },
 * });
 * const confirmed = await firstValueFrom(ref.afterClosed());
 * ```
 *
 * Usamos `MatDialog` (Angular Material) por focus-trap + ESC-to-close +
 * backdrop accesible. El contenido es HTML+Tailwind con los tokens del
 * design system, así matchea el resto de la UI sin estilos invasivos de Material.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-card text-foreground rounded-lg w-full max-w-md p-6 space-y-4 font-body">
      <h2 mat-dialog-title class="font-h3 text-h3 text-foreground !m-0 !p-0">
        {{ data.title }}
      </h2>

      <p mat-dialog-content class="font-body text-body text-muted-foreground !m-0 !p-0">
        {{ data.message }}
      </p>

      <div mat-dialog-actions class="!justify-end gap-3 !p-0 !mt-2">
        <button
          type="button"
          (click)="onCancel()"
          class="h-10 px-5 rounded-lg text-foreground font-body-sm text-body-sm font-medium hover:bg-muted transition-colors"
        >
          {{ data.cancelLabel ?? 'Cancelar' }}
        </button>
        <button
          type="button"
          (click)="onConfirm()"
          [class]="
            data.variant === 'destructive'
              ? 'h-10 px-5 rounded-lg bg-destructive text-on-primary font-body-sm text-body-sm font-semibold hover:bg-destructive/90 transition-colors'
              : 'h-10 px-5 rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-semibold hover:bg-primary-container transition-colors'
          "
          cdkFocusInitial
        >
          {{ data.confirmLabel ?? 'Confirmar' }}
        </button>
      </div>
    </div>
  `,
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent, boolean>);

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
