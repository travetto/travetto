import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GuideComponent } from './todo-app.component';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        component: GuideComponent,
      }
    ])
  ],
  declarations: [
    GuideComponent,
  ]
})
export class TodoAppModule { }
