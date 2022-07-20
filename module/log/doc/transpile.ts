export function work() {
  console.debug('Start Work');

  try {
    1 / 0;
  } catch (err) {
    console.error('Divide by zero', { error: err });
  }
  console.debug('End Work');
}
