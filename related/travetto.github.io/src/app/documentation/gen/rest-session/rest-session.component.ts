import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  imports: [RouterLink, RouterModule],
  selector: 'app-rest-session',
  templateUrl: './rest-session.component.html',
  styleUrls: [],
  standalone: true
})
export class RestSessionComponent { }
