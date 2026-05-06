import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreTier, parseTuition } from '../src/jobs/tier-verification.js';

describe('parseTuition', () => {
  it('extracts numbers from common tuition strings', () => {
    assert.equal(parseTuition('$72,500/yr'), 72500);
    assert.equal(parseTuition('Tuition: USD 45000'), 45000);
    assert.equal(parseTuition('$8,500 (financial aid)'), 8500);
  });
  it('returns undefined for nonsense', () => {
    assert.equal(parseTuition(null), undefined);
    assert.equal(parseTuition('contact us'), undefined);
  });
});

describe('scoreTier', () => {
  it('an elite boarding school over 60k breaches threshold', () => {
    const s = scoreTier({
      tuition_usd: 72_000,
      nais_member: true,
      tabs_member: true,
      boarding_offered: true,
      top5_matriculation: true,
    });
    assert.ok(s >= 70, `expected >=70, got ${s}`);
  });
  it('a public school scores low', () => {
    const s = scoreTier({ tuition_usd: 0 });
    assert.equal(s, 0);
  });
  it('a 40-50k day school without NAIS lands borderline', () => {
    const s = scoreTier({ tuition_usd: 45_000 });
    assert.equal(s, 35);
  });
  it('respects custom weights overriding defaults', () => {
    const s = scoreTier({ tuition_usd: 50_000 }, { tuition_40k: 100 });
    assert.equal(s, 100);
  });
});
