import { Class } from '../model';

export const PendingRegister = new Map<string, Class<any>[]>();

export function Register() {
  return (target: Class<any>) => {
    if (!PendingRegister.has(target.__filename)) {
      PendingRegister.set(target.__filename, []);
    }
    PendingRegister.get(target.__filename)!.push(target);
  }
}