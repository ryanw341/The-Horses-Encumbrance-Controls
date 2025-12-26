export function registerSettings() {
  const MODULE_ID = 'the-horses-encumbrance-controls';
  
  // Tier Multipliers
  game.settings.register(MODULE_ID, 'tier1Multiplier', {
    name: 'Tier 1 Multiplier (Encumbered)',
    hint: 'Multiplier for Strength to calculate the first encumbrance tier (default: 5)',
    scope: 'world',
    config: true,
    type: Number,
    default: 5,
    onChange: () => window.location.reload()
  });
  
  game.settings.register(MODULE_ID, 'tier2Multiplier', {
    name: 'Tier 2 Multiplier (Heavily Encumbered)',
    hint: 'Multiplier for Strength to calculate the second encumbrance tier (default: 10)',
    scope: 'world',
    config: true,
    type: Number,
    default: 10,
    onChange: () => window.location.reload()
  });
  
  game.settings.register(MODULE_ID, 'tier3Multiplier', {
    name: 'Tier 3 Multiplier (Exceeding Carrying Capacity)',
    hint: 'Multiplier for Strength to calculate the third encumbrance tier (default: 15)',
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
    hint: 'Number of coins that equal 1 pound of weight (default: 50)',
    scope: 'world',
    config: true,
    type: Number,
    default: 50,
    onChange: () => window.location.reload()
  });
}
