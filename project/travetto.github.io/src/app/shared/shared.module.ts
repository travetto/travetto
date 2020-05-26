import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SectionHeaderComponent } from '../section-header/section-header.component';
import { MatTabsModule, MatTooltipModule, MatToolbarModule, MatSidenavModule, MatButtonModule, MatSnackBarModule } from '@angular/material';

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
