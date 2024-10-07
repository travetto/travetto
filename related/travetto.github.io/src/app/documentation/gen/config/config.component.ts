import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  imports: [RouterLink, RouterModule],
  selector: 'app-config',
  templateUrl: './config.component.html',
  styleUrls: [],
  standalone: true
})
export class ConfigComponent { }
