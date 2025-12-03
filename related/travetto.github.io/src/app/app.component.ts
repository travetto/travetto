import { Component } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [RouterLink, RouterOutlet]
})
export class AppComponent {
  title = 'app';

  href = '';

  constructor(router: Router) {
    router.events.subscribe(() => {
      this.href = router.url.split('/')[1];
    });

    router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const tree = router.parseUrl(router.url);
        if (tree.fragment) {
          const element = document.querySelector<HTMLElement>(`#${tree.fragment}`);
          if (element) {
            document.getElementsByTagName('body')[0].scrollTo({ top: element.offsetTop - 74, behavior: 'smooth' });
          }
        } else {
          document.getElementsByTagName('body')[0].scrollTo({ top: 0, behavior: 'auto' });
        }
      }
    });
  }
}
