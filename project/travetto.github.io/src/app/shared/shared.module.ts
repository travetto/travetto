import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SectionHeaderComponent } from '../section-header/section-header.component';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';

@NgModule({
  declarations: [
    SectionHeaderComponent
  ],
  imports: [
    CommonModule,
    MatButtonModule, MatTabsModule,
    MatSidenavModule, MatTooltipModule, MatToolbarModule,
    MatSnackBarModule
  ],
  exports: [
    SectionHeaderComponent,
    MatButtonModule, MatTabsModule,
    MatSidenavModule, MatTooltipModule, MatToolbarModule,
    MatSnackBarModule
  ]
})
export class SharedModule { }
