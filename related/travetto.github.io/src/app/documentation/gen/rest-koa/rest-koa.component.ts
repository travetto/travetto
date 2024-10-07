import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-rest-koa',
    templateUrl: './rest-koa.component.html',
    styleUrls: [],
    standalone: true
})
export class RestKoaComponent { }
