import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-di',
    templateUrl: './di.component.html',
    styleUrls: [],
    standalone: true
})
export class DiComponent { }
