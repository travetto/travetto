import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-rest-express',
    templateUrl: './rest-express.component.html',
    styleUrls: [],
    standalone: true
})
export class RestExpressComponent { }
