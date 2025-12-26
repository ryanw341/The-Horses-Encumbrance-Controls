# The Horse's Encumbrance Controls

A Foundry VTT module that provides enhanced encumbrance controls with customizable tier multipliers, automatic effects, and flexible speed reductions.

## Features

### 1. Customizable Encumbrance Tier Multipliers
Modify the default encumbrance calculations by changing the multipliers for each tier:
- **Tier 1 (Encumbered)**: Default Strength × 5
- **Tier 2 (Heavily Encumbered)**: Default Strength × 10
- **Tier 3 (Exceeding Carrying Capacity)**: Default Strength × 15

### 2. Automatic Encumbrance Effects
Toggle the automatic application of custom temporary effects based on encumbrance tier:
- **Encumbered** - Applied when carrying weight exceeds Tier 1 threshold
- **Heavily Encumbered** - Applied when carrying weight exceeds Tier 2 threshold
- **Exceeding Carrying Capacity** - Applied when carrying weight exceeds Tier 3 threshold

Only the highest applicable tier effect is active at any time. Lower tier effects are automatically removed when a higher tier becomes active.

### 3. Flexible Speed Reduction
Configure speed modifications for each encumbrance tier:
- Set a reduction/modification value (e.g., 5, 10, 20)
- Toggle between two modes:
  - **Reduce By**: Subtracts the value from current speed
  - **Set To**: Sets speed to the specified value
- Affects all movement types (walk, fly, burrow, swim, climb)

### 4. Currency Weight Calculation
Configure how many coins equal one unit of weight:
- Default: 50 coins = 1 lb
- Automatically calculates total currency weight from all coin types (cp, sp, ep, gp, pp)

## Installation

### Method 1: Manifest URL
1. In Foundry VTT, go to the "Add-on Modules" tab
2. Click "Install Module"
3. Paste the manifest URL: `https://github.com/ryanw341/The-Horses-Encumbrance-Controls/releases/latest/download/module.json`
4. Click "Install"

### Method 2: Manual Installation
1. Download the latest release
2. Extract to your Foundry `Data/modules` folder
3. Restart Foundry VTT
4. Enable the module in your world

## Configuration

All settings are found in the module settings menu (Configure Settings → Module Settings):

### Encumbrance Thresholds
- **Tier 1 Multiplier**: Weight threshold for "Encumbered" status
- **Tier 2 Multiplier**: Weight threshold for "Heavily Encumbered" status
- **Tier 3 Multiplier**: Weight threshold for "Exceeding Carrying Capacity" status

### Effect Control
- **Enable Encumbrance Effects**: Master toggle to enable/disable automatic effect application

### Speed Modifications
For each tier (1, 2, 3):
- **Tier X Speed Reduction**: The amount to reduce or set speed
- **Tier X Set Speed**: Toggle between reducing speed or setting it to a fixed value

### Currency
- **Currency per Weight**: Number of coins that equal 1 unit of weight

## Usage

Once installed and configured:
1. The module automatically monitors character encumbrance
2. When a character's carried weight crosses a threshold, the appropriate effect is applied
3. Speed is automatically modified based on your settings
4. Effects update dynamically as inventory changes

## Compatibility

- **Foundry VTT**: v11+
- **Verified**: v12
- **Game System**: Designed for D&D 5e (may work with compatible systems)

## Development

### Project Structure
```
The-Horses-Encumbrance-Controls/
├── module.json           # Module manifest
├── scripts/
│   ├── main.js          # Main module initialization
│   ├── settings.js      # Settings registration
│   └── encumbrance.js   # Encumbrance logic
├── styles/
│   └── module.css       # Module styles
├── lang/
│   └── en.json          # Localization
└── README.md
```

### Building
This module uses vanilla JavaScript and requires no build process. Simply zip the contents for distribution.

## License

This module is provided as-is for use with Foundry VTT.

## Support

For issues, feature requests, or contributions:
- GitHub: https://github.com/ryanw341/The-Horses-Encumbrance-Controls

## Credits

Created for the Foundry VTT community.