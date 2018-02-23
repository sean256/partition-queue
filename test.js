/* eslint-env mocha */

const assert = require('assert');
const dependencies = require('./lib');
const PQ = require('./partition-queue');

const { hashString } = dependencies;

// dumb hashing function to ensure a test fills all queues
const roundRobinHashingFunction = () => {
	let i = -1;
	return (key, concurrency) => {
		i += 1;
		return i % concurrency;
	};
};

const PartitionQueue = PQ(dependencies);

describe('hashes string', () => {
	it('Hashes a string into an int', () => {
		const stringToHash = 'Hello World';
		const hash = hashString(stringToHash, 10);
		assert.equal(typeof hash, 'number');
	});
});

describe('PartitionQueue', () => {
	it('Creates an instance with proper defaults and properties', () => {
		const q = new PartitionQueue();
		assert.equal(q.concurrency, 1);
		assert.equal(q.timeout, 0);
		assert.equal(q.autostart, false);
		assert.equal(q.hashingFunction, hashString);
		assert.equal(q.remaining, 0);
		assert.equal(q.queues.length, 1);
	});

	it('Creates an instance with options', () => {
		const options = { concurrency: 2, timeout: 200, autostart: true };
		const q = new PartitionQueue(options);
		assert.equal(q.concurrency, 2);
		assert.equal(q.timeout, 200);
		assert.equal(q.autostart, true);
		assert.equal(q.remaining, 0);
		assert.equal(q.queues.length, 2);
	});

	it('Adds a job with a partition key', () => {
		const q = new PartitionQueue();
		const key = 'some key';
		const job = () => {};
		q.push(key, job);
		assert.equal(q.remaining, 1);
		assert.equal(q.queues[0].length, 1);
		assert.equal(q.queues[0][0], job);
	});

	it('Adds a job with a partition key then auto starts it', (done) => {
		const q = new PartitionQueue({ autostart: true });
		const key = 'some key';
		let didJob = false;
		const job = (jobDone) => { didJob = true; jobDone(); };

		q.on('success', () => {
			assert.equal(didJob, true);
			done();
		});

		q.push(key, job);
	});

	it('Returns value from job to success callback', (done) => {
		const q = new PartitionQueue({ autostart: true });
		const key = 'some key';
		const result = 'some result';
		const job = (jobDone) => { jobDone(result); };

		q.on('success', (r) => {
			assert.equal(r, result);
			done();
		});

		q.push(key, job);
	});

	it('Adds a job with a partition key then start it manually', (done) => {
		const q = new PartitionQueue();
		const key = 'some key';
		let didJob = false;
		const job = (jobDone) => { didJob = true; jobDone(); };

		q.on('success', () => {
			assert.equal(didJob, true);
			done();
		});

		q.push(key, job);
		q.start();
	});

	it('Adds a promise based job with a partition key then auto starts it', (done) => {
		const q = new PartitionQueue({ autostart: true });
		const key = 'some key';
		let didJob = false;
		const job = () => new Promise((resolve) => {
			didJob = true;
			resolve();
		});

		q.on('success', () => {
			assert.equal(didJob, true);
			done();
		});

		q.push(key, job);
	});

	it('Calls done when all jobs complete', (done) => {
		const q = new PartitionQueue({ autostart: true });
		const key = 'some key';
		const job = (jobDone) => { jobDone(); };

		q.on('done', () => {
			done();
		});

		q.push(key, job);
	});

	it('Calls error on job rejection', (done) => {
		const q = new PartitionQueue({ autostart: true });
		const key = 'some key';
		const e = new Error('Uh Oh');
		const job = (jobDone, reject) => { reject(e); };

		q.on('error', (error) => {
			assert.equal(error, e);
			done();
		});

		q.push(key, job);
	});

	it('Calls error on job exception', (done) => {
		const q = new PartitionQueue({ autostart: true });
		const key = 'some key';
		const e = new Error('Uh Oh');
		const job = () => { throw e; };

		q.on('error', (error) => {
			assert.equal(error, e);
			done();
		});

		q.push(key, job);
	});

	it('Calls error on promise job reject', (done) => {
		const q = new PartitionQueue({ autostart: true });
		const key = 'some key';
		const e = new Error('Uh Oh');
		const job = () => new Promise((resolve, reject) => {
			reject(e);
		});

		q.on('error', (error) => {
			assert.equal(error, e);
			done();
		});

		q.push(key, job);
	});

	it('Calls unknown error on promise job reject without error', (done) => {
		const q = new PartitionQueue({ autostart: true });
		const key = 'some key';
		const job = () => new Promise((resolve, reject) => { reject(); });

		q.on('error', (error) => {
			assert.equal(error.message, 'Unknown Error when processing Job');
			done();
		});

		q.push(key, job);
	});

	it('Calls done when all jobs in different queues are complete', (done) => {
		const q = new PartitionQueue({ concurrency: 3, hashingFunction: roundRobinHashingFunction() });
		const key = 'some key';

		q.on('done', () => {
			done();
		});

		q.push(key, (jobDone) => { jobDone(); });
		q.push(key, (jobDone) => { jobDone(); });
		q.push(key, (jobDone) => { jobDone(); });
		q.push(key, (jobDone) => { jobDone(); });
		q.push(key, (jobDone) => { jobDone(); });

		q.start();
	});

	it('Times out', (done) => {
		const q = new PartitionQueue({ autostart: true, timeout: 50 });
		const key = 'some key';
		const job = () => {};
		q.on('timeout', () => {
			done();
		});
		q.push(key, job);
	});

	it('Times out prevents double call', (done) => {
		const q = new PartitionQueue({ autostart: true, timeout: 50 });
		const key = 'some key';
		const job = (jobDone) => {
			setTimeout(jobDone, 55);
		};
		q.on('timeout', () => {
			done();
		});
		q.push(key, job);
	});

	it('Prevent double done by job', (done) => {
		const q = new PartitionQueue({ autostart: true });
		const key = 'some key';
		const job = (jobDone) => {
			jobDone();
			jobDone();
		};
		q.on('done', () => {
			done();
		});
		q.push(key, job);
	});

	it('Prevent double start', (done) => {
		const q = new PartitionQueue();
		const key = 'some key';
		const job = (jobDone) => { setImmediate(jobDone); };
		q.on('done', () => {
			done();
		});
		q.push(key, job);
		q.start();
		q.start();
	});

	it('Start as promise resolve', (done) => {
		const q = new PartitionQueue();
		const key = 'some key';
		const job = (jobDone) => { setImmediate(jobDone); };
		q.push(key, job);
		q.start().then(done);
	});

	it('Adds instantly resolving jobs', (done) => {
		const q = new PartitionQueue();
		const key = 'some key';
		const jobCount = 3;

		q.on('done', () => {
			done();
		});

		for (let i = 0; i < jobCount; i += 1) {
			const job = (jobDone) => {
				jobDone();
			};
			q.push(key, job);
		}

		q.start();
	});

	it('Adds instantly resolving jobs and drains with autostart', (done) => {
		const q = new PartitionQueue({ autostart: true });
		const key = 'some key';
		const jobCount = 3;
		let completeCount = 0;

		// using success instead of done since instantly resolving jobs will call
		// on('done) immediately before the next is added when using autostart
		q.on('success', () => {
			completeCount += 1;
			if (completeCount === jobCount) {
				done();
			}
		});

		for (let i = 0; i < jobCount; i += 1) {
			const job = (jobDone) => {
				jobDone();
			};
			q.push(key, job);
		}
	});

	it('Adds instantly resolving jobs to multiple queues with autostart', (done) => {
		const q = new PartitionQueue({ autostart: true, concurrency: 10 });
		const jobCount = 100;
		let completeCount = 0;

		// using success instead of done since instantly resolving jobs will call
		// on('done) immediately before the next is added when using autostart
		q.on('success', () => {
			completeCount += 1;
			if (completeCount === jobCount) {
				done();
			}
		});

		for (let i = 0; i < jobCount; i += 1) {
			const key = `key-${i}`;
			const job = (jobDone) => {
				jobDone();
			};
			q.push(key, job);
		}
	});

	it('Adds instantly resolving promise jobs to multiple queues with autostart', (done) => {
		const q = new PartitionQueue({ autostart: true, concurrency: 10 });
		const jobCount = 100;
		let completeCount = 0;

		// using success instead of done since instantly resolving jobs will call
		// on('done) immediately before the next is added when using autostart
		q.on('success', () => {
			completeCount += 1;
			if (completeCount === jobCount) {
				done();
			}
		});

		for (let i = 0; i < jobCount; i += 1) {
			const key = `key-${i}`;
			const job = () => new Promise((resolve) => { resolve(); });
			q.push(key, job);
		}
	});
});
