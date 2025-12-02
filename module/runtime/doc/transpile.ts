export function work() {
  console.debug('Start Work');

  try {
    1 / 0;
  } catch (error) {
    console.error('Divide by zero', { error });
  }
  console.debug('End Work');
}
