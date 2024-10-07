import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-model-mongo',
    templateUrl: './model-mongo.component.html',
    styleUrls: [],
    standalone: true
})
export class ModelMongoComponent { }
