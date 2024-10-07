import { Component } from '@angular/core';
import { ModuleChartComponent } from '../../module-chart/module-chart.component';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  imports: [RouterLink, RouterModule, ModuleChartComponent],
  selector: 'app-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss'],
  standalone: true,
})
export class OverviewComponent {
}
