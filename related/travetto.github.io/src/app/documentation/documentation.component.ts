import { Component, OnInit, ViewEncapsulation } from '@angular/core';

import { PAGES } from './pages';
import { Router, NavigationEnd } from '@angular/router';

@Component({
  selector: 'app-documentation',
  templateUrl: './documentation.component.html',
  styleUrls: ['./documentation.component.scss'],
  encapsulation: ViewEncapsulation.Emulated
})
export class DocumentationComponent {
  pages: typeof PAGES = [
    { path: 'overview', title: 'Overview' } as unknown as (typeof PAGES)[number],
    ...PAGES
  ];
  url = '';

  active = {};

  constructor(private router: Router) {
    router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.url = e.url;
      }
    });
  }

  hasFragment(f) {
    return this.url.endsWith(`#${f}`);
  }

  setActive(page: (typeof PAGES)[number]) {
    this.active = { [page.path]: true };
  }
}
