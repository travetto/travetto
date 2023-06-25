import { BrowserModule } from '@angular/platform-browser';

import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { LandingComponent } from './landing/landing.component';
import { BlogComponent } from './blog/blog.component';

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
        loadChildren: () => import('./documentation/gen/todo-app/todo-app.module').then(m => m.TodoAppModule),
      },
      {
        path: 'blog',
        component: BlogComponent
      },
      {
        path: 'docs',
        loadChildren: () => import('./documentation/documentation.module').then(m => m.DocumentationModule)
      }
    ]
  }, {
    path: '',
    pathMatch: 'full',
    component: AppComponent
  }
];

@NgModule({
  declarations: [
    AppComponent,
    LandingComponent,
    BlogComponent,
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot(routes, { scrollPositionRestoration: 'disabled' })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
