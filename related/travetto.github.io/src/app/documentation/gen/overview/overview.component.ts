import { Component } from '@angular/core';
import { ModuleChartComponent } from '../../module-chart/module-chart.component.ts';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule, ModuleChartComponent],
    selector: 'app-overview',
    templateUrl: './overview.component.html.ts',
    styleUrls: ['./overview.component.scss.ts']
})
export class OverviewComponent {
}
