/* eslint-disable no-undef */
let lastTs = undefined;
setInterval(() => {
  fetch('/check', { method: 'POST' }).then(res => {
    res.json().then(({ timestamp }) => {
      if (lastTs === undefined) {
        lastTs = timestamp;
      } else if (lastTs !== timestamp) {
        location.reload();
      }
    });
  });
}, $RATE);
