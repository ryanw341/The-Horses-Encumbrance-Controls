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
      icon: 'icons/svg/weight.svg',
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
    
    // Patch the value in-memory (doesn't persist to database)
    encumbrance.value = computedWeight;
    
    // Also compute and patch pct if max is available
    const max = this.getNumeric(encumbrance.max, 0);
    if (max > 0) {
      encumbrance.pct = Math.round((computedWeight / max) * 100);
    }
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
    if (encumbrance) {
      // Ensure totalWeight is finite before assigning (defensive programming)
      encumbrance.value = Number.isFinite(totalWeight) ? totalWeight : 0;
      
      // Also update pct when max is available and finite
      const max = this.getNumeric(encumbrance.max, 0);
      if (Number.isFinite(max) && max > 0 && Number.isFinite(totalWeight)) {
        encumbrance.pct = Math.round((totalWeight / max) * 100);
      }
    }
    
    // If the system setting cannot be read, fall back to module behavior
    const shouldSkipEncumbrance = tracking === undefined ? false : this.isEncumbranceDisabled(tracking);
    
    if (shouldSkipEncumbrance) {
      await this.removeEncumbranceEffects(actor);
      return;
    }
    
    const effectsEnabled = game.settings.get(this.MODULE_ID, 'enableEffects');
    
    if (!effectsEnabled) {
      // Remove any existing encumbrance effects if effects are disabled
      await this.removeEncumbranceEffects(actor);
      return;
    }
    
    // Get the current encumbrance tier
    const tier = this.getEncumbranceTier(actor, { trackCurrencyWeight: trackCurrency });
    
    // Apply the appropriate effect
    await this.applyEncumbranceEffect(actor, tier);
  }
}
