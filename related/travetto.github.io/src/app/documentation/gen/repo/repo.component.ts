import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  imports: [RouterLink, RouterModule],
  selector: 'app-repo',
  templateUrl: './repo.component.html',
  styleUrls: ['./repo.component.scss'],
  standalone: true
})
export class RepoComponent { }
