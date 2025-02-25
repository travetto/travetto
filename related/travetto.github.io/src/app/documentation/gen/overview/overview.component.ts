import { Component } from '@angular/core';
import { ModuleChartComponent } from '../../module-chart/module-chart.component';
import { RouterModule } from '@angular/router';

@Component({
    imports: [RouterModule, ModuleChartComponent],
    selector: 'app-overview',
    templateUrl: './overview.component.html',
    styleUrls: ['./overview.component.scss']
})
export class OverviewComponent {
}
