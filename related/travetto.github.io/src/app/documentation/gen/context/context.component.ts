import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  imports: [RouterLink, RouterModule],
  selector: 'app-context',
  templateUrl: './context.component.html',
  styleUrls: [],
  standalone: true
})
export class ContextComponent { }
