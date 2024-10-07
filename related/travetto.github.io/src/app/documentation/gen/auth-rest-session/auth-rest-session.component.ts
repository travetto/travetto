import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  imports: [RouterLink, RouterModule],
  selector: 'app-auth-rest-session',
  templateUrl: './auth-rest-session.component.html',
  styleUrls: [],
  standalone: true
})
export class AuthRestSessionComponent { }
