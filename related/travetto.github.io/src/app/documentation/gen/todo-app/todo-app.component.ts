import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  selector: 'app-guide',
  templateUrl: './todo-app.component.html',
  styleUrls: ['./todo-app.component.scss'],
  imports: [RouterLink, RouterModule]
})
export class GuideComponent {
  constructor() { }
}
