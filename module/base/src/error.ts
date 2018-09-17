export class BaseError<T = any> extends Error {
  name: string;

  constructor(public message: string, public payload?: T) {
    super(message);

    this.name = this.constructor.name;
    this.stack = this.stack;
  }
}