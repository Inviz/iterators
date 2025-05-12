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

    //console.log('publish', producing.size, bufferCapacity, value?.length);

    // Create a promise that will resolve when the value is consumed
    const promise = Promise.resolve(value).then(async value => {
      //console.log(
      //  'publish promise',
      //  consuming.size,
      //  producing.size,
      //  bufferCapacity,
      //  value?.length,
      //  buffer?.size
      //);
      if (value == 'skip') {
        producing.delete(promise);
        return value;
      }
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

    promise.catch(e => {
      onReadError(e as Error);
      producing.delete(promise);
    });
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

  /**
   * Output values from the queue concurrently. Rethrow errors happened during input or transformation.
   * */
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
        const result = await new Promise<R | undefined>((accept, reject) => {
          _onReadError = reject;
          _onReadComplete = accept;
          Promise.resolve(valueReady).then(accept, reject);
        });
        //console.log('output result', [readComplete, readError, valueReady]);
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

  /**
   * Consume iterator values into a queue without blocking the output
   * */
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
  let _onReadError = (e: Error) => {};
  let _onReadComplete = () => {
    return undefined;
  };
  let onReadError = (e: Error) => {
    console.log('onReadError', e);
    _onReadError(e);
  };
  let onReadComplete = () => {
    console.log('onReadComplete');
    isDone = true;
    _onReadComplete();
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
