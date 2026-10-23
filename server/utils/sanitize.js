function sanitizeProblemForRole(problem, role) {
  if (!problem) return problem;
  if (role === 'interviewer') return problem;

  const sanitized = problem.toObject ? problem.toObject() : { ...problem };
  sanitized.testCases = (sanitized.testCases || []).map((tc) =>
    tc.isHidden
      ? { input: tc.input, isHidden: true }
      : tc
  );
  return sanitized;
}

function sanitizeResultForRole(result, role) {
  if (!result) return result;
  if (role === 'interviewer') return result;

  // 'raw' mode has no test cases to mask — pass through unchanged.
  if (result.mode !== 'testcases' || !Array.isArray(result.results)) {
    return result;
  }

  const sanitizedResults = result.results.map((r) =>
    r.isHidden
      ? { passed: r.passed, isHidden: true, input: null, expectedOutput: null, actualOutput: null }
      : r
  );

  return { ...result, results: sanitizedResults };
}

module.exports = { sanitizeProblemForRole, sanitizeResultForRole };