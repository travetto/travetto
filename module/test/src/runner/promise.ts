const { getPromiseDetails } = (process as any).binding('util');

const og = Promise;

function TrackablePromise(this: Promise<any>, ex: any) {
  const prom = new og(ex);
  this.then = prom.then.bind(prom);
  this.catch = prom.catch.bind(prom);
  this.finally = prom.finally.bind(prom);

  if (PromiseCapture.pending) {
    PromiseCapture.pending.push(prom);
  }
}

TrackablePromise.race = Promise.race.bind(Promise);
TrackablePromise.all = Promise.all.bind(Promise);
TrackablePromise.resolve = Promise.resolve.bind(Promise);
TrackablePromise.reject = Promise.reject.bind(Promise);

export class PromiseCapture {
  static pending: Promise<any>[];

  static start() {
    this.pending = [];
    global.Promise = TrackablePromise;
  }

  static stop() {
    global.Promise = og;
    const pending = this.pending.filter(x => getPromiseDetails(x)[0] === 0);
    delete this.pending;

    return Promise.all(pending);
  }
}