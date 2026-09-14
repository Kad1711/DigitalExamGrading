/**
 * Pure scoring calculation utilities to ensure consistent scoring semantics
 * across grading, manual reviews, and regrading.
 */

/**
 * Calculates score under EQUAL scoring type: (correctCount / questionCount) * maxScore rounded to 4 decimals.
 */
export function calculateEqualScore(correctCount, questionCount, maxScore) {
  if (!questionCount || questionCount <= 0) return 0;
  const rawScore = (correctCount / questionCount) * maxScore;
  return Math.round(rawScore * 10000) / 10000;
}

/**
 * Computes overall score given scoring type and parameters.
 */
export function computeFinalScore({ scoringType, correctCount, questionCount, maxScore, customScoreDecimal }) {
  if (scoringType === "EQUAL") {
    return calculateEqualScore(correctCount, questionCount, maxScore);
  }
  if (scoringType === "CUSTOM") {
    if (!customScoreDecimal) return 0;
    if (typeof customScoreDecimal.toNumber === "function") {
      return customScoreDecimal.toNumber();
    }
    return Number(customScoreDecimal) || 0;
  }
  return 0;
}
