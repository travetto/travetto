interface Input {
  multiSelect?: boolean;
  checked?: string;
  unchecked?: string;
  checkedColor?: string;
  uncheckedColor?: string;
  prepend?: boolean;
  pointer?: string;
  msgCancel?: string;
  disableInput?: boolean;
}

interface Result<T> {
  option(key: string, value: string): void;
  clearList(): void;
  close(): void;
  list(): void;
  on(ev: 'cancel', action: () => void): void;
  on(ev: 'select', action: (items: { value: string }[]) => void): void;
}

declare module 'select-shell' {
  import selectShell = require('select-shell');
  function Shell(input: Input & { multiSelect: false | undefined }): Result<string>;
  function Shell(input: Input & { multiSelect: true }): Result<string[]>;
  function Shell(input: Input): Result<string | string[]>;
  export = Shell;
}