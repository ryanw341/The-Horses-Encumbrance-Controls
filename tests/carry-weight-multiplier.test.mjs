/**
 * Regression test for the Carry Weight Multiplier not affecting the displayed
 * total carry weight (encumbrance.max) on character sheets.
 *
 * Previously the module only used the multiplier for its internal tier
 * thresholds and never overrode the D&D5e system's `encumbrance.max`, so
 * changing the setting had no visible effect on a player's carry capacity.
 *
 * This test confirms that setEncumbranceValues() now applies the supplied
 * carrying capacity to `max` (plus derived pct/thresholds/stops), and that
 * patchSystemEncumbrance() reasserts it on every render regardless of whether
 * the system value is valid.
 *
 * Run with: node tests/carry-weight-multiplier.test.mjs
 */

import assert from 'node:assert';

const MULTIPLIER = 20;
const STRENGTH = 14;

globalThis.game = {
  settings: {
    get(_moduleId, key) {
      if (key === 'carryWeightMultiplier') return MULTIPLIER;
      if (key === 'currencyPerWeight') return 50;
      return undefined;
    }
  }
};

const { EncumbranceManager } = await import('../scripts/encumbrance.js');
const manager = new EncumbranceManager();

// getSystemEncumbranceSettings reads world settings that aren't mocked; stub it.
manager.getSystemEncumbranceSettings = () => ({ tracking: 'enabled', trackCurrency: true });

const expectedMax = STRENGTH * MULTIPLIER; // 280

// 1. setEncumbranceValues applies the override to max and derived fields.
const enc = {
  value: 0,
  max: 210, // stale system default (Str * 15)
  pct: 0,
  thresholds: { encumbered: 0, heavilyEncumbered: 0, maximum: 0 },
  stops: { encumbered: 0, heavilyEncumbered: 0 },
  encumbered: false
};
manager.setEncumbranceValues(enc, 140, expectedMax);
assert.strictEqual(enc.max, expectedMax, 'max should reflect Strength * multiplier');
assert.strictEqual(enc.value, 140, 'value should be the supplied weight');
assert.strictEqual(enc.pct, 50, 'pct should be value/max as a percentage');
assert.strictEqual(enc.thresholds.maximum, expectedMax, 'threshold maximum should equal max');
assert.ok(Math.abs(enc.thresholds.encumbered - expectedMax / 3) < 1e-9, 'tier1 threshold is 1/3 of max');
assert.ok(Math.abs(enc.thresholds.heavilyEncumbered - (expectedMax * 2) / 3) < 1e-9, 'tier2 threshold is 2/3 of max');

// 2. Without an override, max is left untouched (backward compatible).
const enc2 = { value: 0, max: 99, pct: 0 };
manager.setEncumbranceValues(enc2, 50);
assert.strictEqual(enc2.max, 99, 'max should be unchanged when no override supplied');

// 3. patchSystemEncumbrance reasserts max even when the system value is valid.
const actor = {
  type: 'character',
  system: {
    abilities: { str: { value: STRENGTH } },
    currency: {},
    attributes: { encumbrance: { value: 100, max: 210, pct: 0 } }
  },
  items: []
};
manager.patchSystemEncumbrance(actor);
assert.strictEqual(actor.system.attributes.encumbrance.max, expectedMax,
  'render patch should override max with the module carrying capacity');
assert.strictEqual(actor.system.attributes.encumbrance.value, 100,
  'render patch should preserve a valid system weight value');

console.log('PASS: Carry Weight Multiplier drives encumbrance.max on the sheet');
