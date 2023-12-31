/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
import {manageListElement} from "../roll-tab.js";

export class PhoenixActorSheet extends ActorSheet {

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["phoenix", "sheet", "actor", "character"],
            template: "systems/phoenix/templates/actor/actor-sheet.html",
            width: 720,
            height: 800,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "character"},
                {navSelector: ".skill-tabs", contentSelector: ".skill-body", initial: "skill"}]
        });
    }

    /* -------------------------------------------- */

    /** @override */
    getData() {
        const context = super.getData();
        context.dtypes = ["String", "Number", "Boolean"];

        const superData = context.data.system;

        // Use a safe clone of the actor data for further operations.
        const actorData = this.actor.toObject(false);

        context.system = actorData.system;
        context.flags = actorData.flags;

        // Prepare items.
        if (this.actor.type === 'character') {
            this._prepareCharacterItems(context);
        }

        if (context.data.system.settings == null) {
            context.data.system.settings = {};
        }

        Hooks.call('actorUpdated', context)

        return context;
    }

    /**
     * Organize and classify Items for Character sheets.
     *
     * @param {Object} actorData The actor to prepare.
     *
     * @return {undefined}
     */
    _prepareCharacterItems(context) {

        // Initialize containers.
        const gear = [];
        const skills = Array.from(Array(7), () => []);
        var dict = {
            strength: 0,
            dexterity: 1,
            constitution: 2,
            intelligence: 3,
            wisdom: 4,
            charisma: 5,
            misc: 6
        }
        let specialSkills = Array(0)

        // Iterate through items, allocating to containers
        // let totalWeight = 0;
        for (let i of context.items) {
            let item = i.system;
            i.img = i.img || DEFAULT_TOKEN;

            // We'll handle the pip html here.
            if (item.pips == null) {
                item.pips = {
                    "value": 0,
                    "max": 0,
                    "html": ""
                };
            }
            let pipHtml = "";
            for (let i = 0; i < item.pips.max; i++) {
                if (i < item.pips.value)
                    pipHtml += '<i class="fas fa-circle"></i>'
                else
                    pipHtml += '<i class="far fa-circle"></i>';
            }
            item.pips.html = pipHtml;
            // End of the pip handler

            // Skills handling
            if (i.type === "skill") {
                if (i.system.parentSkill in dict) {
                    const parentSkillIndex = dict[i.system.parentSkill]
                    skills[parentSkillIndex].push({
                        skill: i,
                        secondaries: []
                    })
                    continue
                }

                skills[6].push({
                    skill: i,
                    secondaries: []
                })
                continue
            }

            //End of skills handle

            // Now we'll set tags
            if (i.type === "item") {
                item.isWeapon = false;
                item.isCondition = false;
            }

            if (item.size === undefined) {
                item.size = {
                    "width": 1,
                    "height": 1,
                    "x": "9em",
                    "y": "9em"
                }
            }

            if (item.sheet.rotation === undefined)
                item.sheet.rotation = 0;

            item.size.aspect = (item.sheet.rotation === -90 ? (item.size.width > item.size.height ? item.size.width / item.size.height : item.size.height / item.size.width) : 1);

            item.sheet.curHeight = (item.sheet.rotation === -90 ? item.size.width : item.size.height);
            item.sheet.curWidth = (item.sheet.rotation === -90 ? item.size.height : item.size.width);

            item.size.x = (item.sheet.curWidth * 6 + item.sheet.curWidth) + "em";
            item.size.y = (item.sheet.curHeight * 6 + item.sheet.curHeight) + "em";

            let roundScale = 5;
            let xPos = Math.round(item.sheet.currentX / roundScale) * roundScale;
            let yPos = Math.round(item.sheet.currentY / roundScale) * roundScale;
            item.sheet.currentX = xPos;
            item.sheet.currentY = yPos;
            item.sheet.zIndex = xPos + yPos + 1000;

            if (i.type !== "storage") {
                item.store = null;
            }

            gear.push(i);
        }
        // Assign and return

        for (let i of skills[6]){
            let foundParent = false
            for (let k = 0; k < 6; k++){
                for (let j = 0; j < skills[k].length; j++){
                    if (skills[k][j].skill.name === i.skill.system.parentSkill){
                        skills[k][j].secondaries.push(i.skill)
                        foundParent = true
                        break
                    }
                }
                if (foundParent){break}
            }
            if (!foundParent) {specialSkills.push(i)}
        }
        skills[6] = specialSkills

        context.gear = gear;
        context.skills = skills;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // Enter/exit roll mode
        html.find('.roll-activate').click(ev => {
            this.roll_mode = !this.roll_mode
            this.render()
        })

        // Update Inventory Item
        html.find('.item-equip').click(ev => {
            const li = $(ev.currentTarget).parents(".item");
            const item = duplicate(this.actor.getEmbeddedDocument("Item", li.dataset.itemId))

            item.system.equipped = !item.system.equipped;
            this.actor.updateEmbeddedDocuments('Item', [item]);
        });

        // Add Inventory Item
        html.find('.item-create').click(ev => {

            let creatableItems = ['item', 'storage'];
            let selectList = "";

            creatableItems.forEach(type => selectList += "<option value='" + type + "'>" + type + "</option>")

            //Select the stat of the roll.
            let t = new Dialog({
                title: "Select Stat",
                content: "<h2> Item Type </h2> <select style='margin-bottom:10px;'name='type' id='type'> " + selectList + "</select> <br/>",
                buttons: {
                    roll: {
                        icon: '<i class="fas fa-check"></i>',
                        label: "Create",
                        callback: (html) => this._onItemCreate(ev, html.find('[id=\"type\"]')[0].value)
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Cancel",
                        callback: () => {
                        }
                    }
                },
                default: "roll",
                close: () => {
                }
            });
            t.render(true);
        });

        // Add Skill
        html.find('.skill-create').click(ev => {

            let creatableItems = ['skill'];
            let selectList = "";

            creatableItems.forEach(type => selectList += "<option value='" + type + "'>" + type + "</option>")

            //Select the stat of the roll.
            let t = new Dialog({
                title: game.i18n.localize("Phoenix.SkillCreation"),
                content: `<h2> ${game.i18n.localize("Phoenix.SkillName")} </h2> <input type='text' name='itemName' id='itemName' style='margin-bottom: 10px;'> <br/>`,
                buttons: {
                    roll: {
                        icon: '<i class="fas fa-check"></i>',
                        label: `${game.i18n.localize("Phoenix.Create")}`,
                        callback: (html) => this._onItemCreate(ev, 'skill', html.find('[id="itemName"]')[0].value)
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: `${game.i18n.localize("Phoenix.Cancel")}`,
                        callback: () => {
                        }
                    }
                },
                default: "roll",
                close: () => {
                }
            });
            t.render(true);
        });

        // Update Inventory Item
        html.find('.item-edit').click(ev => {
            const li = $(ev.currentTarget).parents(".item");
            const item = this.actor.getEmbeddedDocument("Item", li.data("itemId"));
            item.sheet.render(true);
        });

        // Delete Inventory Item
        html.find('.item-delete').click(ev => {
            const li = $(ev.currentTarget).parents(".item");
            this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
            li.slideUp(200, () => this.render(false));
        });

        // Rotate Inventory Item
        html.find('.item-rotate').click(ev => {
            const li = ev.currentTarget.closest(".item");
            const item = duplicate(this.actor.getEmbeddedDocument("Item", li.dataset.itemId))
            if (item.system.sheet.rotation == -90)
                item.system.sheet.rotation = 0;
            else
                item.system.sheet.rotation = -90;
            this.actor.updateEmbeddedDocuments('Item', [item]);
        });

        // Display item info by clicking on name
        html.find('.item-name').click(ev => {
            const li = $(ev.currentTarget).parents(".item");
            const item = this.actor.getEmbeddedDocument("Item", li.data("itemId"));
            html.find('.full-item-name').text(item.name)
            if (typeof item.system.description !== 'undefined') {
                html.find('.item-description').text(stripHtmlTags(item.system.description));
            }
            else {
                html.find('.item-description').text("");
            }
        })

        // Rollable Attributes
        html.find('.roll-modifier').click(ev => {
            const div = $(ev.currentTarget);
            div.toggleClass("roll-active")

            manageListElement(html,
                div.attr("data-key"),
                div.attr("data-value"),
                div.attr("data-mod-type"),
                div.hasClass("roll-active"))
        });

        // Select dice to roll
        html.find('.dice-icon').click(ev => {
            $('.dice-icon').css('background-color', '').removeClass("active");
            $('.dice-icon svg').css('fill', '');

            $(ev.currentTarget).css('background-color', 'black').addClass("active");
            $(ev.currentTarget).find('svg').css('fill', 'white');
        });

        const numberInput = $("#numberInput");
        // Increase/decrease roll modifier
        $("#decrease").click(function() {
            const currentValue = parseInt(numberInput.val());
            numberInput.val(currentValue - 1);
        });

        $("#increase").click(function() {
            const currentValue = parseInt(numberInput.val());
            numberInput.val(currentValue + 1);
        });

        // Toggle advantage/disadvantage buttons
        html.find('.advantage-button').click(ev => {
            $(ev.currentTarget).toggleClass("active")
            if ($(ev.currentTarget).hasClass("active")) {
                html.find('.disadvantage-button').removeClass("active")
            }
        })

        html.find('.disadvantage-button').click(ev => {
            $(ev.currentTarget).toggleClass("active")
            if ($(ev.currentTarget).hasClass("active")) {
                html.find('.advantage-button').removeClass("active")
            }
        })

        // Add/remove XP roll
        html.find('.xp-control').click(ev => {
            $(ev.currentTarget).toggleClass("active")
        })

        // Roll with given modifiers
        html.find('.roll-button').click(async ev =>{
            let sum = 0;

            $(".roll-mod").each(function() {
                var value = parseInt($(this).text());
                if (!isNaN(value)) {
                    sum += value;
                }
            });

            let advantage = ""
            let number = "2"

            if (html.find('.advantage-button').hasClass('active')){
                advantage = "kh"
            } else if (html.find('.disadvantage-button').hasClass('active')){
                advantage = "kl"
            }
            else {
                number = "1"
            }

            let dice = html.find('.dice-icon.active').attr("data-dice")

            if (!dice){
                dice = "d20"
            }

            let roll = new Roll(number + dice + advantage + " + " + sum + "+" + numberInput.val(), this.actor)
            roll.toMessage({speaker: ChatMessage.getSpeaker({actor: this.actor})})

            if (html.find('.xp-control').hasClass("active")){
                let xproll = new Roll("1d100 + " + this.actor.system.stats.intelligence.value)
                await xproll.toMessage({speaker: ChatMessage.getSpeaker({actor: this.actor})})

                if (xproll.total >= 90) {
                    AudioHelper.play({src: "modules/experience-roll/sounds/xpsound.mp3", volume: 0.3, autoplay: true, loop: false}, true);


                    let data = {
                        content: this.actor.name + " успешно бросил опытник! Результат броска: " + xproll.result,
                        user: game.user,
                        speaker: ChatMessage.getSpeaker({actor: this.actor})
                    }

                    ChatMessage.create(data)
                }


            }
        })

        // Rollable Item/Anything with a description that we want to click on.
        html.find('.item-roll').click(ev => {
            const li = ev.currentTarget.closest(".item");
            this.actor.rollItem(li.dataset.itemId, {
                event: ev
            });
        });

        // If we have an item input being adjusted from the character sheet.
        html.on('change', '.item-input', ev => {
            const li = ev.currentTarget.closest(".item");
            const item = duplicate(this.actor.getEmbeddedDocument("Item", li.dataset.itemId))
            const input = $(ev.currentTarget);

            item[input[0].name] = input[0].value;

            this.actor.updateEmbeddedDocuments('Item', [item]);
        });

        html.on('mousedown', '.pip-button', ev => {
            const li = ev.currentTarget.closest(".item");
            const item = duplicate(this.actor.getEmbeddedDocument("Item", li.dataset.itemId))

            let amount = item.system.pips.value;

            if (event.button == 0) {
                if (amount < item.system.pips.max) {
                    item.system.pips.value = Number(amount) + 1;
                }
            } else if (event.button == 2) {
                if (amount > 0) {
                    item.system.pips.value = Number(amount) - 1;
                }
            }

            this.actor.updateEmbeddedDocuments('Item', [item]);
        });

        html.on('mousedown', '.damage-swap', ev => {
            const li = ev.currentTarget.closest(".item");
            const item = duplicate(this.actor.getEmbeddedDocument("Item", li.dataset.itemId))

            let d1 = item.system.weapon.dmg1;
            let d2 = item.system.weapon.dmg2;

            item.system.weapon.dmg1 = d2;
            item.system.weapon.dmg2 = d1;
            this.actor.updateEmbeddedDocuments('Item', [item]);

        });


        // Drag events for macros.
        if (this.actor.isOwner) {
            let handler = ev => this._onDragItemStart(ev);
            let dragEnd = ev => this._onDragOver(ev);

            html.find('li.dropitem').each((i, li) => {
                if (li.classList.contains("inventory-header")) return;
                li.setAttribute("draggable", true);
                li.addEventListener("dragstart", handler, false);
            });

            html.find('div.dropitem').each((i, div) => {
                if (div.classList.contains("inventory-header")) return;
                div.setAttribute("draggable", true);
                div.addEventListener("dragstart", handler, false);
                div.addEventListener("dragend", dragEnd, false);

            });


            // Item Card handler

            // html.find('div.dragItems').each((i, dragItem) => {

            //   const item = duplicate(this.actor.getEmbeddedDocument("Item", dragItem.dataset.itemId))
            //   // let dragItem = document.querySelector("#" + container.dataset.itemId);
            //   var curIndex = 1; //The current zIndex

            //   if (item.data.sheet == undefined) {
            //     item.data.sheet = {
            //       "active": false,
            //       "currentX": 0,
            //       "currentY": 0,
            //       "initialX": 0,
            //       "initialY": 0,
            //       "xOffset": 0,
            //       "yOffset": 0
            //     };
            //   }


            //   setTranslate(item.data.sheet.currentX, item.data.sheet.currentY, dragItem, true);
            //   dragItem.style.zIndex = item.data.sheet.currentX + 500;

            //   //this.actor.updateEmbeddedDocuments('Item', [item]);

            //   function setTranslate(xPos, yPos, el, round = false) {

            //     if (round) {
            //       let roundScale = 5;
            //       xPos = Math.round(xPos / roundScale) * roundScale;// - (item.data.size.width - 1) * 4;
            //       yPos = Math.round(yPos / roundScale) * roundScale;// - (item.data.size.height - 1) * 4;
            //     }
            //     el.style.transform = "translate3d(" + xPos + "px, " + yPos + "px, 0)";
            //   }
            // });
        }


    }

    /* -------------------------------------------- */

    /**
     * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
     * @param {Event} event   The originating click event
     * @private
     */
    _onItemCreate(event, type, name = "New Item") {
        event.preventDefault();
        const header = event.currentTarget;
        // Get the type of item to create.
        //const type = header.dataset.type;
        // Grab any data associated with this control.
        const data = duplicate(header.dataset);
        // Prepare the item object.
        const itemData = {
            name: name,
            type: type,
            data: data
        };
        // Remove the type from the dataset since it's in the itemData.type prop.
        delete itemData.data["type"];

        // Finally, create the item!
        return this.actor.createEmbeddedDocuments("Item", [itemData]);
    }

    /**
     * Handle creating a new Owned skill for the actor using initial data defined in the HTML dataset
     * @param {Event} event   The originating click event
     * @private
     */
    _onSkillCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        // Get the type of item to create.
        const type = header.dataset.type;
        // Grab any data associated with this control.
        const data = duplicate(header.dataset);
        // Initialize a default name.
        const name = `New Skill`;
        // Prepare the item object.
        const itemData = {
            name: name,
            type: type,
            data: data
        };
        // Remove the type from the dataset since it's in the itemData.type prop.
        delete itemData.data["type"];

        // Finally, create the item!
        return this.actor.createEmbeddedDocuments("Item", [itemData]);
    }


    /**
     * Handle clickable rolls.
     * @param {Event} event   The originating click event
     * @private
     */
    _onRoll(event) {
        event.preventDefault();
        const element = event.currentTarget;
        const dataset = element.dataset;

        if (dataset.roll) {
            let roll = new Roll(dataset.roll, this.actor.system);
            let label = dataset.label ? `Rolling ${dataset.label} to score under ${dataset.target}` : '';
            roll.roll().toMessage({
                speaker: ChatMessage.getSpeaker({actor: this.actor}),
                flavor: label
            });
        }
    }

    async _updateObject(event, formData) {
        const actor = this.object;
        const updateData = expandObject(formData);

        await actor.update(updateData, {
            diff: false
        });
    }


    //The onDragItemStart event can be subverted to let you package additional data what you're dragging
    _onDragItemStart(event) {
        let itemId = event.currentTarget.getAttribute("data-item-id");

        if (!itemId)
            return;

        const clickedItem = duplicate(
            this.actor.getEmbeddedDocument("Item", itemId)
        );


        let it = $(event.currentTarget);

        let width = it.outerWidth();
        let height = it.outerHeight();
        var x = event.pageX - it.offset().left - width / 2;
        var y = event.pageY - it.offset().top - height / 2;

        let i = $('#' + itemId);

        // i.fadeOut(150);

        // setTimeout(function(){
        //   $('#'+itemId)[0].style.visibility = "hidden";
        // }, 1);
        // console.log(event);

        clickedItem.system.stored = "";
        const item = clickedItem;


        event.dataTransfer.setData(
            "text/plain",
            JSON.stringify({
                type: "Item",
                sheetTab: this.actor.flags["_sheetTab"],
                actorId: this.actor.id,
                itemId: itemId,
                fromToken: this.actor.isToken,
                offset: {
                    x: x,
                    y: y
                },
                data: item,
                root: event.currentTarget.getAttribute("root"),
            })
        );
    }

    //Call this when an item is dropped.
    _onDragOver(event) {
        // let itemId = event.currentTarget.getAttribute("data-item-id");

        // if(!itemId)
        //   return;

        // let item = $('#'+itemId);

        // if(item == null)
        //   return;

        // item.fadeIn(150);
        // setTimeout(function(){
        //   item.style.visibility = "visible";
        // }, 100);
    }

    /**
     * Handle dropping of an item reference or item data onto an Actor Sheet
     * @param {DragEvent} event     The concluding DragEvent which contains drop data
     * @param {Object} data         The data transfer extracted from the event
     * @return {Object}             A data object which describes the result of the drop
     * @private
     */
    async _onDropItem(event, data) {
        if (!this.actor.isOwner) return false;
        const item = await Item.fromDropData(data);
        const itemData = duplicate(item);

        // Handle item sorting within the same Actor
        const actor = this.actor;

        let it = $(event.target);
        if (it.attr('id') != "drag-area") {
            it = it.parents("#drag-area")
        }

        var x = 0;
        var y = 0;


        if (it.length) {
            let width = it.outerWidth();
            let height = it.outerHeight();

            x = event.pageX - it.offset().left - width / 2;
            y = event.pageY - it.offset().top - height / 2;
        }
        // let width = $('#drag-area-' + actor.id).outerWidth();
        // let height = $('#drag-area-' + actor.id).outerHeight();

        // var x = event.pageX - $('#drag-area-' + actor.id).offset().left - width / 2;
        // var y = event.pageY - $('#drag-area-' + actor.id).offset().top - height / 2;

        // if (Math.abs(x) > Math.abs(width / 2) || Math.abs(y) > Math.abs(height / 2)) {
        //     x = 0;
        //     y = 0;
        // }

        let sameActor = (data.actorId === actor.id) || (actor.isToken && (data.tokenId === actor.token.id));
        if (sameActor && !(event.ctrlKey)) {
            let i = duplicate(actor.getEmbeddedDocument("Item", data.itemId))
            i.system.sheet = {
                currentX: x - data.offset.x,
                currentY: y - data.offset.y,
                initialX: x - data.offset.x,
                initialY: y - data.offset.y,
                xOffset: x - data.offset.x,
                yOffset: y - data.offset.y
            };
            actor.updateEmbeddedDocuments('Item', [i]);
            return;
            //return this._onSortItem(event, itemData);
        }

        if (data.actorId && !(event.ctrlKey) && !data.fromToken && !this.actor.isToken) {
            let oldActor = game.actors.get(data.actorId);
            await oldActor.deleteEmbeddedDocuments("Item", [data.itemId]);
        }

        if (!data.offset) {
            data.offset = {
                x: 0,
                y: 0
            };
        }
        itemData.system.sheet = {
            currentX: x - data.offset.x,
            currentY: y - data.offset.y,
            initialX: x - data.offset.x,
            initialY: y - data.offset.y,
            xOffset: x - data.offset.x,
            yOffset: y - data.offset.y
        };

        // Create the owned item
        return this._onDropItemCreate(itemData);
    }
}

function stripHtmlTags(input) {
    return input.replace(/<[^>]*>/g, '');
}