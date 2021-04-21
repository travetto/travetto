import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { FigureComponent } from '../figure/figure.component';

@NgModule({
  declarations: [FigureComponent],
  imports: [
    CommonModule, MatButtonModule, MatToolbarModule, MatSnackBarModule
  ],
  exports: [
    FigureComponent, MatButtonModule, MatToolbarModule, MatSnackBarModule
  ]
})
export class SharedModule { }
