export function work() {
  try {
    1 / 0;
  } catch (err) {
    console.error('Divide by Zero', { error: err });
  }
}
