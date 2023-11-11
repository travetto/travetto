import { importProvidersFrom } from '@angular/core';
import { AppComponent } from './app/app.component';
import { BlogComponent } from './app/blog/blog.component';
import { LandingComponent } from './app/landing/landing.component';
import { withInMemoryScrolling, provideRouter, Routes } from '@angular/router';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { DocumentationComponent } from './app/documentation/documentation.component';

const routes: Routes = [
  {
    path: '',
    children: [
      { path: '', redirectTo: '/landing', pathMatch: 'full' },
      {
        path: 'landing',
        component: LandingComponent
      },
      {
        path: 'guide',
        loadComponent: () => import('./app/documentation/gen/todo-app/todo-app.component').then(m => m.GuideComponent),
      },
      {
        path: 'blog',
        component: BlogComponent
      },
      {
        path: 'docs',
        component: DocumentationComponent,
        loadChildren: () => import('./app/documentation/documentation.module').then(m => m.ROUTES)
      }
    ]
  }, {
    path: '',
    pathMatch: 'full',
    component: AppComponent
  }
];


bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(BrowserModule),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'disabled' }))
  ]
})
  .catch(err => console.log(err));
