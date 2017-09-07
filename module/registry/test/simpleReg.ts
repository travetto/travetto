import { Registry } from "../index";

export class SimpleReg extends Registry {
  async _init() {
    return 5;
  }
}