import { Injectable } from "../lib/decorator";

@Injectable({ name: 'a' })
export class DbConfig {
  constructor() {
    console.log("Creating dbconfig");
  }

  getUrl() { return 'mongodb://ssdt'; }
}