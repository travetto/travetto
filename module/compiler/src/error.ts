// Pulled from http://stackoverflow.com/questions/31089801/extending-error-in-javascript-with-es6-syntax#answer-32749533
export class BaseError<T = any> {
  name: string;
  stack: any;

  constructor(public message: string, public payload?: T) {
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }
  }
}

Object.setPrototypeOf(BaseError.prototype, Error.prototype);
