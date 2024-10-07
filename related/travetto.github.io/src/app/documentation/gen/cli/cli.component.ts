import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  imports: [RouterLink, RouterModule],
  selector: 'app-cli',
  templateUrl: './cli.component.html',
  styleUrls: [],
  standalone: true
})
export class CliComponent { }
