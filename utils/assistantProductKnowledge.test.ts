import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_PRODUCT_KNOWLEDGE,
  ASSISTANT_PRODUCT_KNOWLEDGE_VERSION
} from './assistantProductKnowledge';

describe('assistant product knowledge', () => {
  it('documents the current payment and immutable receipt workflow', () => {
    expect(ASSISTANT_PRODUCT_KNOWLEDGE_VERSION).toBe('2026-07-05');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Every payment requires one supported payment type');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('submission key');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('immutable receipt snapshot');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('treatment and medicine lines');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('today in the clinic');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('80 mm thermal');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Payment corrections are admin-only');
  });

  it('documents per-visit fees and the removal of appointment target teeth', () => {
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('not charged during patient registration');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('new-patient and returning-patient');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Appointments no longer collect target teeth');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Only skip or waive the fee when the user explicitly requests it');
  });

  it('documents current appointment, patient list, and audit workflows', () => {
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Scheduled first, Completed second, Cancelled last');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('New Patient/lead appointments should keep guest fields');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Recalls & Cancels is read-only reporting');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Created Date');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('Last Visit');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('deleting a patient is blocked by related records');
    expect(ASSISTANT_PRODUCT_KNOWLEDGE).toContain('payment correction access is limited to admins');
  });
});
