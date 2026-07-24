# Changelog

## [Unreleased] - Encumbrance Tier Rework

### Changed
- Replaced the three separate tier multipliers with a single **Carry Weight Multiplier** that sets the global carrying capacity (Strength × multiplier, default 15)
  - Encumbrance tiers are now calculated as fractions of total carrying capacity (Tier 1 = 1/3, Tier 2 = 2/3, Tier 3 = full)
- Setting **Currency per Weight** to `0` now makes currency completely weightless

### Fixed
- The **Carry Weight Multiplier** now updates the total carry weight (`max`) shown on character sheets. Previously it only affected the module's internal tier thresholds, so the displayed capacity never changed
  - The carrying capacity is reasserted on every sheet render (and after actor/item updates), and the encumbrance bar's percentage and tier markers now reflect the multiplier

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
