import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

import { ModuleChartComponent } from '../../module-chart/module-chart.component';

@Component({
  imports: [RouterLink, RouterModule, ModuleChartComponent],
  selector: 'app-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss']
})
export class OverviewComponent {
}
