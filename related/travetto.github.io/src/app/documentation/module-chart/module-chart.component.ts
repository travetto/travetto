import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PAGES } from '../pages.ts';

@Component({
  selector: 'app-module-chart',
  imports: [RouterLink],
  templateUrl: './module-chart.component.html.ts',
  styleUrls: ['./module-chart.component.scss', './module-chart.layout.scss.ts']
})
export class ModuleChartComponent {

  _pages = PAGES;

  get pages(): typeof PAGES {
    return this._pages;
  }
}
