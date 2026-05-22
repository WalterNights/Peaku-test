import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { DevToolsPanelComponent } from './shared/dev-tools/dev-tools-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, DevToolsPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <app-dev-tools-panel />
  `,
})
export class AppComponent {}
