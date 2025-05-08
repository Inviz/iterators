import { pubsub } from './lib/pubsub';
import { writer } from './lib/writer';
import { AnyIterable, MaybePromise } from './types';

export type Branches = Record<string, (input: AnyIterable<any>) => AnyIterable<any>>;
export type BranchValues<R extends Branches> = {
  [key in keyof R]?: (R[key] extends (input: AnyIterable<infer T>) => any ? T : never) | undefined;
};
export type BranchWriters<R extends Branches> = {
  [key in keyof R]: ReturnType<typeof writer>;
};
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
export function _dispatch<T, R extends Branches>(
  iterator: AnyIterable<T>,
  splitter: (item: T) => MaybePromise<BranchValues<R>>,
  branches: R,
  concurrency: number = 1
): AsyncGenerator<T> {
  const writers = Object.entries(branches).reduce((acc, [key, branch]) => {
    return { ...acc, [key]: writer(branch, concurrency) };
  }, {} as BranchWriters<R>);

  const { output, input, onReadError, onReadComplete } = pubsub<Promise<T>>(concurrency);
  var isDone = false;

  const dispatcher = async (item: T, index: number, iterable: AnyIterable<T>) => {
    const branched = await splitter(item);

    await Promise.all(
      Object.entries(branched).map(([key, value]) =>
        value === undefined ? undefined : writers[key as keyof typeof writers]?.write(value)
      )
    );

    // yield item back to allow downstream to control the consumption
    return item;
  };
  let streams: (Promise<any> | undefined)[] = [];
  return output({
    onStart: async () => {
      streams = Object.values(writers).map(writer => writer.start());
      input(iterator, dispatcher);
      Promise.all(streams).catch(e => {
        onReadError(e);
        onReadComplete();
      });
    },
    onComplete: async () => {
      await Promise.all(Object.values(writers).map(writer => writer.end()));
      // allow streams to throw errors
      await Promise.all(streams);
    },
  });
}

export function dispatch<T, R extends Branches>(
  input: AnyIterable<T>,
  splitter: (item: T) => MaybePromise<BranchValues<R>>,
  branches: R,
  concurrency?: number
): AsyncGenerator<T>;

export function dispatch<T, R extends Branches>(
  splitter: (item: T) => MaybePromise<BranchValues<R>>,
  branches: R,
  concurrency?: number
): (iterator: AnyIterable<T>) => AsyncGenerator<T>;

export function dispatch<T>(input: any, splitter: any, branches: any, concurrency?: any) {
  if (typeof input === 'function') {
    return (_input: AnyIterable<T>) => dispatch(_input, input, splitter, branches);
  } else {
    return _dispatch(input, splitter, branches, concurrency);
  }
}
