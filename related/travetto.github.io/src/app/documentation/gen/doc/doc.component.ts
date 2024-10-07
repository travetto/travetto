import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink, RouterModule],
  selector: 'app-doc',
  templateUrl: './doc.component.html',
  styleUrls: []
})
export class DocComponent { }
