# NotNow

Implement [Promises/A+](https://promisesaplus.com/) from scratch. For practice. And for fun.

## Test

Test with [Promises/A+ Compliance Test Suite](https://github.com/promises-aplus/promises-tests)

```sh
npm run test
```

## Tutorial

We'll name our Promise implementation **NotNow**. Other catchy names like **will**, **future**, **later**, etc. have already been claimed by other packages.

Let's start simple.

```javascript
const PENDING = "pending";
const FULFILLED = "fulfilled";

class NotNow {
  #state = PENDING;
  #onFulfilleds = [];
  #value;

  constructor(fn) {
    fn(this.#fulfill.bind(this));
  }

  #fulfill(value) {
    this.#state = FULFILLED;
    this.#value = value;
    this.#onFulfilleds.forEach((fn) => fn(value));
  }

  then(onFulfilled) {
    this.#addOnFulfilled(onFulfilled);
  }

  #addOnFulfilled(onFulfilled) {
    if (this.#state === PENDING) {
      this.#onFulfilleds.push(onFulfilled);
    } else if (this.#state === FULFILLED) {
      onFulfilled(this.#value);
    }
  }
}
```

The `constructor` executes the function you pass, using the `#fulfill` method as an argument. This allows you to fulfill the promise with a value when you're ready.

The `#fulfill` method sets the value and triggers all the callbacks with the fulfilled value.

The `then` method adds a callback to be executed when the promise is fulfilled. It internally calls `#addOnFulfilled`.

The `#addOnFulfilled` method, if the promise is pending, queues the callback for later execution. If the promise is already fulfilled, it executes the callback immediately.

Let's put it to the test.

```javascript
const notNow = new NotNow((fulfill) => {
  setTimeout(() => fulfill(2), 2000);
});
notNow.then((value) => console.log(`callback 1, fulfilled with ${value}`));
notNow.then((value) => console.log(`callback 2, fulfilled with ${value}`));
```

After 2 seconds, the console will log:

```
callback 1, fulfilled with 2
callback 2, fulfilled with 2
```

That's a good start.

In reality, the callbacks aren't executed synchronously right after the promise is fulfilled, but asynchronously. This ensures consistency; even if the promise is fulfilled synchronously, the callbacks will still be executed asynchronously. You can use `setTimeout` or `queueMicrotask` to schedule this. I'll use `queueMicrotask` to allow them to execute sooner.

Update the `#fulfill` method:

```javascript
// this.#onFulfilleds.forEach((fn) => fn(value));
queueMicrotask(() => this.#onFulfilleds.forEach((fn) => fn(value)));
```

Update the `#addOnFulfilled` method:

```javascript
// onFulfilled(this.#result);
queueMicrotask(() => onFulfilled(this.#value));
```

When we add a callback, we're actually creating a new promise. This new promise is the result of executing our callback. We can then pass this promise around to add more callbacks to process the result of our current callback.

So, in `then`, we create a new promise. When the promise is fulfilled, we execute the callback, then fulfill the new promise with the result of the callback.

```javascript
class NotNow {
  // ...
  then(onFulfilled) {
    return new Promise((nextFulfill) => {
      this.#addOnFulfilled((value) => {
        const nextValue = onFulfilled(value);
        nextFulfill(nextValue);
      });
    });
  }
  // ...
}
```

Let's test this out.

```javascript
const a = new NotNow((fulfill) => {
  setTimeout(() => fulfill(2), 2000);
});
const b = a.then((value) => value * 2);
b.then((value) => console.log(value));
```

`a` will be fulfilled with 2, and then `b` will be fulfilled with 4. So, 4 should be printed.

We can chain the `then` calls:

```javascript
new NotNow((fulfill) => {
  setTimeout(() => fulfill(2), 2000);
})
  .then((value) => value * 2)
  .then((value) => console.log(value));
```

We can even chain more:

```javascript
new NotNow((fulfill) => {
  setTimeout(() => fulfill(2), 2000);
})
  .then((value) => value * 2)
  .then((value) => value * 2)
  .then((value) => value * 2);
  .then((value) => console.log(value));
```

Ah, method chaining always looks so satisfying.

One characteristic of a promise is that when the fulfilled value is also a promise (i.e., it has a `then` method), the current promise will attempt to adopt its state. For instance:

```javascript
const a = new Promise((fulfill) => fulfill(2));
const b = new Promise((fulfill) => fulfill(a)).then((value) =>
  console.log(value)
);
```

The output will be:

```
2
```

Even though we fulfilled `b` with `a`, it tried to take `a`'s fulfilled value, because `a` is a promise.

This behavior remains the same even if you nest more promises:

```javascript
const a = new Promise((fulfill) => fulfill(2));
const b = new Promise((fulfill) => fulfill(a));
const c = new Promise((fulfill) => fulfill(b));
const d = new Promise((fulfill) => fulfill(c)).then((value) =>
  console.log(value)
);
```

Output:

```
2
```

To achieve this, when fulfilling, if the fulfilled value is a promise, we don't fulfill immediately, but wait until that promise is fulfilled, by adding `#fulfill` as a callback.

```javascript
class NotNow {
  //...
  #fulfill(value) {
    if (typeof value?.then === "function") {
      return value.then(this.#fulfill);
    }
    this.#state = FULFILLED;
    this.#value = value;
    queueMicrotask(() => this.#onFulfilleds.forEach((fn) => fn(value)));
  }
  //...
}
```

The next time `#fulfill` is called, it performs the same operation, so it works recursively, untill the fulfilled value is not a promise.

Let's test this:

```javascript
const a = new NotNow((fulfill) => fulfill(2));
const b = new NotNow((fulfill) => fulfill(a));
const c = new NotNow((fulfill) => fulfill(b));
const d = new NotNow((fulfill) => fulfill(c)).then((value) =>
  console.log(value)
);
```

Output:

```
2
```

Correct!

Can we use `async`/`await` with `NotNow`? Absolutely! The value to be `await`ed just needs to behave like a promise, its actual class doesn't matter.

```javascript
const a = await new NotNow((fulfill) => {
  setTimeout(() => fulfill(5), 2000);
});
console.log(a);
```

That's the essence of it. In this tutorial, I've skipped error handling for simplicity, to make it easier to focus on the core concepts. Refer to the source code for the complete version. There are also additional methods like `all`, `allSettled`, `any`, `race`.
