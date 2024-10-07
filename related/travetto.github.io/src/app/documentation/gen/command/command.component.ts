import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  imports: [RouterLink, RouterModule],
  selector: 'app-command',
  templateUrl: './command.component.html',
  styleUrls: [],
  standalone: true
})
export class CommandComponent { }
