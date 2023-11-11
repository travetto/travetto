import { Component, ViewEncapsulation } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, NavigationEnd, RouterLinkActive, RouterLink, RouterOutlet } from '@angular/router';

import { PAGES } from './pages';

@Component({
  selector: 'app-documentation',
  styles: [`
:host {
  display: grid;
  grid-template-areas: "nav content";

  grid-column-gap: 10px;
  grid-template-columns: 300px 1fr;

  .documentation-links {
    grid-area: nav;
  }

  .router-outlet {
    grid-area: content;
    overflow: hidden;
  }

  li ul {
    display: none;
    &.toggled {
      display: block;
    }
  }

  li.active > ul {
    display: block;
  }

  li.tools {
    border-top: 1px dotted #ccc;
    padding-top: 0.5em;
    margin-top: 0.25em;
  }
}

.toc {
  h4 {
    font-weight: bold;
    margin: 0;
    font-size: 0.8rem;
    letter-spacing: 0px;
    padding: 0;
    margin-top: 0.25rem;
  }
}

@media (max-width: 700px) {
  :host {
    grid-template-columns: 1fr;
    grid-template-areas:
      "nav"
      "content";
    max-width: 700px;
    overflow: auto;
  }

  .documentation-links {
    li {
      border-top: none;
    }
  }
}`],
  template: `
  <div class="toc">
  <div class="inner">
    <h3>Pages</h3>
    <ul>
      @for (page of pages; track $index) {
      <li [routerLinkActive]="['active']" class="{{page.path}}">
        @if (page.component) {
          <a [routerLink]="['', 'docs', page.path]">{{page.title}}</a>
        } @else {
          <h4 [class]="'grouping'" (click)="setActive(page)">{{page.title}}
          </h4>
        }
        @if (page.subs) {
          <ul [class.toggled]="active[page.path]">
            @for(subp of page.subs; track $index) {
              <li [ngClass]="{active:hasFragment(subp.path)}">
                <a [routerLink]="['/', 'docs', subp.path]">{{subp.title}}</a>
              </li>
            }
          </ul>
        }
      </li>
      }
    </ul>
  </div>
</div>
<div class="router-outlet">
  <div class="documentation">
    <router-outlet></router-outlet>
  </div>
</div>
`,
  encapsulation: ViewEncapsulation.Emulated,
  standalone: true,
  imports: [RouterLinkActive, RouterLink, NgClass, RouterOutlet]
})
export class DocumentationComponent {
  pages: typeof PAGES = [
    { path: 'overview', title: 'Overview', component: undefined, subs: undefined } as const,
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
