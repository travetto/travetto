import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-test',
    templateUrl: './test.component.html',
    styleUrls: [],
    standalone: true
})
export class TestComponent { }
