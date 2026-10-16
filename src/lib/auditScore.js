// Audit scores are saved to two decimals (e.g. 92.86) rather than rounded
// to a whole percent.
export function roundScore(percent) {
  return Math.round(percent * 100) / 100;
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
