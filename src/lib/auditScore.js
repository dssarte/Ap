// Audit scores are saved to two decimals (e.g. 92.86) rather than rounded
// to a whole percent.
export function roundScore(percent) {
  return Math.round(percent * 100) / 100;
}

// Pass mark for a checklist that doesn't set its own (QA checklists set 92.5%).
export const DEFAULT_PASS_THRESHOLD = 75;

// A pass mark of 0 means the checklist isn't graded PASS/FAIL at all (e.g. the
// Mayon Daily Walkthrough) — its result shows N/A; its score still shows.
export function isPassFailGraded(template) {
  const threshold = template?.pass_threshold;
  return threshold == null || threshold === '' || Number(threshold) !== 0;
}

// 'PASS', 'FAIL', or 'N/A' (not graded) for one submission's score.
export function auditResult(score, template) {
  if (!isPassFailGraded(template)) return 'N/A';
  if (score == null || score === '') return null;
  return Number(score) >= Number(template?.pass_threshold ?? DEFAULT_PASS_THRESHOLD) ? 'PASS' : 'FAIL';
}

// The score to show for a submission. A draft is worked out again from its
// YES/NO point totals — one saved before scores kept decimals holds a
// rounded value, and a draft is still in progress anyway. Finalized
// submissions show the score they were submitted with.
export function submissionScore(submission) {
  if (submission?.is_draft) {
    const yes = Number(submission.yes_count) || 0;
    const no = Number(submission.no_count) || 0;
    if (yes + no > 0) return roundScore((yes / (yes + no)) * 100);
  }
  return submission?.score;
}

// "92.86%", "92.5%", "100%" — decimals only when there are any.
export function formatScore(score) {
  if (score == null || score === '') return '';
  const value = Number(score);
  return Number.isFinite(value) ? `${roundScore(value)}%` : '';
}

// YES / NO / N/A as numbers of checklist items. The stored yes_count,
// no_count and na_count are point totals on point-based checklists (one item
// can be worth 5), which is what the score needs — but "3 NCF" has to mean
// three non-conforming items, not 3 points. Rows listed without their
// answers fall back to the stored totals.
export function answerCounts(submission) {
  const answers = submission?.answers;
  if (!answers || typeof answers !== 'object') {
    return {
      yes: submission?.yes_count ?? 0,
      no: submission?.no_count ?? 0,
      na: submission?.na_count ?? 0,
    };
  }
  const counts = { yes: 0, no: 0, na: 0 };
  for (const answer of Object.values(answers)) {
    if (answer === 'YES') counts.yes += 1;
    else if (answer === 'NO') counts.no += 1;
    else if (answer === 'NA') counts.na += 1;
  }
  return counts;
}
