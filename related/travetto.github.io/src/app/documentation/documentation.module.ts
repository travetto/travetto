import { Route } from '@angular/router';
import { PAGES } from './pages';

export const ROUTES: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'overview'
  },
  {
    path: 'overview',
    loadComponent: () => import('./gen/overview/overview.component').then(mod => mod.OverviewComponent)
  },
  ...PAGES.map(page => [page, ...(page.subs ?? [])]).flat().filter(page => !!page.loadComponent)
];