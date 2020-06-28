export function work() {
  try {
    1 / 0;
  } catch (e) {
    console.error(e);
  }
}
