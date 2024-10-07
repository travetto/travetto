import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-model-query',
    templateUrl: './model-query.component.html',
    styleUrls: [],
    standalone: true
})
export class ModelQueryComponent { }
