const { EventEmitter } = require('events');

let dependencies;

class PartitionQueue extends EventEmitter {
	constructor(options) {
		super();
		this.options = options || {};
		this.concurrency = this.options.concurrency || 1;
		this.timeout = this.options.timeout || 0;
		this.autostart = this.options.autostart || false;
		this.hashingFunction = this.options.hashingFunction || dependencies.hashString;
		this.remaining = 0;
		this.queues = [...new Array(this.concurrency)].map(() => []);

		this.startPromiseResolve = null;
	}

	push(key, job) {
		const {
			concurrency,
			queues,
			autostart,
			hashingFunction,
		} = this;
		const queueNumber = hashingFunction(key, concurrency);
		const queue = queues[queueNumber];
		queue.push(job);
		this.remaining += 1;
		if (!queue.running && autostart) {
			this.next(queueNumber);
		}
	}

	start() {
		const { queues } = this;
		return new Promise((resolve) => {
			this.startPromiseResolve = resolve;
			queues.forEach((queue, queueNumber) => {
				if (!queue.running) {
					this.next(queueNumber);
				}
			});
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
				if (doneCalled) return; // prevent a double call
				doneCalled = true;
				this.remaining -= 1;
				this.emit('success', result, job);
				if (!this.remaining) {
					this.emit('done');
					queue.running = false;
					if (this.startPromiseResolve) {
						this.startPromiseResolve();
						this.startPromiseResolve = null;
					}
				}
				this.next(queueNumber);
			};
			timeout = timeoutMs ? (setTimeout(() => { this.emit('timeout'); done(new Error('Time Out')); }, timeoutMs)) : null;
			// execute the job
			try {
				const promise = job(result => done(null, result), error => done(error));
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

module.exports = (dependenciesInjection) => {
	dependencies = dependenciesInjection;
	return PartitionQueue;
};
