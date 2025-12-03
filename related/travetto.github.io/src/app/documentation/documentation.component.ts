import { Component, ViewEncapsulation } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, NavigationEnd, RouterLinkActive, RouterLink, RouterOutlet } from '@angular/router';

import { PAGES } from './pages';

@Component({
  selector: 'app-documentation',
  styleUrls: ['./documentation.component.css'],
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
    router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.url = event.url;
      }
    });
  }

  hasFragment(fragment: string): boolean {
    return this.url.endsWith(`#${fragment}`);
  }

  setActive(page: (typeof PAGES)[number]): void {
    this.active = { [page.path]: true };
  }
}
