const { Queue } = require('bullmq');
const connection = require('./redisConnection');

const codeExecutionQueue = new Queue('code-execution', { connection });

module.exports = codeExecutionQueue;
