export * from './model'
export * from './modelValidator';

//Patch promise
require('mongoose').Promise = global.Promise;