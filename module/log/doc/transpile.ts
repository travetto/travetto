export function work() {
  console.debug('Start Work');

  try {
    1 / 0;
  } catch (e) {
    console.error('Divide by zero', { error: e });
  }
  console.debug('End Work');
}
