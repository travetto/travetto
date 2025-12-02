import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PAGES } from '../pages';

const CLASS_MAPPING = {
  app: 'full group group-common',
  tools: 'left-third  group group-lib',
  auth: 'mid-third  group group-lib',
  email: 'right-third group group-lib',
  model: 'left-third  group group-core',
  'model-query': 'mid-third group group-core',
  web: 'right-third group group-core',
  core: 'full group group-system-2',
  foundation: 'full group group-system',
};

@Component({
  selector: 'app-module-chart',
  imports: [RouterLink],
  templateUrl: './module-chart.component.html',
  styleUrls: ['./module-chart.component.css', './module-chart.layout.css']
})
export class ModuleChartComponent {

  _pages = PAGES.map(page => ({
    ...page,
    cls: `${page.path} ${CLASS_MAPPING[page.path] ?? ''}`
  }));

  get pages(): typeof PAGES {
    return this._pages;
  }
}
