import { describe, expect, test } from 'bun:test';
import { startHydraCtrl } from './hydra';

describe('hydra controller', () => {
  test('should initialize without errors', () => {
    expect(() => startHydraCtrl()).not.toThrow();
  });
});
