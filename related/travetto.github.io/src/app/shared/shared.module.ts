import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacySnackBarModule as MatSnackBarModule } from '@angular/material/legacy-snack-bar';

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
