import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'app';

  href = '';

  constructor(private router: Router) {
    router.events.subscribe(x => {
      this.href = router.url.split('/')[1];
    });

    router.events.subscribe(s => {
      if (s instanceof NavigationEnd) {
        const tree = this.router.parseUrl(this.router.url);
        if (tree.fragment) {
          const element = document.querySelector(`#${tree.fragment}`) as HTMLElement;
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
