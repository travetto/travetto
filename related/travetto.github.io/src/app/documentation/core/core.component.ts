import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-core',
  templateUrl: './core.component.html',
  styleUrls: ['./core.component.scss']
})
export class CoreComponent implements OnInit {

  pages: { title: string, path: string }[];

  constructor() { }

  ngOnInit() {
    // @ts-ignore
    const { PAGES } = require('../pages');
    this.pages = PAGES.find(x => x.component === this.constructor).subs;
  }

}
