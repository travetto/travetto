import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { LandingComponent } from './landing/landing.component';
import { GuideComponent } from './guide/guide.component';
import { DocumentationModule } from './documentation/documentation.module';
import { BlogComponent } from './blog/blog.component';
import { SharedModule } from './shared/shared.module';

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
        component: GuideComponent
      },
      {
        path: 'blog',
        component: BlogComponent
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
    GuideComponent,
    BlogComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    DocumentationModule,
    BrowserAnimationsModule,
    RouterModule.forRoot(routes, { scrollPositionRestoration: 'disabled', relativeLinkResolution: 'legacy' }),
    SharedModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
