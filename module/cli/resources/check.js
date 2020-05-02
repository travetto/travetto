let last_ts = undefined;
setInterval(() => {
  const now = Date.now();
  fetch('/check', { method: 'POST' }).then(res => {
    res.json().then(({ timestamp }) => {
      if (last_ts === undefined) {
        last_ts = timestamp;
      } else if (last_ts !== timestamp) {
        location.reload();
      }
    });
  });
}, $RATE);
