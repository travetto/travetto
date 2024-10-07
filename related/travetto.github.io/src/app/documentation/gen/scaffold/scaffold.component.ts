import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-scaffold',
    templateUrl: './scaffold.component.html',
    styleUrls: [],
    standalone: true
})
export class ScaffoldComponent { }
