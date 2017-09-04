function test() {
  setTimeout(function inner1() {
    setTimeout(function inner2() {
      setTimeout(function inner3() {
        throw new Error('Uh oh');
      }, 1);
    }, 1);
  }, 1);
}

try {
  test();
} catch (e) {
  console.log(e);
}