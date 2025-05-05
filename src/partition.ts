/**
 * Partition function takes a splitter function and multiple processors.
 * The splitter function splits each input item into a tuple of parts.
 * Each processor is applied to a collection of the corresponding parts from all items.
 *
 * @param splitter Function that splits each input item into a tuple
 * @param processors Processing functions, one for each position in the tuple
 * @returns A function that takes an iterable input and returns processed results
 */
export function partition<T, R extends readonly unknown[]>(
  splitter: (item: T) => R,
  ...processors: { [P in keyof R]: (items: Iterable<R[P]>) => Iterable<unknown> }
): (input: Iterable<T>) => Array<Iterable<unknown>> {
  return (input: Iterable<T>) => {
    // Create arrays to hold the split values (indexed by position in tuple)
    const buckets = Array.from(
      { length: processors.length },
      () => [] as unknown[]
    );

    // Split each input item and distribute to buckets
    for (const item of input) {
      const parts = splitter(item);
      for (let i = 0; i < Math.min(parts.length, processors.length); i++) {
        // Safe to cast because we're using the tuple index
        buckets[i].push(parts[i as keyof R]);
      }
    }

    // Process each bucket with its corresponding processor
    return buckets.map((bucket, index) =>
      // Use the correctly typed processor for each bucket
      (processors[index as keyof typeof processors])(bucket)
    );
  };
}

// Example usage with typed tuples using 'as const'
/*
import * as I from './iterators';

interface Game { /* ... */ }
interface Stats { /* ... */ }
interface Hand {
  game: Game;
  stats: Stats;
}

const results = partition(
  (hand: Hand) => [
    hand.game,
    hand.stats
  ] as const, // Creates tuple type readonly [Game, Stats]
  I.map((game: Game) => processGame(game)),  // First processor handles Game type
  I.pipe(
    I.map((stats: Stats) => processStats(stats)) // Second processor handles Stats type
  )
)(inputData);
*/
