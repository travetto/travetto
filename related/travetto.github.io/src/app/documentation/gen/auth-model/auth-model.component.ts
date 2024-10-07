import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  imports: [RouterLink, RouterModule],
  selector: 'app-auth-model',
  templateUrl: './auth-model.component.html',
  styleUrls: [],
  standalone: true
})
export class AuthModelComponent { }
