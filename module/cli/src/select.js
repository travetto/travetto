const selectShell = require('select-shell');
const readline = require('readline');

/**
 * @param {string} title
 * @param {string[]} items 
 * @param {boolean} [multiSelect]
 */
function select(title, items, multiSelect) {
  const list = selectShell({
    multiSelect,
    checked: '[X] ',
    unchecked: '[ ] ',
    checkedColor: 'green',
    uncheckedColor: 'white',
    prepend: true,
    pointer: '▶ ',
    msgCancel: '',
    disableInput: true
  });

  const width = Math.max(...items.map(x => x.length)) + 1;

  for (const item of items) {
    list.option(item + ' '.repeat(width - item.length), item);
  }

  console.log(`\n${title}:`);

  function cleanup() {
    list.clearList();
    list.close();
    readline.moveCursor(process.stdout, 0, -2);
    readline.clearScreenDown(process.stdout);
  }

  return new Promise((resolve, reject) => {
    list.list();
    // @ts-ignore
    list.on('select', x => resolve(multiSelect ? x.map(x => x.value) : x[0].value));
    // @ts-ignore
    list.on('cancel', x => reject(new Error('Selection cancelled')));
  }).then(a => cleanup() || a, a => { cleanup(); throw a; });
}

module.exports = { select };