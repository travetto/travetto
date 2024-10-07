import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-email',
    templateUrl: './email.component.html',
    styleUrls: [],
    standalone: true
})
export class EmailComponent { }
