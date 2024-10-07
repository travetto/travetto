import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-model-elasticsearch',
    templateUrl: './model-elasticsearch.component.html',
    styleUrls: [],
    standalone: true
})
export class ModelElasticsearchComponent { }
