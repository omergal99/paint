import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getReviewGate,
  summarizeUsageRecords,
  validateUsageRecords,
} from '../scripts/skill-usage-audit.mjs';

test('summarizes recorded use without treating unlisted skills as unused', () => {
  const summary = summarizeUsageRecords([
    {
      session_id: 'session-one',
      date: '2026-11-20',
      skills: [
        { id: 'agent-workflow', status: 'used', rating: 4, evidence: 'Bounded the task.' },
        { id: 'work3-delivery', status: 'not-used', reason: 'Reviewed but not applied.' },
      ],
    },
    {
      session_id: 'session-two',
      date: '2026-11-21',
      skills: [{ id: 'agent-workflow', status: 'used', rating: 2, evidence: 'Needed a project-specific note.' }],
    },
  ]);

  assert.equal(summary.sessionCount, 2);
  assert.equal(summary.reviewGate, 'collecting');
  assert.deepEqual(summary.skills[0], {
    id: 'agent-workflow',
    uses: 2,
    ratingTotal: 6,
    ratings: 2,
    notUsed: 0,
    notApplicable: 0,
    averageRating: 3,
  });
  assert.equal(summary.skills[1].notUsed, 1);
});

test('offers review at the 20- and 50-session gates', () => {
  assert.equal(getReviewGate(19), 'collecting');
  assert.equal(getReviewGate(20), 'selective-review');
  assert.equal(getReviewGate(49), 'selective-review');
  assert.equal(getReviewGate(50), 'full-review');
});

test('rejects duplicate sessions and malformed use ratings', () => {
  const valid = {
    session_id: 'session-one',
    date: '2026-11-21',
    skills: [{ id: 'maintenance', status: 'used', rating: 4, evidence: 'Recorded the session.' }],
  };
  assert.throws(() => validateUsageRecords([valid, valid]), /duplicate session_id/);
  assert.throws(() => validateUsageRecords([{
    ...valid,
    skills: [{ ...valid.skills[0], rating: 6 }],
  }]), /rating from 1 to 5/);
  assert.throws(() => validateUsageRecords([{
    ...valid,
    date: '2026-02-31',
  }]), /valid YYYY-MM-DD/);
  assert.throws(() => validateUsageRecords([{
    ...valid,
    skills: [{
      ...valid.skills[0],
      source_check: { url: 'http://example.test', date: '2026-11-21' },
    }],
  }]), /HTTPS URL/);
});
