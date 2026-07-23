export class EncumbranceManager {
  constructor() {
    this.MODULE_ID = 'the-horses-encumbrance-controls';
    this.EFFECT_NAMES = {
      tier1: 'Encumbered',
      tier2: 'Heavily Encumbered',
      tier3: 'Exceeding Carrying Capacity'
    };
    // Known disabled encumbrance values from historical D&D5e settings; used as a fallback
    this.DISABLED_ENCUMBRANCE_VALUES = new Set(['disabled', 'none', 'off', 'false', '0']);
    this.warnedMissingEncumbranceSetting = false;
    this.warnedMissingCurrencySetting = false;
    
    // Final timeout delay (ms) for overriding late system encumbrance recalculations
    // This delay must be long enough to occur after D&D5e system's async recalculations
    // which happen in microtasks, animation frames, and short timeouts
    this.FINAL_REASSERT_DELAY_MS = 100;
    
    // Track pending reassert operations for cleanup
    this.pendingReasserts = new Map();
  }
  
  /**
   * Update the D&D5e currency weight configuration to honor the module setting
   */
  applyCurrencyWeightConfig() {
    try {
      const currencyPerWeight = this.getNumeric(game.settings.get(this.MODULE_ID, 'currencyPerWeight'), 50);
      if (CONFIG?.DND5E?.encumbrance) {
        // A value of 0 (or less) means currency is completely weightless. Since
        // the system divides coin count by this value, use Infinity so coins add
        // no weight; otherwise clamp to a minimum of 1 to avoid divide-by-zero.
        CONFIG.DND5E.encumbrance.currencyPerWeight = currencyPerWeight <= 0 ? Infinity : currencyPerWeight;
      }
    } catch (err) {
      console.warn(`${this.MODULE_ID} | Unable to apply currency weight configuration.`, err);
    }
  }
  
  /**
   * Sanitize item weight and quantity to prevent NaN propagation
   * @param {Item} item - The item to sanitize
   * @returns {boolean} - True if the item was modified
   */
  async sanitizeItemData(item) {
    if (!item?.system) {
      return false;
    }
    
    let needsUpdate = false;
    const updates = {};
    
    // Sanitize weight - handle both simple numbers and object with value property
    const weight = item.system.weight;
    const weightValue = this.getNumeric(weight, 0);
    
    // Check if weight needs sanitization by comparing sanitized value to original
    if (typeof weight === 'object' && weight !== null) {
      // If it's an object with value property, check if value differs from sanitized
      const originalValue = weight.value;
      if (originalValue !== weightValue && !Number.isFinite(Number(originalValue))) {
        updates['system.weight.value'] = weightValue;
        needsUpdate = true;
      }
    } else {
      // If it's a simple value, check if it differs from sanitized
      if (weight !== weightValue && !Number.isFinite(Number(weight))) {
        updates['system.weight'] = weightValue;
        needsUpdate = true;
      }
    }
    
    // Sanitize quantity - compare sanitized value to original
    const quantity = item.system.quantity;
    const quantityValue = this.getNumeric(quantity, 1);
    if (quantity !== quantityValue && !Number.isFinite(Number(quantity))) {
      updates['system.quantity'] = quantityValue;
      needsUpdate = true;
    }
    
    // Apply updates if needed
    if (needsUpdate) {
      try {
        await item.update(updates);
        return true;
      } catch (err) {
        console.warn(`${this.MODULE_ID} | Failed to sanitize item ${item.name}:`, err);
        return false;
      }
    }
    
    return false;
  }
  
  /**
   * Sanitize all items for a given actor to prevent NaN propagation
   * @param {Actor} actor - The actor whose items should be sanitized
   */
  async sanitizeActorItems(actor) {
    if (!actor?.items || actor.type !== 'character') {
      return;
    }
    
    let sanitizedCount = 0;
    for (const item of actor.items) {
      const wasSanitized = await this.sanitizeItemData(item);
      if (wasSanitized) {
        sanitizedCount++;
      }
    }
    
    if (sanitizedCount > 0) {
      console.log(`${this.MODULE_ID} | Sanitized ${sanitizedCount} items for actor ${actor.name}`);
    }
  }
  
  /**
   * Sanitize actor currency data to prevent NaN propagation
   * @param {Actor} actor - The actor whose currency should be sanitized
   * @param {Object} currencyData - The currency data from the update
   */
  async sanitizeActorCurrency(actor, currencyData) {
    if (!actor?.system?.currency || actor.type !== 'character') {
      return;
    }
    
    let needsUpdate = false;
    const updates = {};
    
    // Check each currency key in the update data
    for (const key of Object.keys(currencyData)) {
      const value = currencyData[key];
      const sanitizedValue = this.getNumeric(value, 0);
      
      // Only update if the value differs from sanitized and is not finite
      if (value !== sanitizedValue && !Number.isFinite(Number(value))) {
        updates[`system.currency.${key}`] = sanitizedValue;
        needsUpdate = true;
      }
    }
    
    // Apply updates if needed
    if (needsUpdate) {
      try {
        await actor.update(updates);
        console.log(`${this.MODULE_ID} | Sanitized currency for actor ${actor.name}`);
      } catch (err) {
        console.warn(`${this.MODULE_ID} | Failed to sanitize currency for actor ${actor.name}:`, err);
      }
    }
  }
  
  /**
   * Perform a one-time sanitization pass on all character actors
   * Called once on the 'ready' hook
   */
  async performInitialSanitization() {
    if (!game.user.isGM) {
      return; // Only GM should perform this operation
    }
    
    console.log(`${this.MODULE_ID} | Performing initial sanitization pass...`);
    let actorCount = 0;
    
    for (const actor of game.actors) {
      if (actor.type === 'character') {
        await this.sanitizeActorItems(actor);
        actorCount++;
      }
    }
    
    console.log(`${this.MODULE_ID} | Initial sanitization complete. Processed ${actorCount} character(s).`);
  }
  
  /**
   * Safely coerce values (including embedded objects with a `value` property, as used by D&D5e system data) to numbers
   */
  getNumeric(value, defaultValue = 0) {
    const numericValue = Number(typeof value === 'object' ? value?.value : value);
    return Number.isFinite(numericValue) ? numericValue : defaultValue;
  }
  
  /**
   * Read D&D5e system settings that influence encumbrance
   */
  getSystemEncumbranceSettings() {
    let tracking;
    let trackCurrency = true;
    
    try {
      tracking = game.settings.get('dnd5e', 'encumbrance');
    } catch (err) {
      if (!this.warnedMissingEncumbranceSetting) {
        console.warn(`${this.MODULE_ID} | Unable to read dnd5e encumbrance setting; assuming enabled.`, err);
        this.warnedMissingEncumbranceSetting = true;
      }
      tracking = undefined;
    }
    
    try {
      trackCurrency = game.settings.get('dnd5e', 'currencyWeight');
    } catch (err) {
      if (!this.warnedMissingCurrencySetting) {
        console.warn(`${this.MODULE_ID} | Unable to read dnd5e currencyWeight setting; assuming currency counts toward weight.`, err);
        this.warnedMissingCurrencySetting = true;
      }
      trackCurrency = true;
    }
    
    return { tracking, trackCurrency };
  }
  
  /**
   * Collect possible encumbrance setting values that represent "disabled"
   */
  getDisabledEncumbranceValues(encumbranceSetting) {
    const knownDisabledValues = Array.from(this.DISABLED_ENCUMBRANCE_VALUES);
    
    if (encumbranceSetting?.choices) {
      return Object.keys(encumbranceSetting.choices).filter(key => knownDisabledValues.includes(String(key).toLowerCase()));
    }
    
    return knownDisabledValues;
  }
  
  /**
   * Determine whether the system encumbrance setting is disabled
   */
  isEncumbranceDisabled(tracking) {
    if (tracking === null || tracking === undefined) {
      return false;
    }
    
    // Access the settings registry to inspect available choice keys
    let encumbranceSetting;
    try {
      encumbranceSetting = game.settings.settings.get('dnd5e.encumbrance');
    } catch (err) {
      encumbranceSetting = undefined;
    }
    
    if (typeof tracking !== 'string' && typeof tracking !== 'number' && typeof tracking !== 'boolean') {
      return false;
    }
    
    const normalizedTracking = typeof tracking === 'string' ? tracking.toLowerCase() : String(tracking);
    const disabledValues = this.getDisabledEncumbranceValues(encumbranceSetting);
    
    if (disabledValues.includes(normalizedTracking)) {
      return true;
    }
    
    return this.DISABLED_ENCUMBRANCE_VALUES.has(normalizedTracking);
  }
  
  /**
   * Get the total carrying capacity (Strength × carry weight multiplier)
   */
  getCarryingCapacity(actor) {
    const strength = actor.system?.abilities?.str?.value || 10;
    const multiplier = this.getNumeric(game.settings.get(this.MODULE_ID, 'carryWeightMultiplier'), 15);
    return strength * multiplier;
  }
  
  /**
   * Get the encumbrance tier thresholds as fractions of total carrying capacity
   * Tier 1 = 1/3, Tier 2 = 2/3, Tier 3 = full carrying capacity
   */
  getTierThresholds(actor) {
    const carryingCapacity = this.getCarryingCapacity(actor);
    return {
      tier1: carryingCapacity * (1 / 3),
      tier2: carryingCapacity * (2 / 3),
      tier3: carryingCapacity
    };
  }
  
  /**
   * Calculate total weight including currency, always computing manually
   */
  calculateTotalWeight(actor, { trackCurrencyWeight = true } = {}) {
    // Always compute weight manually to avoid NaN from system value
    let itemWeight = 0;
    actor.items.forEach(item => {
      const weight = this.getNumeric(item.system?.weight, 0);     // blank/undefined -> 0
      const quantity = this.getNumeric(item.system?.quantity, 1); // blank/undefined -> 1
      itemWeight += weight * quantity;
    });

    let currencyWeight = 0;
    if (trackCurrencyWeight) {
      currencyWeight = this.calculateCurrencyWeight(actor);
    }

    return itemWeight + currencyWeight;
  }
  
  /**
   * Calculate only the currency weight using the configured coins-per-weight ratio
   * Sums all present currency keys to support renamed/disabled currencies
   */
  calculateCurrencyWeight(actor) {
    const currencyPerWeight = this.getNumeric(game.settings.get(this.MODULE_ID, 'currencyPerWeight'), 50);
    // A value of 0 (or less) means currency is completely weightless.
    if (currencyPerWeight <= 0) {
      return 0;
    }
    const currency = actor.system?.currency || {};
    
    // Sum all present currency keys, not just the standard five
    // This supports renamed/disabled currencies and prevents NaN
    // Use Object.keys to only iterate own properties (avoid prototype pollution)
    let totalCoins = 0;
    for (const key of Object.keys(currency)) {
      totalCoins += this.getNumeric(currency[key], 0);
    }
    
    return totalCoins / currencyPerWeight;
  }
  
  /**
   * Determine which encumbrance tier the actor is in
   */
  getEncumbranceTier(actor, { trackCurrencyWeight = true } = {}) {
    const totalWeight = this.calculateTotalWeight(actor, { trackCurrencyWeight });
    const thresholds = this.getTierThresholds(actor);
    
    if (totalWeight > thresholds.tier3) {
      return 3;
    } else if (totalWeight > thresholds.tier2) {
      return 2;
    } else if (totalWeight > thresholds.tier1) {
      return 1;
    } else {
      return 0;
    }
  }
  
  /**
   * Create an encumbrance effect for the given tier
   * @param {Number} tier - The encumbrance tier
   * @param {Actor} actor - The actor the effect will be applied to (used for origin)
   */
  createEncumbranceEffect(tier, actor) {
    const effectName = this.EFFECT_NAMES[`tier${tier}`];
    const speedReduction = game.settings.get(this.MODULE_ID, `tier${tier}SpeedReduction`);
    const speedSetTo = game.settings.get(this.MODULE_ID, `tier${tier}SpeedSetTo`);
    
    // Build the changes array for the effect
    const changes = [];
    
    // Speed modifications
    const speedTypes = ['walk', 'fly', 'burrow', 'swim', 'climb'];
    speedTypes.forEach(speedType => {
      changes.push({
        key: `system.attributes.movement.${speedType}`,
        mode: speedSetTo ? 5 : 2, // 5 = OVERRIDE, 2 = ADD
        value: speedSetTo ? speedReduction : -speedReduction,
        priority: 20
      });
    });
    
    return {
      name: effectName,
      icon: 'icons/svg/anchor.svg',
      origin: actor?.uuid,
      disabled: false,
      duration: {},
      flags: {
        [this.MODULE_ID]: {
          isEncumbranceEffect: true,
          tier: tier
        }
      },
      changes: changes
    };
  }
  
  /**
   * Get all encumbrance effects on an actor
   */
  getEncumbranceEffects(actor) {
    return actor.effects.filter(e => 
      e.flags?.[this.MODULE_ID]?.isEncumbranceEffect === true
    );
  }
  
  /**
   * Remove all encumbrance effects from an actor
   */
  async removeEncumbranceEffects(actor) {
    const effects = this.getEncumbranceEffects(actor);
    const effectIds = effects.map(e => e.id);
    if (effectIds.length > 0) {
      await actor.deleteEmbeddedDocuments('ActiveEffect', effectIds);
    }
  }
  
  /**
   * Apply the appropriate encumbrance effect based on tier
   */
  async applyEncumbranceEffect(actor, tier) {
    const currentEffects = this.getEncumbranceEffects(actor);
    
    // Check if the correct effect is already applied
    const correctEffect = currentEffects.find(e => 
      e.flags?.[this.MODULE_ID]?.tier === tier
    );
    
    if (correctEffect && currentEffects.length === 1) {
      // Already has the correct effect, no change needed
      return;
    }
    
    // Remove all current encumbrance effects
    await this.removeEncumbranceEffects(actor);
    
    // Apply new effect if needed
    if (tier > 0) {
      const effect = this.createEncumbranceEffect(tier, actor);
      await actor.createEmbeddedDocuments('ActiveEffect', [effect]);
    }
  }
  
  /**
   * Set encumbrance value and percentage on the actor's encumbrance object
   * @param {Object} encumbrance - The actor's encumbrance object
   * @param {Number} totalWeight - The computed total weight
   * @param {Number} [maxOverride] - Optional carrying capacity to display as the
   *   total carry weight (max). When provided and valid, it overrides the
   *   system-computed max so the module's Carry Weight Multiplier is reflected
   *   on the character sheet.
   */
  setEncumbranceValues(encumbrance, totalWeight, maxOverride) {
    if (!encumbrance) {
      return;
    }
    
    // Ensure totalWeight is finite before assigning (defensive programming)
    const value = Number.isFinite(totalWeight) ? totalWeight : 0;
    encumbrance.value = value;
    
    // Override the displayed carrying capacity when a valid override is supplied.
    // This is what makes the Carry Weight Multiplier visible on the sheet.
    if (Number.isFinite(maxOverride) && maxOverride > 0) {
      encumbrance.max = maxOverride;
      
      // Keep the tier thresholds and progress-bar stops consistent with the
      // module's tiers (1/3, 2/3, full) when the system exposes them.
      if (encumbrance.thresholds && typeof encumbrance.thresholds === 'object') {
        encumbrance.thresholds.encumbered = maxOverride * (1 / 3);
        encumbrance.thresholds.heavilyEncumbered = maxOverride * (2 / 3);
        encumbrance.thresholds.maximum = maxOverride;
      }
      if (encumbrance.stops && typeof encumbrance.stops === 'object') {
        encumbrance.stops.encumbered = Math.round((1 / 3) * 100);
        encumbrance.stops.heavilyEncumbered = Math.round((2 / 3) * 100);
      }
      encumbrance.encumbered = value > maxOverride * (1 / 3);
    }
    
    // Also update pct when max is available and finite
    const max = this.getNumeric(encumbrance.max, 0);
    if (Number.isFinite(max) && max > 0 && Number.isFinite(value)) {
      encumbrance.pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
    }
  }

  /**
   * Set encumbrance values with multiple delayed reasserts to override system recalculations
   * The D&D5e system recalculates encumbrance asynchronously after effects are applied,
   * which can overwrite our computed values with NaN. We schedule multiple reasserts
   * at different phases (microtask, animation frame, timeouts) to ensure our value persists.
   * @param {Actor} actor - The actor whose encumbrance is being updated
   * @param {Object} encumbrance - The actor's encumbrance object
   * @param {Number} totalWeight - The computed total weight
   */
  setEncumbranceValuesWithDelayedReasserts(actor, encumbrance, totalWeight, maxOverride) {
    if (!encumbrance || !actor) {
      return;
    }
    
    // Cancel any pending reasserts for this actor to avoid redundant operations
    const actorId = actor.id;
    if (this.pendingReasserts.has(actorId)) {
      const pending = this.pendingReasserts.get(actorId);
      // Mark as cancelled so callbacks can check
      pending.cancelled = true;
      if (pending.animationFrameId) {
        cancelAnimationFrame(pending.animationFrameId);
      }
      if (pending.shortTimeoutId) {
        clearTimeout(pending.shortTimeoutId);
      }
      if (pending.finalTimeoutId) {
        clearTimeout(pending.finalTimeoutId);
      }
      // Remove the stale entry
      this.pendingReasserts.delete(actorId);
    }
    
    // Helper function to get a fresh encumbrance reference
    const getFreshEncumbrance = () => {
      const freshActor = game.actors.get(actorId);
      return freshActor?.system?.attributes?.encumbrance;
    };
    
    // Set immediately
    this.setEncumbranceValues(encumbrance, totalWeight, maxOverride);
    
    // Store references to pending operations
    const pending = { cancelled: false };
    this.pendingReasserts.set(actorId, pending);
    
    // Microtask - runs after current synchronous code, before next event loop
    // Note: microtasks cannot be cancelled, so we check the cancelled flag
    if (typeof queueMicrotask !== 'undefined') {
      queueMicrotask(() => {
        if (!pending.cancelled) {
          const freshEncumbrance = getFreshEncumbrance();
          if (freshEncumbrance) {
            this.setEncumbranceValues(freshEncumbrance, totalWeight, maxOverride);
          }
        }
      });
    }
    
    // Animation frame - runs before next repaint
    if (typeof requestAnimationFrame !== 'undefined') {
      pending.animationFrameId = requestAnimationFrame(() => {
        if (!pending.cancelled) {
          const freshEncumbrance = getFreshEncumbrance();
          if (freshEncumbrance) {
            this.setEncumbranceValues(freshEncumbrance, totalWeight, maxOverride);
          }
        }
      });
    }
    
    // Short timeout - runs in next event loop tick
    pending.shortTimeoutId = setTimeout(() => {
      if (!pending.cancelled) {
        const freshEncumbrance = getFreshEncumbrance();
        if (freshEncumbrance) {
          this.setEncumbranceValues(freshEncumbrance, totalWeight, maxOverride);
        }
      }
    }, 0);
    
    // Longer timeout - final insurance against late system recalculations
    pending.finalTimeoutId = setTimeout(() => {
      if (!pending.cancelled) {
        const freshEncumbrance = getFreshEncumbrance();
        if (freshEncumbrance) {
          this.setEncumbranceValues(freshEncumbrance, totalWeight, maxOverride);
        }
      }
      // Always clean up the Map entry, even if cancelled
      this.pendingReasserts.delete(actorId);
    }, this.FINAL_REASSERT_DELAY_MS);
  }

  /**
   * Patch the system encumbrance values in-memory on every sheet render.
   *
   * The D&D5e system recomputes `encumbrance.max` from its own configuration
   * during derived-data preparation, so we must reassert the module's carrying
   * capacity (Strength × Carry Weight Multiplier) here for it to appear on the
   * sheet. We also recompute the displayed weight when the system value is NaN.
   */
  patchSystemEncumbrance(actor) {
    const encumbrance = actor.system?.attributes?.encumbrance;
    if (!encumbrance) {
      return;
    }

    const { trackCurrency } = this.getSystemEncumbranceSettings();
    const carryingCapacity = this.getCarryingCapacity(actor);

    // Determine the weight to display. Keep the system value when it is a valid
    // finite number; otherwise fall back to a manual computation to avoid NaN.
    const systemValue = encumbrance.value;
    const systemValueIsValid = systemValue !== undefined && systemValue !== null && Number.isFinite(Number(systemValue));
    const weight = systemValueIsValid
      ? Number(systemValue)
      : this.calculateTotalWeight(actor, { trackCurrencyWeight: trackCurrency });

    // Always reassert the carrying capacity so the Carry Weight Multiplier is
    // reflected as the total carry weight on the sheet.
    this.setEncumbranceValues(encumbrance, weight, carryingCapacity);
  }

  /**
   * Check and update encumbrance for an actor
   */
  async checkEncumbrance(actor) {
    // Only process character actors
    if (actor.type !== 'character') {
      return;
    }
    
    const { tracking, trackCurrency } = this.getSystemEncumbranceSettings();
    
    // Always compute and set the system encumbrance value to eliminate transient NaN
    const totalWeight = this.calculateTotalWeight(actor, { trackCurrencyWeight: trackCurrency });
    const carryingCapacity = this.getCarryingCapacity(actor);
    const encumbrance = actor.system?.attributes?.encumbrance;
    
    // Set encumbrance values before applying effects
    this.setEncumbranceValues(encumbrance, totalWeight, carryingCapacity);
    
    // If the system setting cannot be read, fall back to module behavior
    const shouldSkipEncumbrance = tracking === undefined ? false : this.isEncumbranceDisabled(tracking);
    
    if (shouldSkipEncumbrance) {
      await this.removeEncumbranceEffects(actor);
      // Use delayed reasserts to override late system NaN
      this.setEncumbranceValuesWithDelayedReasserts(actor, encumbrance, totalWeight, carryingCapacity);
      return;
    }
    
    const effectsEnabled = game.settings.get(this.MODULE_ID, 'enableEffects');
    
    if (!effectsEnabled) {
      // Remove any existing encumbrance effects if effects are disabled
      await this.removeEncumbranceEffects(actor);
      // Use delayed reasserts to override late system NaN
      this.setEncumbranceValuesWithDelayedReasserts(actor, encumbrance, totalWeight, carryingCapacity);
      return;
    }
    
    // Get the current encumbrance tier
    const tier = this.getEncumbranceTier(actor, { trackCurrencyWeight: trackCurrency });
    
    // Apply the appropriate effect
    await this.applyEncumbranceEffect(actor, tier);
    
    // Reassert encumbrance value and pct after applying effects
    // This prevents the D&D5e system from overwriting with NaN during tier transitions
    // Use multiple delayed reasserts to ensure our value persists through all system recalculations
    this.setEncumbranceValuesWithDelayedReasserts(actor, encumbrance, totalWeight, carryingCapacity);
  }
}
