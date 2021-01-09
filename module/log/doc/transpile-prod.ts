export function work() {
  try {
    1 / 0;
  } catch (e) {
    console.error('Divide by Zero', { error: e });
  }
}
