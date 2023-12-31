// Import Modules
import { PhoenixActor } from "./actor/actor.js";
import { PhoenixActorSheet } from "./actor/actor-sheet.js";
import { PhoenixStorageSheet } from "./actor/storage-sheet.js";

import { PhoenixItem } from "./item/item.js";
import { PhoenixItemSheet } from "./item/item-sheet.js";

import {
    registerSettings
} from "./settings.js";

Hooks.once('init', async function () {

    game.phoenix = {
        PhoenixActor,
        PhoenixItem
    };

    registerSettings();

    // Define custom Entity classes
    CONFIG.Actor.documentClass = PhoenixActor;
    CONFIG.Item.documentClass = PhoenixItem;


    // Register sheet application classes
    Actors.unregisterSheet("core", ActorSheet);

    Actors.registerSheet("phoenix", PhoenixActorSheet, {
        types: ['character', 'npc'],
        label: game.i18n.localize("phoenix.PhoenixActorSheet"),
        makeDefault: true
    });
    Actors.registerSheet("phoenix", PhoenixStorageSheet, {
        types: ['storage'],
        makeDefault: false
    });

    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("phoenix", PhoenixItemSheet, { makeDefault: true });

    Handlebars.registerHelper('concat', function () {
        let outStr = '';
        for (let arg in arguments) {
            if (typeof arguments[arg] != 'object') {
                outStr += arguments[arg];
            }
        }
        return outStr;
    });

    Handlebars.registerHelper('tostat', function (){
        if (arguments[0] === 0){
            return "Strength"
        }
        if (arguments[0] === 1){
            return "Dexterity"
        }
        if (arguments[0] === 2){
            return "Constitution"
        }
        if (arguments[0] === 3){
            return "Intelligence"
        }
        if (arguments[0] === 4){
            return "Wisdom"
        }
        if (arguments[0] === 5){
            return "Charisma"
        }
        if (arguments[0] === 6){
            return "Special"
        }
    });

    Handlebars.registerHelper('toLowerCase', function (str) {
        return str.toLowerCase();
    });

    CONFIG.Combat.initiative = {
        formula: "1d20+@stats.dexterity.value+@stats.wisdom.value",
        decimals: 2
    };

    // preloadHandlebarsTemplates();
});

/**
 * Set default values for new actors' tokens
 */
Hooks.on("preCreateActor", (actor, data, options, userId) => {
    // Set wounds, advantage, and display name visibility
    mergeObject(data, {
        "prototypeToken.bar1": { "attribute": "health" },        // Default Bar 1 to Health
        "prototypeToken.bar2": { "stat": "evasion" },            // Default Bar 2 to Evasion
        "prototypeToken.displayName": CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,     // Default display name to be on owner hover
        "prototypeToken.displayBars": CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,     // Default display bars to be on owner hover
        "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.NEUTRAL,                               // Default disposition to neutral
        "prototypeToken.name": data.name                                   // Set token name to actor name
    });

    if (data.type === "character") {
        mergeObject(data, {
            "prototypeToken.sight.enabled": true,
            "prototypeToken.actorLink": true
        });
    } else if (data.type === "npc") {
        mergeObject(data, {
            "prototypeToken.sight.enabled": true,
            "prototypeToken.sight.range": 100
        })
    }

    console.log(data)

    actor.updateSource(data)

    console.log("Final createData before actor creation:", data);
});

// async function preloadHandlebarsTemplates() {
//   const templatePaths = [
//       "systems/phoenix/templates/item/item-card.html"
//   ];
//   return loadTemplates(templatePaths);
// }