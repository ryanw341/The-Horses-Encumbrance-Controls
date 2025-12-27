# Changelog

## [1.0.3] - Bug Fix Release

### Fixed
- Fixed NaN display for carried weight on character sheets
  - Module now always computes total weight manually instead of relying on potentially corrupted system encumbrance value
  - Currency weight calculation now sums all present currency keys (supports renamed/disabled currencies)
  - System encumbrance value is automatically patched in-memory when NaN is detected
  - Character sheets now display correct weight values without requiring per-actor data cleanup
- Encumbrance effects and tiers continue to work correctly even when system encumbrance value is NaN

## [1.0.0] - Initial Release

### Features
- Customizable encumbrance tier multipliers (Strength x N)
  - Tier 1 (Encumbered): Default Str x 5
  - Tier 2 (Heavily Encumbered): Default Str x 10
  - Tier 3 (Exceeding Carrying Capacity): Default Str x 15
- Toggle to enable/disable automatic encumbrance effects
- Custom temporary effects for each encumbrance tier
  - Only highest applicable tier is active
  - Lower tier effects automatically removed
- Speed reduction settings for each tier
  - Configurable reduction amount
  - Toggle between "reduce by" and "set to" modes
- Currency weight calculation with configurable coins per weight unit
