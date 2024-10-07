import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-worker',
    templateUrl: './worker.component.html',
    styleUrls: [],
    standalone: true
})
export class WorkerComponent { }
