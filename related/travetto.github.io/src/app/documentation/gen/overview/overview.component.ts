import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

import { ModuleChartComponent } from '../../module-chart/module-chart.component';

@Component({
  imports: [RouterModule, ModuleChartComponent],
  selector: 'app-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss']
})
export class OverviewComponent {
}
