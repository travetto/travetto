import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  imports: [RouterLink, RouterModule],
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: [],
  standalone: true
})
export class AuthComponent { }
