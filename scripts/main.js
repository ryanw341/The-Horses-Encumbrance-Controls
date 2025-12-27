import { registerSettings } from './settings.js';
import { EncumbranceManager } from './encumbrance.js';

Hooks.once('init', async function() {
  console.log('The Horse\'s Encumbrance Controls | Initializing');
  
  // Register module settings
  registerSettings();
  
  // Initialize the encumbrance manager
  game.encumbranceControls = new EncumbranceManager();
});

Hooks.on('ready', async function() {
  console.log('The Horse\'s Encumbrance Controls | Ready');
  
  // Apply currency weight configuration now that world settings are available
  if (game.encumbranceControls) {
    game.encumbranceControls.applyCurrencyWeightConfig();
  }
  
  // Hook into actor updates to manage encumbrance effects
  Hooks.on('updateActor', (actor, data, options, userId) => {
    if (game.encumbranceControls) {
      game.encumbranceControls.checkEncumbrance(actor);
    }
  });
  
  // Check encumbrance for all actors on load
  if (game.encumbranceControls && game.user.isGM) {
    for (let actor of game.actors) {
      if (actor.type === 'character') {
        game.encumbranceControls.checkEncumbrance(actor);
      }
    }
  }
});
