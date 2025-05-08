import { pubsub } from './lib/pubsub';
import { writer } from './lib/writer';
import { AnyIterable, MaybePromise } from './types';

/**
 * Partition function takes a splitter function and multiple processors.
 * The splitter function splits each input item into a tuple of parts.
 * Items returned from splitter get routed to processors by index
 *
 * Backpressure is provided both by downstream steps and by branching steps.
 *
 * @param splitter Function that splits each input item into a tuple
 * @param processors Processing functions, one for each position in the tuple
 * @returns A function that takes an iterable input and returns processed results
 */
export function _dispatch<T, A, B, C, D, AA, BB, CC, DD>(
  iterator: AnyIterable<T>,
  splitter: (item: T) => MaybePromise<readonly [a?: A, b?: B, c?: C, d?: D]>,
  a?: (input: AnyIterable<A>) => AnyIterable<AA>,
  b?: (input: AnyIterable<B>) => AnyIterable<BB>,
  c?: (input: AnyIterable<C>) => AnyIterable<CC>,
  d?: (input: AnyIterable<D>) => AnyIterable<DD>,
  concurrency: number = 1
): AsyncGenerator<T> {
  const streamA = a ? writer(a, concurrency) : undefined;
  const streamB = b ? writer(b, concurrency) : undefined;
  const streamC = c ? writer(c, concurrency) : undefined;
  const streamD = d ? writer(d, concurrency) : undefined;

  const { publish, consume, producing, wait, output: loop, end } = pubsub<Promise<T>>(concurrency);
  var isDone = false;

  const dispatcher = async (item: T, index: number, iterable: AnyIterable<T>) => {
    const [a, b, c, d] = await splitter(item);

    await Promise.all([
      a ? streamA?.write(a) : undefined,
      b ? streamB?.write(b) : undefined,
      c ? streamC?.write(c) : undefined,
      d ? streamD?.write(d) : undefined,
    ]);

    // yield item back to allow downstream to control the consumption
    return item;
  };

  (async function consumer() {
    try {
      var i = 0;
      for await (const item of iterator) {
        if (producing.size >= concurrency) {
          await wait();
        }
        publish(dispatcher(item, i++, iterator));
      }
    } finally {
      end();
      console.log('consumer done!!!', isDone);
    }
  })();

  const streams = [streamA?.start(), streamB?.start(), streamC?.start(), streamD?.start()];
  return loop(async () => {
    console.log('finishing');
    await Promise.all([streamA?.end(), streamB?.end(), streamC?.end(), streamD?.end()]);
    console.log('finished');
    const result = await Promise.all(streams);
    console.log('result', result);
    return result;
  });
}

export function dispatch<T, A, B, C, D, AA, BB, CC, DD>(
  splitter: (item: T) => MaybePromise<readonly [a?: A, b?: B, c?: C, d?: D]>,
  a?: (input: AnyIterable<A>) => AnyIterable<AA>,
  b?: (input: AnyIterable<B>) => AnyIterable<BB>,
  c?: (input: AnyIterable<C>) => AnyIterable<CC>,
  d?: (input: AnyIterable<D>) => AnyIterable<DD>,
  concurrency?: number
): (iterator: AnyIterable<T>) => AsyncGenerator<T>;

export function dispatch<T>(
  input: any,
  splitter: any,
  a: any,
  b: any,
  c: any,
  d: any,
  concurrency?: any
) {
  if (typeof input === 'function') {
    return (_input: AnyIterable<T>) => dispatch(_input, input, splitter, a, b, c, d);
  } else {
    return _dispatch(input, splitter, a, b, c, d, concurrency);
  }
}
