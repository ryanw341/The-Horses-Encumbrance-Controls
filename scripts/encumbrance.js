export class EncumbranceManager {
  constructor() {
    this.MODULE_ID = 'the-horses-encumbrance-controls';
    this.EFFECT_NAMES = {
      tier1: 'Encumbered',
      tier2: 'Heavily Encumbered',
      tier3: 'Exceeding Carrying Capacity'
    };
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
  calculateTotalWeight(actor) {
    // Get item weight
    let itemWeight = 0;
    actor.items.forEach(item => {
      const weight = item.system?.weight || 0;
      const quantity = item.system?.quantity || 1;
      itemWeight += weight * quantity;
    });
    
    // Get currency weight
    const currencyPerWeight = game.settings.get(this.MODULE_ID, 'currencyPerWeight');
    const currency = actor.system?.currency || {};
    const totalCoins = (currency.cp || 0) + (currency.sp || 0) + (currency.ep || 0) + 
                       (currency.gp || 0) + (currency.pp || 0);
    const currencyWeight = totalCoins / currencyPerWeight;
    
    return itemWeight + currencyWeight;
  }
  
  /**
   * Determine which encumbrance tier the actor is in
   */
  getEncumbranceTier(actor) {
    const strength = actor.system?.abilities?.str?.value || 10;
    const totalWeight = this.calculateTotalWeight(actor);
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
    
    const effectsEnabled = game.settings.get(this.MODULE_ID, 'enableEffects');
    
    if (!effectsEnabled) {
      // Remove any existing encumbrance effects if effects are disabled
      await this.removeEncumbranceEffects(actor);
      return;
    }
    
    // Get the current encumbrance tier
    const tier = this.getEncumbranceTier(actor);
    
    // Apply the appropriate effect
    await this.applyEncumbranceEffect(actor, tier);
  }
}
