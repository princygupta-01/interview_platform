const { Worker } = require('bullmq');
const axios = require('axios');
require('dotenv').config();
const connection = require('./redisConnection');

// The public emkc.org Piston API requires an authorization token since
// Feb 2026. Point PISTON_URL at a self-hosted Piston instance
// (e.g. http://my-vps:2000/api/v2/execute) or at the public API together
// with PISTON_TOKEN if you have been granted one.
const PISTON_URL = process.env.PISTON_URL || 'https://emkc.org/api/v2/piston/execute';
const PISTON_TOKEN = process.env.PISTON_TOKEN;

const LANGUAGE_CONFIG = {
  javascript: { language: 'javascript', version: '18.15.0' },
  python: { language: 'python', version: '3.10.0' },
};

async function runCodeViaPiston(code, language, input = '') {
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    return { success: false, output: `Unsupported language: ${language}` };
  }

  try {
    const res = await axios.post(PISTON_URL, {
      language: config.language,
      version: config.version,
      files: [{ content: code }],
      stdin: input,
    }, {
      timeout: 15000,
      headers: PISTON_TOKEN ? { Authorization: PISTON_TOKEN } : {},
    });

    const { run } = res.data;
    if (!run) {
      return { success: false, output: 'Code runner returned an unexpected response' };
    }

    if (run.signal === 'SIGKILL' || run.code === null) {
      return { success: false, output: 'Execution timed out or was killed' };
    }

    if (run.stderr) {
      return { success: false, output: run.stderr };
    }

    return { success: true, output: run.stdout };
  } catch (err) {
    const status = err.response && err.response.status;
    if (status === 401 || status === 403) {
      return {
        success: false,
        output:
          'Code runner rejected the request (unauthorized). Set PISTON_URL to a self-hosted Piston instance or provide PISTON_TOKEN.',
      };
    }
    return { success: false, output: `Execution error: ${err.message}` };
  }
}

const worker = new Worker(
  'code-execution',
  async (job) => {
    console.log('Worker picked up job:', job.id);
    const { code, language, testCases } = job.data;

    if (!testCases || testCases.length === 0) {
      const result = await runCodeViaPiston(code, language || 'javascript');
      return { mode: 'raw', ...result };
    }

    const results = [];
    for (const tc of testCases) {
      const result = await runCodeViaPiston(code, language || 'javascript', tc.input);
      const actual = (result.output || '').trim();
      const expected = tc.expectedOutput.trim();
      results.push({
        passed: result.success && actual === expected,
        // Masked here at computation time — belt-and-suspenders alongside
        // sanitizeResultForRole, which masks again at send time in index.js.
        input: tc.isHidden ? null : tc.input,
        expectedOutput: tc.isHidden ? null : expected,
        actualOutput: tc.isHidden ? null : (result.success ? actual : result.output),
        isHidden: tc.isHidden,
      });
    }

    return {
      mode: 'testcases',
      results,
      passedCount: results.filter((r) => r.passed).length,
      totalCount: results.length,
    };
  },
  { connection }
);

console.log('🔧 BullMQ worker is listening for jobs on the code-execution queue');

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.log(`❌ Job ${job.id} failed:`, err.message);
});