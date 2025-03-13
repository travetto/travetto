import { Route } from '@angular/router';
import { PAGES } from './pages.ts';

export const ROUTES: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'overview'
  },
  {
    path: 'overview',
    loadComponent: () => import('./gen/overview/overview.component').then(m => m.OverviewComponent)
  },
  ...PAGES.map(x => [x, ...(x.subs ?? [])]).flat().filter(x => !!x.loadComponent)
];