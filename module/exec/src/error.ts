export function serialize(e: Error | any) {
  let error: any = undefined;

  if (e) {
    error = {};
    for (const k of Object.keys(e)) {
      error[k] = e[k];
    }
    error.$ = true;
    error.message = e.message;
    error.stack = e.stack;
    error.name = e.name;
  }

  return error;
}

export function deserialize(e: any) {
  if (e && e.$) {
    const err = new Error();
    for (const k of Object.keys(e)) {
      (err as any)[k] = e[k];
    }
    err.message = e.message;
    err.stack = e.stack;
    err.name = e.name;
    return err;
  } else if (e) {
    return e;
  }
}