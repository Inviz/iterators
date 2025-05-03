# @augceo/iterators

Concurrent iterator utilities for working with async generators in JavaScript/TypeScript. Built as an extension for the [rotery](https://github.com/somnicattus/rotery) library.

## Installation

```bash
npm install @augceo/iterators
```

## Features

- **concurrent**: Process items concurrently with a specified concurrency limit
- **race**: Process multiple async iterators concurrently, yielding values as they become available
- **pubsub**: Low-level primitives for coordinating async operations
- **rotery-async**: Simplified re-exports of rotery's async functions without the namespace structure

## Usage

### Concurrent Processing

```typescript
import { concurrent } from '@augceo/iterators';
import * as Rt from 'rotery';

// Define a function that does some async work
async function processItem(item) {
  await someAsyncOperation(item);
  return transformedItem;
}

// Create a pipeline with concurrent processing
const pipeline = Rt.pipe(
  getDataSource(),
  concurrent(4, processItem), // Process 4 items concurrently
  Rt.filter.async(Boolean),
  Rt.map.async(formatResult)
);

// Consume the results
for await (const result of pipeline) {
  console.log(result);
}
```

### Processing Multiple Iterators with Race

```typescript
import { race } from '@augceo/iterators';
import * as Rt from 'rotery';

// Create multiple data sources
const source1 = getDataSource1();
const source2 = getDataSource2();
const source3 = getDataSource3();

// Process them concurrently using race
const pipeline = Rt.pipe(
  [source1, source2, source3], // Array of iterators
  race(3), // Process all 3 iterators concurrently
  Rt.map.async(processResult)
);

// Consume results as they become available from any source
for await (const result of pipeline) {
  console.log(result);
}
```

### Using Simplified Rotery Async Functions

```typescript
import { pipe, map, filter, take, mapWithConcurrency } from '@augceo/iterators';

// Instead of Rt.map.async, use map directly
const pipeline = pipe(
  getData(),
  filter(item => item.isValid), // Simpler than Rt.filter.async
  map(item => processItem(item)), // Simpler than Rt.map.async
  take(10) // Simpler than Rt.take.async
);

// Use built-in concurrency helper
const concurrentPipeline = pipe(
  getData(),
  mapWithConcurrency(5, processItemSlowly) // Process 5 items concurrently
);

for await (const result of concurrentPipeline) {
  console.log(result);
}
```

## API Reference

### concurrent(concurrency, iteratorFn)

Creates a function that processes an iterable concurrently with the specified concurrency limit.

- **concurrency**: Maximum number of concurrent operations
- **iteratorFn**: Function to apply to each item in the iterable
- **Returns**: A function that takes an iterable and returns an async generator

### race(concurrency)

Creates a function that processes multiple async iterables concurrently, yielding values as they become available.

- **concurrency**: Maximum number of concurrent iterators to process
- **Returns**: A function that takes an iterable of iterators and returns an async generator

### pubsub()

Creates a simple publish-subscribe mechanism for async iterators.

- **Returns**: An object with `publish` and `consume` methods for coordinating async values

### Rotery Async Functions

All rotery async functions are re-exported with a simpler naming scheme. Instead of `Rt.map.async` you can use `map` directly:

- **map**: Map each element of a series to a new value
- **filter**: Filter elements based on a predicate
- **chunk**: Group elements into chunks of a specified size
- **take**: Take a specified number of elements
- **find**: Find the first element matching a predicate
- **flatten**: Flatten a nested series of elements
- **mapWithConcurrency**: Map elements with a specified concurrency limit

And many more. Check the source code for all available functions.

## License

MIT
