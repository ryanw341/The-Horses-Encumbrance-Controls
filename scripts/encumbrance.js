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
   * Calculate total weight including currency
   */
  calculateTotalWeight(actor, { trackCurrencyWeight = true } = {}) {
    // Get item weight
    let itemWeight = 0;
    actor.items.forEach(item => {
      const weight = item.system?.weight || 0;
      const quantity = item.system?.quantity || 1;
      itemWeight += weight * quantity;
    });
    
    // Get currency weight
    let currencyWeight = 0;
    if (trackCurrencyWeight) {
      const currencyPerWeight = game.settings.get(this.MODULE_ID, 'currencyPerWeight');
      const currency = actor.system?.currency || {};
      const totalCoins = (currency.cp || 0) + (currency.sp || 0) + (currency.ep || 0) + 
                         (currency.gp || 0) + (currency.pp || 0);
      currencyWeight = totalCoins / currencyPerWeight;
    }
    
    return itemWeight + currencyWeight;
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
   * Check and update encumbrance for an actor
   */
  async checkEncumbrance(actor) {
    // Only process character actors
    if (actor.type !== 'character') {
      return;
    }
    
    const { tracking, trackCurrency } = this.getSystemEncumbranceSettings();
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
