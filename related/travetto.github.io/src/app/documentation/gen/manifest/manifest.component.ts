import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-manifest',
    templateUrl: './manifest.component.html',
    styleUrls: ['./manifest.component.scss'],
    standalone: true
})
export class ManifestComponent { }
