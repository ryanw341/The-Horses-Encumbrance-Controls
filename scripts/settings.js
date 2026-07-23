export function registerSettings() {
  const MODULE_ID = 'the-horses-encumbrance-controls';
  
  // Carry Weight Multiplier
  game.settings.register(MODULE_ID, 'carryWeightMultiplier', {
    name: 'Carry Weight Multiplier',
    hint: 'Multiplier for Strength to calculate total carrying capacity. Each encumbrance tier is a fraction of this total (default: 15)',
    scope: 'world',
    config: true,
    type: Number,
    default: 15,
    onChange: () => window.location.reload()
  });
  
  // Enable Effects Toggle
  game.settings.register(MODULE_ID, 'enableEffects', {
    name: 'Enable Encumbrance Effects',
    hint: 'When enabled, applies custom temporary effects based on encumbrance tier',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => window.location.reload()
  });
  
  // Tier 1 Speed Settings
  game.settings.register(MODULE_ID, 'tier1SpeedReduction', {
    name: 'Tier 1 Speed Reduction',
    hint: 'Amount to reduce (or set) speed when Encumbered',
    scope: 'world',
    config: true,
    type: Number,
    default: 10
  });
  
  game.settings.register(MODULE_ID, 'tier1SpeedSetTo', {
    name: 'Tier 1 Set Speed (instead of reduce)',
    hint: 'If enabled, sets speed to the value instead of reducing by it',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });
  
  // Tier 2 Speed Settings
  game.settings.register(MODULE_ID, 'tier2SpeedReduction', {
    name: 'Tier 2 Speed Reduction',
    hint: 'Amount to reduce (or set) speed when Heavily Encumbered',
    scope: 'world',
    config: true,
    type: Number,
    default: 20
  });
  
  game.settings.register(MODULE_ID, 'tier2SpeedSetTo', {
    name: 'Tier 2 Set Speed (instead of reduce)',
    hint: 'If enabled, sets speed to the value instead of reducing by it',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });
  
  // Tier 3 Speed Settings
  game.settings.register(MODULE_ID, 'tier3SpeedReduction', {
    name: 'Tier 3 Speed Reduction',
    hint: 'Amount to reduce (or set) speed when Exceeding Carrying Capacity',
    scope: 'world',
    config: true,
    type: Number,
    default: 0
  });
  
  game.settings.register(MODULE_ID, 'tier3SpeedSetTo', {
    name: 'Tier 3 Set Speed (instead of reduce)',
    hint: 'If enabled, sets speed to the value instead of reducing by it',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
  
  // Currency per Weight
  game.settings.register(MODULE_ID, 'currencyPerWeight', {
    name: 'Currency per Weight',
    hint: 'Number of coins that equal 1 pound of weight. Set to 0 to make currency completely weightless (default: 50)',
    scope: 'world',
    config: true,
    type: Number,
    default: 50,
    onChange: () => window.location.reload()
  });
}
