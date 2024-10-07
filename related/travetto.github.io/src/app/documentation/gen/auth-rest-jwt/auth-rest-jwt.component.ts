import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  imports: [RouterLink, RouterModule],
  selector: 'app-auth-rest-jwt',
  templateUrl: './auth-rest-jwt.component.html',
  styleUrls: ['./auth-rest-jwt.component.scss'],
  standalone: true
})
export class AuthRestJwtComponent { }
