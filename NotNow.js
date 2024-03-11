const FULFILLED = "fulfilled";
const REJECTED = "rejected";
const PENDING = "pending";

class NotNow {
  #state = PENDING;
  #value;
  #onFulfilleds = [];
  #onRejecteds = [];

  constructor(fn) {
    try {
      const [fulfill, reject] = once([
        this.#fulfill.bind(this),
        this.#reject.bind(this),
      ]);
      fn(fulfill, reject);
    } catch (e) {
      reject(e);
    }
  }

  then(onFulfilled, onRejected) {
    return new NotNow((nextFulfill, nextReject) => {
      this.#addOnFulfilled((value) => {
        try {
          if (typeof onFulfilled !== "function") {
            nextFulfill(value);
          } else {
            nextFulfill(onFulfilled(value));
          }
        } catch (e) {
          nextReject(e);
        }
      });
      this.#addOnRejected((error) => {
        try {
          if (typeof onRejected !== "function") {
            nextReject(error);
          } else {
            nextFulfill(onRejected(error));
          }
        } catch (e) {
          nextReject(e);
        }
      });
    });
  }

  #addOnFulfilled(onFulfilled) {
    if (this.#state === PENDING) {
      this.#onFulfilleds.push(onFulfilled);
    } else if (this.#state === FULFILLED) {
      queueMicrotask(() => onFulfilled(this.#value));
    }
  }

  #addOnRejected(onRejected) {
    if (this.#state === PENDING) {
      this.#onRejecteds.push(onRejected);
    } else if (this.#state === REJECTED) {
      queueMicrotask(() => onRejected(this.#value));
    }
  }

  #fulfill(value) {
    const [fulfill, reject] = once([
      this.#fulfill.bind(this),
      this.#reject.bind(this),
    ]);
    if (value === this) {
      return reject(new TypeError("value is the same promise"));
    } else if (
      value &&
      (typeof value === "object" || typeof value === "function")
    ) {
      try {
        const then = value.then;
        if (typeof then === "function") {
          return then.bind(value)(fulfill, reject);
        }
      } catch (e) {
        return reject(e);
      }
    }
    this.#state = FULFILLED;
    this.#value = value;
    queueMicrotask(() => this.#onFulfilleds.forEach((fn) => fn(value)));
  }

  #reject(error) {
    this.#state = REJECTED;
    this.#value = error;
    queueMicrotask(() => this.#onRejecteds.forEach((fn) => fn(error)));
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finally(fn) {
    return this.then(
      (value) => {
        fn();
        return value;
      },
      (error) => {
        fn();
        throw error;
      }
    );
  }

  static resolve(value) {
    return new NotNow((fulfill) => fulfill(value));
  }

  static reject(error) {
    return new NotNow((fulfill, reject) => reject(error));
  }

  static all(notNows) {
    return new NotNow((fulfill, reject) => {
      if (notNows.length === 0) return fulfill([]);
      const values = Array(notNows.length);
      let remaining = notNows.length;
      notNows.forEach((notNow, i) => {
        NotNow.resolve(notNow).then((value) => {
          values[i] = value;
          --remaining;
          if (remaining === 0) fulfill(values);
        }, reject);
      });
    });
  }

  static allSettled(notNows) {
    return new NotNow((fulfill) => {
      if (notNows.length === 0) return fulfill([]);
      const values = Array(notNows.length);
      let remaining = notNows.length;
      notNows.forEach((notNow, i) => {
        NotNow.resolve(notNow)
          .then((value) => {
            values[i] = { status: FULFILLED, value };
          })
          .catch((reason) => {
            values[i] = { status: REJECTED, reason };
          })
          .finally(() => {
            --remaining;
            if (remaining === 0) fulfill(values);
          });
      });
    });
  }

  static race(notNows) {
    return new NotNow((fulfill, reject) => {
      notNows.forEach((notNow) => {
        NotNow.resolve(notNow).then(fulfill, reject);
      });
    });
  }

  static any(notNows) {
    return new NotNow((fulfill, reject) => {
      if (notNows.length === 0) reject(new AggregateError([]));
      let remaining = notNows.length;
      let errors = [];
      notNows.forEach((notNow, i) => {
        NotNow.resolve(notNow)
          .then(fulfill)
          .catch((error) => {
            errors[i] = error;
            --remaining;
            if (remaining === 0) reject(new AggregateError(errors));
          });
      });
    });
  }
}

function once(fns) {
  let called = false;
  return fns.map((fn) => (arg) => {
    if (called) return;
    called = true;
    fn(arg);
  });
}

module.exports = NotNow;
