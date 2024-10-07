import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-model-firestore',
    templateUrl: './model-firestore.component.html',
    styleUrls: [],
    standalone: true
})
export class ModelFirestoreComponent { }
