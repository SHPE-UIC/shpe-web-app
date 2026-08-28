import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_TAG, tagForColorId } from './config/eventTags.js';

describe('tagForColorId', () => {
  it('maps Blueberry (9) to GBM worth 3 points', () => {
    assert.deepEqual(tagForColorId(9), { tag: 'GBM', points: 3 });
  });

  it('maps Graphite (8) to Other worth 0 points', () => {
    assert.deepEqual(tagForColorId(8), { tag: 'Other', points: 0 });
  });

  it('maps both Volunteer colors identically', () => {
    assert.deepEqual(tagForColorId(2), tagForColorId(10));
  });

  it('falls back to the default tag when no color is set', () => {
    assert.deepEqual(tagForColorId(undefined), DEFAULT_TAG);
  });

  it('falls back to the default tag for an unknown color id', () => {
    assert.deepEqual(tagForColorId(99), DEFAULT_TAG);
  });
});
