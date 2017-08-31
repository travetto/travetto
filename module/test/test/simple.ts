import { expect } from 'chai';
import { Registry } from '@encore/di';
import { Test } from '../src/sample';

xdescribe('suite1', () => {
  it('Test1a', () => {
    expect(2).to.equal(2);
  });
  it('Test1b', () => {
    expect(2).to.equal(2);
  });
});

xdescribe('suite2', () => {
  it('Test2a', () => {
    expect(2).to.equal(2);
  });
  it('Test2b', () => {
    expect(2).to.equal(2);
  });
});


describe('suite3', () => {
  it('Test2a', async () => {
    let inst = await Registry.getInstance(Test);
    console.log(inst);
  });
});