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
      const currencyPerWeight = Math.max(this.getNumeric(game.settings.get(this.MODULE_ID, 'currencyPerWeight'), 50), 1);
      if (CONFIG?.DND5E?.encumbrance) {
        CONFIG.DND5E.encumbrance.currencyPerWeight = currencyPerWeight;
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
   * Get the encumbrance tier multipliers from settings
   */
  getTierMultipliers() {
    return {
      tier1: game.settings.get(this.MODULE_ID, 'tier1Multiplier'),
      tier2: game.settings.get(this.MODULE_ID, 'tier2Multiplier'),
      tier3: game.settings.get(this.MODULE_ID, 'tier3Multiplier')
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
    const currencyPerWeight = Math.max(this.getNumeric(game.settings.get(this.MODULE_ID, 'currencyPerWeight'), 50), 1);
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
    const strength = actor.system?.abilities?.str?.value || 10;
    const totalWeight = this.calculateTotalWeight(actor, { trackCurrencyWeight });
    const multipliers = this.getTierMultipliers();
    
    const tier1Threshold = strength * multipliers.tier1;
    const tier2Threshold = strength * multipliers.tier2;
    const tier3Threshold = strength * multipliers.tier3;
    
    if (totalWeight > tier3Threshold) {
      return 3;
    } else if (totalWeight > tier2Threshold) {
      return 2;
    } else if (totalWeight > tier1Threshold) {
      return 1;
    } else {
      return 0;
    }
  }
  
  /**
   * Create an encumbrance effect for the given tier
   */
  createEncumbranceEffect(tier) {
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
      origin: `Actor.${this.MODULE_ID}`,
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
      const effect = this.createEncumbranceEffect(tier);
      await actor.createEmbeddedDocuments('ActiveEffect', [effect]);
    }
  }
  
  /**
   * Set encumbrance value and percentage on the actor's encumbrance object
   * @param {Object} encumbrance - The actor's encumbrance object
   * @param {Number} totalWeight - The computed total weight
   */
  setEncumbranceValues(encumbrance, totalWeight) {
    if (!encumbrance) {
      return;
    }
    
    // Ensure totalWeight is finite before assigning (defensive programming)
    encumbrance.value = Number.isFinite(totalWeight) ? totalWeight : 0;
    
    // Also update pct when max is available and finite
    const max = this.getNumeric(encumbrance.max, 0);
    if (Number.isFinite(max) && max > 0 && Number.isFinite(totalWeight)) {
      encumbrance.pct = Math.round((totalWeight / max) * 100);
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
  setEncumbranceValuesWithDelayedReasserts(actor, encumbrance, totalWeight) {
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
    this.setEncumbranceValues(encumbrance, totalWeight);
    
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
            this.setEncumbranceValues(freshEncumbrance, totalWeight);
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
            this.setEncumbranceValues(freshEncumbrance, totalWeight);
          }
        }
      });
    }
    
    // Short timeout - runs in next event loop tick
    pending.shortTimeoutId = setTimeout(() => {
      if (!pending.cancelled) {
        const freshEncumbrance = getFreshEncumbrance();
        if (freshEncumbrance) {
          this.setEncumbranceValues(freshEncumbrance, totalWeight);
        }
      }
    }, 0);
    
    // Longer timeout - final insurance against late system recalculations
    pending.finalTimeoutId = setTimeout(() => {
      if (!pending.cancelled) {
        const freshEncumbrance = getFreshEncumbrance();
        if (freshEncumbrance) {
          this.setEncumbranceValues(freshEncumbrance, totalWeight);
        }
      }
      // Always clean up the Map entry, even if cancelled
      this.pendingReasserts.delete(actorId);
    }, this.FINAL_REASSERT_DELAY_MS);
  }

  /**
   * Patch the system encumbrance value in-memory if it's NaN
   * This ensures the character sheet displays a number instead of NaN
   */
  patchSystemEncumbrance(actor) {
    const encumbrance = actor.system?.attributes?.encumbrance;
    if (!encumbrance) {
      return;
    }

    // Check if the system value is NaN or not a finite number
    const systemValue = encumbrance.value;
    if (systemValue !== undefined && systemValue !== null && Number.isFinite(Number(systemValue))) {
      // System value is valid, no need to patch
      return;
    }
    
    // System value is NaN, undefined, null, or not finite - patch it
    const { trackCurrency } = this.getSystemEncumbranceSettings();
    const computedWeight = this.calculateTotalWeight(actor, { trackCurrencyWeight: trackCurrency });
    
    // Use the helper method to set values
    this.setEncumbranceValues(encumbrance, computedWeight);
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
    const encumbrance = actor.system?.attributes?.encumbrance;
    
    // Set encumbrance values before applying effects
    this.setEncumbranceValues(encumbrance, totalWeight);
    
    // If the system setting cannot be read, fall back to module behavior
    const shouldSkipEncumbrance = tracking === undefined ? false : this.isEncumbranceDisabled(tracking);
    
    if (shouldSkipEncumbrance) {
      await this.removeEncumbranceEffects(actor);
      // Use delayed reasserts to override late system NaN
      this.setEncumbranceValuesWithDelayedReasserts(actor, encumbrance, totalWeight);
      return;
    }
    
    const effectsEnabled = game.settings.get(this.MODULE_ID, 'enableEffects');
    
    if (!effectsEnabled) {
      // Remove any existing encumbrance effects if effects are disabled
      await this.removeEncumbranceEffects(actor);
      // Use delayed reasserts to override late system NaN
      this.setEncumbranceValuesWithDelayedReasserts(actor, encumbrance, totalWeight);
      return;
    }
    
    // Get the current encumbrance tier
    const tier = this.getEncumbranceTier(actor, { trackCurrencyWeight: trackCurrency });
    
    // Apply the appropriate effect
    await this.applyEncumbranceEffect(actor, tier);
    
    // Reassert encumbrance value and pct after applying effects
    // This prevents the D&D5e system from overwriting with NaN during tier transitions
    // Use multiple delayed reasserts to ensure our value persists through all system recalculations
    this.setEncumbranceValuesWithDelayedReasserts(actor, encumbrance, totalWeight);
  }
}
