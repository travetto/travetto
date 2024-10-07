import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-model-dynamodb',
    templateUrl: './model-dynamodb.component.html',
    styleUrls: [],
    standalone: true
})
export class ModelDynamodbComponent { }
