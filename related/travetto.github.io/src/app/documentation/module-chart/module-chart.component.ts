import { Component, OnInit } from '@angular/core';
import { PAGES } from '../pages';

@Component({
  selector: 'app-module-chart',
  templateUrl: './module-chart.component.html',
  styleUrls: ['./module-chart.component.scss']
})
export class ModuleChartComponent implements OnInit {

  pages = PAGES;

  constructor() { }

  ngOnInit() {
  }

}
