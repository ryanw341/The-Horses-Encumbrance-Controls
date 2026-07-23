/**
 * Regression test for the ActiveEffect origin bug.
 *
 * Previously createEncumbranceEffect() set `origin: "Actor.<MODULE_ID>"`, which
 * is not a valid document UUID. With Midi-QOL active the effect schema validates
 * `origin` as a DocumentUUIDField, so creation failed with:
 *   "[MidiActiveEffect] validation errors ... origin: must contain a valid document ID"
 *
 * This test confirms the effect now uses the target actor's real UUID and that
 * the value parses as a valid document UUID (mirroring foundry.utils.parseUuid /
 * DocumentUUIDField validation), while identifying metadata stays under
 * flags[MODULE_ID].
 *
 * Run with: node tests/encumbrance-effect-origin.test.mjs
 */

import assert from 'node:assert';

// --- Minimal Foundry environment mocks ---------------------------------------

// A valid embedded/world document ID is 16 alphanumeric characters.
const VALID_ID = 'abcd1234EFGH5678';

globalThis.game = {
  settings: {
    // createEncumbranceEffect reads tierNSpeedReduction / tierNSpeedSetTo.
    get(_moduleId, key) {
      if (key.endsWith('SpeedSetTo')) return false;
      if (key.endsWith('SpeedReduction')) return 10;
      return undefined;
    }
  }
};

// Reproduce the validation performed by foundry.utils.parseUuid /
// DocumentUUIDField: a top-level document UUID looks like "Actor.<16charId>".
function parseUuid(uuid) {
  const parts = String(uuid ?? '').split('.');
  if (parts.length < 2) throw new Error('Invalid UUID: missing document ID');
  const [documentType, documentId] = parts;
  if (!documentType) throw new Error('Invalid UUID: missing document type');
  if (!/^[a-zA-Z0-9]{16}$/.test(documentId)) {
    throw new Error('Invalid UUID: must contain a valid document ID');
  }
  return { documentType, documentId };
}

const { EncumbranceManager } = await import('../scripts/encumbrance.js');

const manager = new EncumbranceManager();

// A stand-in actor exposing a real, valid UUID.
const actor = { uuid: `Actor.${VALID_ID}` };

const effect = manager.createEncumbranceEffect(1, actor);

// 1. origin is the actor's real UUID, not built from MODULE_ID.
assert.strictEqual(effect.origin, actor.uuid, 'origin should equal actor.uuid');
assert.ok(
  !effect.origin.includes(manager.MODULE_ID),
  'origin must not be hand-built from MODULE_ID'
);

// 2. origin passes document-UUID validation.
assert.doesNotThrow(() => parseUuid(effect.origin), 'origin must be a valid document UUID');

// 3. Identifying metadata lives under flags[MODULE_ID], used for detection/cleanup.
assert.strictEqual(effect.flags?.[manager.MODULE_ID]?.isEncumbranceEffect, true);
assert.strictEqual(effect.flags?.[manager.MODULE_ID]?.tier, 1);

// 4. Detection logic finds the effect via its flag (as getEncumbranceEffects does).
const fakeActor = { effects: [effect] };
const found = manager.getEncumbranceEffects(fakeActor);
assert.strictEqual(found.length, 1, 'effect should be detected via its flag');

console.log('PASS: encumbrance effect origin is a valid document UUID and metadata stays in flags');
