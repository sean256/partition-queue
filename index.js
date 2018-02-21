const dependencies = require('./lib');
const PartitionQueue = require('./partition-queue')(dependencies);

module.exports = PartitionQueue;