import { Component, ViewEncapsulation } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, NavigationEnd, RouterLinkActive, RouterLink, RouterOutlet } from '@angular/router';

import { PAGES } from './pages.ts';

@Component({
  selector: 'app-documentation',
  styleUrls: ['./documentation.component.scss'],
  templateUrl: './documentation.component.html',
  encapsulation: ViewEncapsulation.Emulated,
  imports: [RouterLinkActive, RouterLink, NgClass, RouterOutlet]
})
export class DocumentationComponent {
  pages: typeof PAGES = [
    { path: 'overview', title: 'Overview', subs: undefined } as const,
    ...PAGES
  ];
  url = '';

  active = {};

  constructor(router: Router) {
    router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.url = e.url;
      }
    });
  }

  hasFragment(f): boolean {
    return this.url.endsWith(`#${f}`);
  }

  setActive(page: (typeof PAGES)[number]): void {
    this.active = { [page.path]: true };
  }
}
