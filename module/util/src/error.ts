// Pulled from http://stackoverflow.com/questions/31089801/extending-error-in-javascript-with-es6-syntax#answer-32749533
export class BaseError<T> extends Error {
  constructor(message: string, public payload: T) {
    super(message);
    this.name = this.constructor.name;
    this.message = message;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }
  }
}