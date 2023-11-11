import { Component } from '@angular/core';
import { ModuleChartComponent } from '../../module-chart/module-chart.component';

@Component({
    selector: 'app-overview',
    templateUrl: './overview.component.html',
    styleUrls: ['./overview.component.scss'],
    standalone: true,
    imports: [ModuleChartComponent]
})
export class OverviewComponent {
}
