import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-terminal',
    templateUrl: './terminal.component.html.ts',
    styleUrls: ['./terminal.component.scss.ts']
})
export class TerminalComponent { }
