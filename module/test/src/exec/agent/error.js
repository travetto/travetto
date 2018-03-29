function serialize(e) {
  let error = undefined;

  if (e) {
    error = {};
    for (let k of Object.keys(e)) {
      error[k] = e[k];
    }
    error.$ = true;
    error.message = e.message;
    error.stack = e.stack;
    error.name = e.name;
  }

  return error;
}

function deserialize(e) {
  if (e && e.$) {
    const err = new Error();
    for (const k of Object.keys(e)) {
      err[k] = e[k];
    }
    err.message = e.message;
    err.stack = e.stack;
    err.name = e.name;
    return err;
  } else if (e) {
    return e;
  }
}

module.exports = {
  serialize,
  deserialize
}