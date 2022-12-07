export class Test {
  name: string;
  age: number;
  dob: Date;

  computeAge(): void {
    this['age'] = (Date.now() - this.dob.getTime());
  }
}