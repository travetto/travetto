import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-manifest',
    templateUrl: './manifest.component.html.ts',
    styleUrls: ['./manifest.component.scss.ts']
})
export class ManifestComponent { }
