import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LeadStatus, EmailTemplateKind, PipelineStage } from '../src/schemas/enums.js';

describe('schema enums', () => {
  it('rejects unknown lead status', () => {
    assert.equal(LeadStatus.safeParse('not_a_status').success, false);
  });
  it('accepts the canonical email template kinds', () => {
    for (const k of [
      'invite',
      'reminder_24h',
      'offer_d0',
      'noshow',
      'reengage',
      'registration_confirmation',
      'payment_receipt',
      'resource_delivery',
    ]) {
      assert.equal(EmailTemplateKind.safeParse(k).success, true, `expected ${k} to parse`);
    }
  });
  it('lists all 12 pipeline stages used by workflows', () => {
    const arr = PipelineStage.options;
    assert.equal(arr.length, 12);
    assert.ok(arr.includes('school_discovery'));
    assert.ok(arr.includes('payment_received'));
  });
});
