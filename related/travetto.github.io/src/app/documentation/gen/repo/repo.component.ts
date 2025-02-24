import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-repo',
    templateUrl: './repo.component.html.ts',
    styleUrls: ['./repo.component.scss.ts']
})
export class RepoComponent { }
