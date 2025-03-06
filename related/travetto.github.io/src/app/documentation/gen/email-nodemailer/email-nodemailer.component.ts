import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  imports: [RouterLink, RouterModule],
  selector: 'app-email-nodemailer',
  templateUrl: './email-nodemailer.component.html',
  styleUrls: []
})
export class EmailNodemailerComponent { }
