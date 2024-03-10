import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PAGES } from '../pages';

@Component({
  selector: 'app-module-chart',
  imports: [RouterLink],
  templateUrl: './module-chart.component.html',
  styleUrls: ['./module-chart.component.scss', './module-chart.layout.scss'],
  standalone: true,
})
export class ModuleChartComponent {

  _pages = PAGES;

  get pages(): typeof PAGES {
    return this._pages.filter(x => x.path !== 'tools');
  }

  get tools(): typeof PAGES {
    return this._pages.filter(x => x.path === 'tools');
  }
}
