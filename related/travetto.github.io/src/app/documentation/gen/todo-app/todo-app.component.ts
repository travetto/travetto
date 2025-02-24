import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  selector: 'app-guide',
  templateUrl: './todo-app.component.html.ts',
  styleUrls: ['./todo-app.component.scss.ts'],
  imports: [RouterLink, RouterModule]
})
export class GuideComponent {
  constructor() { }
}
