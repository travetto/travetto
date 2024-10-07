import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-openapi',
    templateUrl: './openapi.component.html',
    styleUrls: [],
    standalone: true
})
export class OpenapiComponent { }
