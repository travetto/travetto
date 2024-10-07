import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-runtime',
    templateUrl: './runtime.component.html',
    styleUrls: [],
    standalone: true
})
export class BaseComponent { }
