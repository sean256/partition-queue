# Partition Queue

[![npm](http://img.shields.io/npm/v/partition-queue.svg?style=flat-square)](http://www.npmjs.org/queue)
[![Build Status](https://travis-ci.org/sean256/partition-queue.svg?branch=master)](https://travis-ci.org/sean256/partition-queue)
[![Coverage Status](https://coveralls.io/repos/github/sean256/partition-queue/badge.svg?branch=feature%2Fpartition-queue)](https://coveralls.io/github/sean256/partition-queue?branch=feature%2Fpartition-queue)

A Partitioned asynchronous function queue with adjustable concurrency. Jobs with the same key are guaranteed to be processed in order.


## Install

`npm install partition-queue`

## Test

`npm test`

## Examples

```js
const PartitionQueue = require('./partition-queue');

const q = new PartitionQueue();
// add a job using a key then call done when the job is complete
q.push('someKey', (done, error) => {
	setTimeout(() =>{
		const fakeResult = 'abc';
		done(fakeResult);
	}, 500);
});

q.on('success', (result) => {
	// When a single job completes
});

q.on('done', (result) => {
	// when all jobs are done
});

q.on('error', (error) => {
	// When a single job errors
});

q.on('timeout', () => {
	// When a single job times out
});

q.start().then(() => {
	// start returns a promise which can be used as an alternative to the 'done' event.
})
```

#### Using promise based jobs
```js
q.push('someKey', () => {
	return new Promise((resolve, reject) => {
		// do some stuff
		resolve();
	})
});
```

#### Even better, use async functions
```js
q.push('someKey', async () => {
	const result = await someAsyncThing();
	return result;
});
```

## API

### `const q = new ParitionQueue([opts])`

Constructor. Available options:

options | description | default
--- | --- | ---
autostart | When `true` the queue will begin as soon as jobs are added | `false`
concurrency | The total number of "queues" to place jobs into | 1
hashingFunction | `(key, n) => { /* return value between 0 and n-1 */ }` | See `./lib.js hashString()`
timeout | If a job takes longer than this in ms then timeout the job and continue processing | 0 (no timeout)

## Instance Methods

### `q.push(key, job)`

Add a job to the queue with a given partition key. It can be a function which accepts `(done, error)` callbacks, a function which returns a promise or an `async function`

### `const promise = q.start()`

Manually start the queue.

## Events

### `q.emit('success', result, job)`
After a job executes is's done callback.

### `q.emit('error', error, job)`
When a job throws an exception, calls the error callback or a promise based job is rejected.

### `q.emit('timeout', job)`
After a job takes longer then the set timeout.

### `q.emit('end')`
After all jobs have been processed.

## Releases

- 1.x
  - Initial