/**
 * Creates a simple publish-subscribe mechanism for async iterators
 * Used to coordinate values between producers and consumers
 * @param bufferCapacity Optional maximum number of items that can be produced ahead of consumption
 */
export function pubsub<T>(bufferCapacity: number = Infinity) {
  const producing = new Set<Promise<T>>();
  const consuming = new Set<(value: T) => void>();
  const buffer = new Set<() => T>();
  const waitingProducers = new Set<() => void>();
  /**
   * Helper to take the first callback from a set, remove it, and execute it
   */
  function notify<R, A extends any[]>(set: Set<(...args: A) => R>, ...args: A): R | undefined {
    const callback = set.entries().next()?.value?.[0];
    if (callback) {
      set.delete(callback);
      return callback(...args);
    }
    return undefined;
  }

  /**
   * Wait for queue to free up
   *  */
  async function wait() {
    return new Promise<void>(resolve => {
      waitingProducers.add(resolve);
    });
  }

  /**
   * Publish a value to be consumed. If queue is full, resolves when space is available.
   */
  async function publish(value: T): Promise<void> {
    // Block publisher if buffer capacity is reached
    if (producing.size >= bufferCapacity) {
      await wait();
    }

    // Create a promise that will resolve when the value is consumed
    const promise = Promise.resolve(value).then(async value => {
      if (consuming.size === 0) {
        // value arrived ahead of consumer
        await new Promise<void>(resolve => {
          buffer.add(() => {
            producing.delete(promise);
            resolve();

            // If we have waiting producers, signal one to proceed
            notify(waitingProducers);

            return value;
          });
        });
      } else {
        // there is consumer waiting for value
        producing.delete(promise);
        notify(consuming, value);

        // If we have waiting producers, signal one to proceed
        notify(waitingProducers);
      }
      return value;
    });
    producing.add(promise);
  }

  /**
   * Consume a value when it becomes available
   */
  async function consume(): Promise<T> {
    const result = notify(buffer);
    if (result !== undefined) {
      return Promise.resolve(result);
    }
    return new Promise<T>(resolve => {
      consuming.add(resolve);
    });
  }

  return { publish, consume, producing, consuming, buffer, wait };
}
