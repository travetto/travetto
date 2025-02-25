import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-vscode-plugin',
    templateUrl: './vscode-plugin.component.html',
    styleUrls: ['./vscode-plugin.component.scss']
})
export class VSCodePluginComponent { }
