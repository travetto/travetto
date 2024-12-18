import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
    imports: [RouterLink, RouterModule],
    selector: 'app-auth-jwt',
    templateUrl: './auth-jwt.component.html',
    styleUrls: ['./auth-jwt.component.scss']
})
export class AuthJwtComponent { }
