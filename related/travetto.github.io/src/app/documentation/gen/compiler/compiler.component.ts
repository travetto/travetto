import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  imports: [RouterLink, RouterModule],
  selector: 'app-compiler',
  templateUrl: './compiler.component.html',
  styleUrls: [],
  standalone: true
})
export class CompilerComponent { }
