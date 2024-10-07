import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-model-postgres',
    templateUrl: './model-postgres.component.html',
    styleUrls: [],
    standalone: true
})
export class ModelPostgresComponent { }
