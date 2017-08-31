import { Injectable } from "../src/decorator";

@Injectable({ name: 'a' })
export class DbConfig {
  constructor() {
    console.log("Creating dbconfig");
  }

  getUrl() { return 'mongodb://ssdtz'; }
}