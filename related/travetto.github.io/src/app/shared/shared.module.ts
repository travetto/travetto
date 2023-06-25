import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FigureComponent } from '../figure/figure.component';

@NgModule({
  declarations: [FigureComponent],
  imports: [
    CommonModule
  ],
  exports: [
    FigureComponent
  ]
})
export class SharedModule { }
