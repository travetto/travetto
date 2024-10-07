import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-schema-faker',
    templateUrl: './schema-faker.component.html',
    styleUrls: [],
    standalone: true
})
export class SchemaFakerComponent { }
