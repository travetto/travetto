import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-utils',
  templateUrl: './utils.component.html',
  styleUrls: ['./utils.component.scss']
})
export class UtilsComponent implements OnInit {

  pages: { path: string, component: any, title: string }[];

  constructor() { }

  ngOnInit() {
    // @ts-ignore
    const { PAGES } = require('../pages');
    this.pages = PAGES.find(x => x.component === this.constructor).subs;
  }

}
