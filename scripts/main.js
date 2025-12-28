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
    
    // Perform one-time sanitization of all character items
    await game.encumbranceControls.performInitialSanitization();
  }
  
  // Hook into actor updates to manage encumbrance effects
  Hooks.on('updateActor', async (actor, data, options, userId) => {
    if (game.encumbranceControls) {
      // Sanitize currency if it's being updated
      if (data?.system?.currency) {
        await game.encumbranceControls.sanitizeActorCurrency(actor, data.system.currency);
      }
      
      game.encumbranceControls.checkEncumbrance(actor);
    }
  });
  
  // Hook into item create/update/delete to manage encumbrance effects
  Hooks.on('createItem', async (item, options, userId) => {
    if (game.encumbranceControls && item.parent && item.parent.type === 'character') {
      // Sanitize the newly created item
      await game.encumbranceControls.sanitizeItemData(item);
      game.encumbranceControls.checkEncumbrance(item.parent);
    }
  });
  
  Hooks.on('updateItem', async (item, data, options, userId) => {
    if (game.encumbranceControls && item.parent && item.parent.type === 'character') {
      // Sanitize the item if weight or quantity changed
      if (data?.system?.weight !== undefined || data?.system?.quantity !== undefined) {
        await game.encumbranceControls.sanitizeItemData(item);
      }
      game.encumbranceControls.checkEncumbrance(item.parent);
    }
  });
  
  Hooks.on('deleteItem', (item, options, userId) => {
    if (game.encumbranceControls && item.parent && item.parent.type === 'character') {
      game.encumbranceControls.checkEncumbrance(item.parent);
    }
  });
  
  // Hook before actor sheet renders to patch NaN encumbrance values
  Hooks.on('renderActorSheet5eCharacter', (app, html, data) => {
    if (game.encumbranceControls && app.actor) {
      game.encumbranceControls.patchSystemEncumbrance(app.actor);
    }
  });
  
  // Also handle legacy sheet type
  Hooks.on('renderActorSheet', (app, html, data) => {
    if (game.encumbranceControls && app.actor && app.actor.type === 'character') {
      game.encumbranceControls.patchSystemEncumbrance(app.actor);
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
