import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  imports: [RouterLink, RouterModule],
  selector: 'app-auth-rest-passport',
  templateUrl: './auth-rest-passport.component.html',
  styleUrls: [],
  standalone: true
})
export class AuthRestPassportComponent { }
