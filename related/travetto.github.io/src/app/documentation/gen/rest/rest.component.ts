import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-rest',
    templateUrl: './rest.component.html',
    styleUrls: [],
    standalone: true
})
export class RestComponent { }
