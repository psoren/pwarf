import { describe, it, expect } from 'vitest';
import { MAX_TASK_FAILURES } from '@pwarf/shared';

// We can't easily unit-test failTask directly since it's not exported.
// Instead, test the behavior through the full task-execution phase.
// But we CAN test the constant is reasonable.
describe('MAX_TASK_FAILURES', () => {
  it('is a positive integer', () => {
    expect(MAX_TASK_FAILURES).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_TASK_FAILURES)).toBe(true);
  });
});
