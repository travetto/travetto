import { Route } from '@angular/router';
import { OverviewComponent } from './gen/overview/overview.component';
import { PAGES } from './pages';

export const ROUTES: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'overview'
  },
  {
    path: 'overview',
    component: OverviewComponent
  },
  ...PAGES.map(x => [x, ...(x.subs ?? [])]).flat().filter(x => !!x.component)
];