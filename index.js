const { EventEmitter } = require('events');

function hashString(string, concurrency) {
	/* eslint no-bitwise: ["error", { "allow": ["<<"] }] */
	const hash = string.split('').reduce((prevHash, currVal) => ((prevHash << 5) - prevHash) + currVal.charCodeAt(0), 0);
	return Math.abs(hash) % concurrency;
}

function randomInt(concurrency) {
	return Math.floor(Math.random() * Math.floor(concurrency));
}

class PartitionQueue extends EventEmitter {
	constructor(options) {
		super();
		this.options = options || {};
		this.concurrency = this.options.concurrency || 1;
		this.timeout = this.options.timeout || 0;
		this.autostart = this.options.autostart || false;
		this.timers = {};
		this.remaining = 0;
		this.queues = [...new Array(this.concurrency)].map(() => []);

		Object.defineProperty(this, 'length', {
			get: () => this.remaining,
		});
	}

	partition(key) {
		return {
			push: job => this.push(key, job),
		};
	}

	push(key, job) {
		const { concurrency, queues, autostart } = this;
		const queueNumber = key ? hashString(key, concurrency) : randomInt(concurrency);
		const queue = queues[queueNumber];
		queue.push(job);
		this.remaining += 1;
		if (!queue.running && autostart) {
			this.next(queueNumber);
		}
	}

	start() {
		const { queues } = this;
		queues.forEach((queue, queueNumber) => {
			if (!queue.running) {
				this.next(queueNumber);
			}
		});
	}

	next(queueNumber) {
		const { queues, timeout: timeoutMs } = this;
		const queue = queues[queueNumber];
		queue.running = true;
		const job = queue.shift();
		if (job) {
			let timeout;
			let doneCalled = false;
			const done = (error, result) => {
				if (error) { this.emit('error', error); }
				if (timeout) { clearTimeout(timeout); }
				if (doneCalled) return; // prevent a double call incase job completes after timeout
				doneCalled = true;
				this.emit('success', result, job);
				this.remaining -= 1;
				if (!this.length) {
					this.emit('done');
					queue.running = false;
				}
				this.next(queueNumber);
			};
			timeout = timeoutMs ? (setTimeout(() => { this.emit('timeout'); done(new Error('Time Out')); }, timeoutMs)) : null;
			// execute the job
			try {
				const promise = job(done);
				if (promise) {
					promise.then((result) => {
						done(null, result, job);
					}).catch((error) => {
						done(error || new Error('Unknown Error when processing Job'));
					});
				}
			} catch (error) {
				done(error);
			}
		}
	}
}

module.exports = PartitionQueue;
