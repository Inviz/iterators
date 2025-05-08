import { AnyIterable } from '../types';

/**
 * Creates a simple publish-subscribe mechanism for async iterators
 * Used to coordinate values between producers and consumers
 * @param bufferCapacity Optional maximum number of items that can be produced ahead of consumption
 */
export function pubsub<R, T = R>(bufferCapacity: number = Infinity) {
  const producing = new Set<Promise<R>>();
  const consuming = new Set<(value: R) => void>();
  const buffer = new Set<() => R>();
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
  async function publish(value: R): Promise<void> {
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
            removeProducer(promise);
            resolve();

            // If we have waiting producers, signal one to proceed
            notify(waitingProducers);

            return value;
          });
        });
      } else {
        // there is consumer waiting for value
        removeProducer(promise);
        notify(consuming, value);

        // If we have waiting producers, signal one to proceed
        notify(waitingProducers);
      }
      return value;
    });

    promise.catch(e => {
      onReadError(e as Error);
      removeProducer(promise);
    });
    addProducer(promise);
  }

  function removeProducer(promise: Promise<R>) {
    producing.delete(promise);
  }

  function addProducer(promise: Promise<R>) {
    producing.add(promise);
  }
  /**
   * Consume a value when it becomes available
   */
  async function consume(): Promise<R> {
    const result = notify(buffer);
    if (result !== undefined) {
      return Promise.resolve(result);
    }
    return new Promise<R>(resolve => {
      consuming.add(resolve);
    });
  }

  async function* output({
    onStart,
    onComplete,
  }: {
    onStart?: () => Promise<void>;
    onComplete?: () => Promise<void>;
  } = {}): AsyncGenerator<Awaited<R>> {
    try {
      onStart?.();
      while (true) {
        var valueReady = consume();
        const result = await Promise.race([readComplete, readError, valueReady]);
        if (result === undefined) {
          if (producing.size) {
            yield valueReady;
          }
        } else {
          yield result;
        }
        if (!producing.size && isDone) {
          break;
        }
      }
    } finally {
      await onComplete?.();
    }
  }

  async function input(
    iterator: AnyIterable<T>,
    transform: (item: T, index: number, iterator: AnyIterable<T>) => R = (item, index, iterator) =>
      item as any as R
  ) {
    try {
      var i = 0;
      for await (const item of iterator) {
        if (producing.size >= bufferCapacity) {
          await wait();
        }
        publish(transform(item, i++, iterator));
      }
    } catch (e) {
      onReadError(e as Error);
    } finally {
      onReadComplete();
    }
  }

  let isDone = false;
  let _onReadComplete: () => void;
  let onReadError = (e: Error) => {};
  let readError = new Promise<void>((resolve, reject) => {
    onReadError = reject;
  });

  let readComplete = new Promise<void>((resolve, reject) => {
    _onReadComplete = resolve;
  });
  const onReadComplete = () => {
    isDone = true;
    _onReadComplete();
    readComplete = new Promise<void>((resolve, reject) => {
      _onReadComplete = resolve;
    });
  };

  return {
    publish,
    consume,
    producing,
    consuming,
    buffer,
    wait,
    input,
    output,
    onReadError,
    onReadComplete,
  };
}
