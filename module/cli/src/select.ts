import * as readline from 'readline';
import selectShell = require('select-shell');

export function select(title: string, items: string[], multiSelect: true): Promise<string[]>;
export function select(title: string, items: string[], multiSelect: false): Promise<string>;
export function select(title: string, items: string[], multiSelect?: boolean): Promise<string | string[]> {
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

  return new Promise<string | string[]>((resolve, reject) => {
    list.list();
    list.on('select',
      x => resolve(multiSelect ? x.map(y => y.value) : x[0].value));
    list.on('cancel',
      () => reject(new Error('Selection cancelled')));
  })
    .finally(() => {
      list.clearList();
      list.close();
      readline.moveCursor(process.stdout, 0, -2);
      readline.clearScreenDown(process.stdout);
    });
}