import { Component, OnInit } from '@angular/core';
import { PAGES } from '../pages';

@Component({
  selector: 'app-module-chart',
  templateUrl: './module-chart.component.html',
  styleUrls: ['./module-chart.component.scss']
})
export class ModuleChartComponent implements OnInit {

  _pages = PAGES;

  get pages() {
    return this._pages.filter(x => x.path !== 'tools');
  }

  get tools() {
    return this._pages.filter(x => x.path === 'tools');
  }

  constructor() { }

  ngOnInit() {
  }

}
