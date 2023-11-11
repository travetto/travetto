import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PAGES } from '../pages';

@Component({
  selector: 'app-module-chart',
  imports: [RouterLink],
  template: `
  <div class="documentation">
  <div class="modules">
    @for (page of tools[0].subs; track $index) {
      <div [class]="page.path">
        <a [routerLink]="['/', 'docs', page.path]" [innerHtml]="page.title"></a>
      </div>
    }
    @for (page of pages; track $index) {
      <div [class]="page.path">
        @if (page.component) {
          <a [routerLink]="['/', 'docs', page.path]" [innerHtml]="page.title"></a>
        } @else {
          <div class="title" [innerHtml]="page.title"></div>
        }
        @if (page.subs && page.subs.length) {
          <ul>
            @for (sub of page.subs; track $index) {
              <li class="sub">
                <a [routerLink]="['/', 'docs', sub.path]" [innerHtml]="sub.title"></a>
              </li>
            }
          </ul>
        }
      </div>
    }
  </div>
</div>`,
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
