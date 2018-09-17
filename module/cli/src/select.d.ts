export function select(title: string, options: string[]): Promise<string>;
export function select(title: string, options: string[], multiSelect: false): Promise<string>;
export function select(title: string, options: string[], multiSelect: true): Promise<string[]>;
export function select(title: string, options: string[], multiSelect?: boolean): Promise<string[] | string>;