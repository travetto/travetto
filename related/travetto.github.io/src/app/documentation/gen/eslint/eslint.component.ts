import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-eslint',
    templateUrl: './eslint.component.html',
    styleUrls: ['./eslint.component.scss']
})
export class EslintComponent { }
