export class Test {
  name: string;
  age: number;
  dob: Date;

  computeAge() {
    this['age'] = (Date.now() - this.dob.getTime());
  }
}