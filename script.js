
// script.js

// --- PLAYER INSTANCE ---
let player = JSON.parse(JSON.stringify(playerTemplate));

Object.defineProperty(player, 'maxHp', {
    get: function() {
        let currentMaxHp = this.maxHpBase + (this.stats.e * 10);
        if (this.radLevel === "Тяжелое") currentMaxHp = Math.floor(currentMaxHp * 0.75);
        if (this.radLevel === "Смертельное") currentMaxHp = Math.floor(currentMaxHp * 0.5);
        if (this.hasPerk("life_giver_1")) currentMaxHp += 20;
        // this.diseases.forEach(diseaseId => { // diseaseData не определен, пока закомментировано
        //     const disease = diseaseData[diseaseId];
        //     if (disease && disease.effects.maxHpModifier) currentMaxHp *= disease.effects.maxHpModifier;
        // });
        return Math.max(10, Math.floor(currentMaxHp));
    }
});
Object.defineProperty(player, 'maxAp', {
    get: function() {
        let currentMaxAp = this.maxApBase + (this.stats.a * 5);
        if (this.hasPerk("action_boy_1")) currentMaxAp += 10;
        if (this.limbs.left_leg.status === "Искалечено" || this.limbs.right_leg.status === "Искалечено") {
            currentMaxAp = Math.max(20, currentMaxAp - 20);
        }
        if (this.needs.fatigue > 80) currentMaxAp = Math.floor(currentMaxAp * 0.7);
        return currentMaxAp;
    }
});
Object.defineProperty(player, 'currentCarryWeight', {
    get: function() {
        let totalWeight = 0;
        for (const category in this.inventory) {
            this.inventory[category].forEach(item => {
                totalWeight += (item.weight || 0) * (item.quantity || 1);
            });
        }
        return parseFloat(totalWeight.toFixed(2));
    }
});
Object.defineProperty(player, 'maxCarryWeight', {
    get: function() {
        let weight = 150 + (this.stats.s * 10);
        if (this.hasPerk("strong_back_1")) weight += 25;
        if (this.needs.fatigue > 90) weight = Math.floor(weight * 0.8);
        return weight;
    }
});
Object.defineProperty(player, 'isOverencumbered', {
    get: function() {
        return this.currentCarryWeight > this.maxCarryWeight;
    }
});

player.hasPerk = function(perkId) { return this.activePerks.includes(perkId); };
player.learnPerk = function(perkId) {
    const perkToLearn = availablePerks.find(p => p.id === perkId);
    if (this.perkPoints > 0 && !this.hasPerk(perkId) && perkToLearn) {
        let requirementsMet = true;
        if (perkToLearn.requires) {
            if (perkToLearn.requires.level && this.level < perkToLearn.requires.level) requirementsMet = false;
            Object.keys(perkToLearn.requires).forEach(statKey => {
                if (statKey !== 'level' && this.stats[statKey] < perkToLearn.requires[statKey]) requirementsMet = false;
            });
        }
        if (!requirementsMet) { addLog("game", `Не выполнены требования для перка: ${perkToLearn.name}.`); return false; }
        this.activePerks.push(perkId);
        this.perkPoints--;
        addLog("game", `Вы изучили перк: ${perkToLearn.name}!`, "item");
        if (perkToLearn.id === "sneak_1") this.skills.stealth += 10;
        updateAllDisplays(); return true;
    }
    addLog("game", `Не удалось изучить перк.`); return false;
};
player.heal = function(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); updateAllDisplays(); };
player.takeDamage = function(amount, targetLimbId = null) {
    this.hp -= amount;
    let actualTargetLimbId = targetLimbId;
    if (!actualTargetLimbId) {
        const limbIds = Object.keys(this.limbs);
        const validLimbs = limbIds.filter(id => this.limbs[id].status !== "Искалечено");
        actualTargetLimbId = validLimbs.length > 0 ? validLimbs[getRandomInt(0, validLimbs.length - 1)] : "torso";
    }
    if (this.limbs[actualTargetLimbId]) {
        this.limbs[actualTargetLimbId].hp -= amount;
        if (this.limbs[actualTargetLimbId].hp < 0) this.limbs[actualTargetLimbId].hp = 0;
        this.updateLimbStatus(actualTargetLimbId);
    }
    if (this.hp < 0) this.hp = 0;
    const pipboyScreen = document.getElementById('pipboy-screen');
    if (pipboyScreen) {
        pipboyScreen.classList.add('screen-shake');
        setTimeout(() => pipboyScreen.classList.remove('screen-shake'), 250);
    }
    updateAllDisplays();
    if (this.hp === 0) return "player_defeated";
    return "hit";
};
player.updateLimbStatus = function(limbId) {
    const limb = this.limbs[limbId];
    if (!limb) return;
    const oldStatus = limb.status;
    if (limb.hp <= 0) limb.status = "Искалечено";
    else if (limb.hp <= limb.maxHp * 0.3) limb.status = "Тяжелое ранение";
    else if (limb.hp <= limb.maxHp * 0.7) limb.status = "Легкое ранение";
    else limb.status = "Норма";
    if (oldStatus !== limb.status && limb.status === "Искалечено") {
        addLog("game", `Ваша ${limb.name.toLowerCase()} искалечена!`, "danger-color");
    }
};
player.addRads = function(amount) { this.rads += amount; this.updateRadLevel(); updateAllDisplays(); };
player.reduceRads = function(amount) { this.rads = Math.max(0, this.rads - amount); this.updateRadLevel(); updateAllDisplays(); };
player.updateRadLevel = function() {
    if (this.rads >= 900) this.radLevel = "Смертельное";
    else if (this.rads >= 600) this.radLevel = "Тяжелое";
    else if (this.rads >= 300) this.radLevel = "Среднее";
    else if (this.rads >= 100) this.radLevel = "Легкое";
    else this.radLevel = "Нет";
};
player.addXp = function(amount) {
    this.xp += amount;
    addLog("game", `Получено ${amount} XP.`, "item");
    while (this.xp >= this.xpToNextLevel) {
        this.level++;
        this.xp -= this.xpToNextLevel;
        this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5 + 50);
        this.perkPoints++;
        addLog("game", `ПОЛУЧЕН НОВЫЙ УРОВЕНЬ! Вы достигли ${this.level} уровня! Получено очко перков!`, "item");
        this.maxHpBase += 10;
        this.hp = this.maxHp;
        this.ap = this.maxAp;
        Object.keys(this.limbs).forEach(limbId => { this.limbs[limbId].hp = this.limbs[limbId].maxHp; this.updateLimbStatus(limbId); });
    }
    updateAllDisplays();
};
player.collectHolodisk = function(diskId) {
    if (!this.foundHolodisks.includes(diskId)) {
        this.foundHolodisks.push(diskId);
        const diskData = storyTexts.holodiskContents[diskId];
        addLog("game", `Найден голодиск: ${diskData ? diskData.title : diskId}`, "item");
        updateHolodiskDisplay();
    }
};
player.changeReputation = function(factionId, amount) {
    if (this.reputation.hasOwnProperty(factionId)) {
        this.reputation[factionId] += amount;
        this.reputation[factionId] = Math.max(-100, Math.min(100, this.reputation[factionId]));
        let factionName = factionId;
        if(factionId === "settlers") factionName = "Поселенцы";
        else if(factionId === "scavengers") factionName = "Мусорщики";
        else if(factionId === "brotherhood_outpost") factionName = "Аванпост Братства Стали";
        addLog("game", `Репутация у фракции "${factionName}" изменена на ${amount}. Текущее значение: ${this.reputation[factionId]}.`, "system");
        updateReputationDisplay();
    } else { console.warn("Unknown faction for reputation:", factionId); }
};
player.updateNeeds = function(hoursPassed = 0) {
    const hungerRate = 1 + (hoursPassed * 2);
    const thirstRate = 2 + (hoursPassed * 3);
    const fatigueRate = 1 + (hoursPassed * 4);

    this.needs.hunger = Math.min(100, this.needs.hunger + hungerRate);
    this.needs.thirst = Math.min(100, this.needs.thirst + thirstRate);
    this.needs.fatigue = Math.min(100, this.needs.fatigue + fatigueRate);

    if (hoursPassed > 0) {
        if (this.needs.hunger > 70 && (this.needs.hunger - hungerRate) <= 70) addLog("game", "Вы чувствуете сильный голод.", "warning-color");
        if (this.needs.thirst > 70 && (this.needs.thirst - thirstRate) <= 70) addLog("game", "Вас мучает жажда.", "warning-color");
        if (this.needs.fatigue > 70 && (this.needs.fatigue - fatigueRate) <= 70) addLog("game", "Вы очень устали.", "warning-color");
    }
};
player.toggleStealth = function() {
    if (this.isStealthActive) {
        this.isStealthActive = false;
        addLog("game", "Вы вышли из режима скрытности.", "info-color");
    } else {
        const stealthChance = this.skills.stealth + (this.stats.a * 2) + (this.hasPerk("sneak_1") ? 15 : 0) - (this.isOverencumbered ? 20 : 0);
        if (getRandomInt(1, 100) <= Math.max(10, stealthChance)) {
            this.isStealthActive = true;
            addLog("game", "Вы перешли в режим скрытности.", "stealth-color");
        } else {
            addLog("game", "Попытка войти в режим скрытности не удалась.", "warning-color");
        }
    }
    updateStatusDisplay();
};


// --- GAME STATE VARIABLES ---
let currentLocationId = player.discoveredLocations[0] || "vault_entrance_hall";
let currentEnemy = null;
let combatActive = false;
const BASE_HIT_CHANCE = 65;
let currentTerminal = null;
let terminalHackingActive = false;
let terminalWords = [];
let terminalPassword = "";
let terminalAttemptsLeft = 0;
let currentActiveScreenContentId = "game-main-content";
let currentMinesweeperGame = null;


// --- UTILITY FUNCTIONS ---
function getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function typeWriterEffect(element, text, delay = 7, callback) {
    if (!element) {
        console.error("typeWriterEffect: element is null. Text was:", text ? text.substring(0, 50) + "..." : "undefined");
        if (callback) callback();
        return;
    }
    element.innerHTML = "";
    let i = 0;
    function typeChar() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            element.scrollTop = element.scrollHeight;
            setTimeout(typeChar, delay);
        } else if (callback) {
            callback();
        }
    }
    typeChar();
}

function addLog(target, message, type = "normal") {
    let logContainer;
    if (target === "game") logContainer = document.getElementById("game-output");
    else if (target === "combat") logContainer = document.getElementById("combat-log");
    else if (target === "terminal") logContainer = document.getElementById("terminal-log");
    else if (target === "radio") logContainer = document.getElementById("radio-output");
    else { console.error("Invalid log target:", target); return; }

    if (!logContainer) { console.error("Log container not found for target:", target); return; }

    const logEntry = document.createElement("p");
    if (type === "item") logEntry.classList.add("item-acquired");
    else if (type === "critical") logEntry.classList.add("critical-hit");
    else if (type === "damage_taken_player" || type === "danger-color") logEntry.classList.add("damage-taken");
    else if (type === "warning-color") logEntry.style.color = "var(--warning-color)";
    else if (type === "info-color") logEntry.style.color = "var(--info-color)";
    else if (type === "stealth-color") logEntry.style.color = "var(--stealth-color)";
    else if (type === "player" && target === "combat") logEntry.style.color = "var(--pipboy-green-medium)";
    else if (type === "enemy" && target === "combat") logEntry.style.color = "#ff8c69";

    logEntry.innerHTML = `» ${message}`;

    if (logContainer.firstChild && logContainer !== document.getElementById("radio-output")) {
        logContainer.insertBefore(logEntry, logContainer.firstChild);
    } else {
        logContainer.appendChild(logEntry);
    }
    if (logContainer !== document.getElementById("radio-output")) logContainer.scrollTop = 0;
    else logContainer.scrollTop = logContainer.scrollHeight;
}

// --- CORE GAMEPLAY FUNCTIONS (renderLocation, processChoice, setCurrentLocation) ---
function renderLocation(locationId) {
    console.log("Attempting to renderLocation for:", locationId);
    const gameOutputEl = document.getElementById("game-output");
    const choicesContainerEl = document.getElementById("choices-container");

    if (!gameOutputEl || !choicesContainerEl) {
        console.error("CRITICAL: Game output or choices container not found in renderLocation. gameOutputEl:", gameOutputEl, "choicesContainerEl:", choicesContainerEl);
        return;
    }
    console.log("Game output and choices container FOUND.");

    gameOutputEl.innerHTML = "";
    choicesContainerEl.innerHTML = "";

    const locationData = gameLocations[locationId];
    if (!locationData) {
        console.error(`Error: Location with ID "${locationId}" not found in gameLocations.`);
        typeWriterEffect(gameOutputEl, `Ошибка: Локация с ID "${locationId}" не найдена.`);
        return;
    }
    console.log("Location data found for:", locationId, locationData);

    if (locationData.onEnterFunctionName && typeof window[locationData.onEnterFunctionName] === 'function') {
        console.log("Executing onEnterFunctionName:", locationData.onEnterFunctionName);
        window[locationData.onEnterFunctionName]();
    }

    let descriptionText = "";
    if (typeof locationData.description === 'function') {
        descriptionText = locationData.description();
    } else {
        descriptionText = locationData.description;
    }
    console.log("Description text to display:", descriptionText ? descriptionText.substring(0,100) + "..." : "EMPTY");

    typeWriterEffect(gameOutputEl, descriptionText, 10, () => {
        console.log("Typewriter effect completed for location description.");
        if (player.companion && storyTexts.companionComments[player.companion.id]) {
            const commentsForLocation = storyTexts.companionComments[player.companion.id][locationId];
            const generalComment = storyTexts.companionComments[player.companion.id].onNewLocation;
            if (commentsForLocation && commentsForLocation.length > 0) {
                const companionComment = commentsForLocation[getRandomInt(0, commentsForLocation.length - 1)];
                addLog("game", `${player.companion.name}: ${companionComment}`, "info-color");
            } else if (generalComment && generalComment.length > 0 && gameOutputEl.innerHTML.includes(descriptionText.substring(0,50))) {
                const companionComment = generalComment[getRandomInt(0, generalComment.length - 1)];
                addLog("game", `${player.companion.name}: ${companionComment}`, "info-color");
            }
        }

        if (locationData.choices && locationData.choices.length > 0) {
            console.log("Processing choices for location:", locationId);
            locationData.choices.forEach(choice => {
                let displayChoice = true;
                let choiceText = typeof choice.text === 'function' ? choice.text() : choice.text;
                let isChoiceDisabled = false;

                if (choice.conditionFunctionName && typeof window[choice.conditionFunctionName] === 'function') {
                    if (!window[choice.conditionFunctionName]()) {
                        if (choice.onFailText) {
                            choiceText = choice.onFailText;
                            isChoiceDisabled = true;
                        } else {
                            displayChoice = false;
                        }
                    }
                }
                if (choice.actionFunctionName === "attemptToFoundBaseAtRedRocket" && playerBase.isFounded) {
                    displayChoice = false;
                }

                if (displayChoice) {
                    const button = document.createElement("button");
                    button.classList.add("main-button");
                    button.innerHTML = choiceText;

                    if (isChoiceDisabled) {
                         button.classList.add("disabled-button");
                         button.disabled = true;
                    } else {
                        button.onclick = () => processChoice(choice);
                    }
                    choicesContainerEl.appendChild(button);
                }
            });
            console.log("Choices processed. Number of choice buttons added:", choicesContainerEl.children.length);
        } else {
            console.log("No choices defined for location:", locationId);
        }

        if (choicesContainerEl.children.length === 0 || Array.from(choicesContainerEl.children).every(btn => btn.disabled && btn.tagName === 'BUTTON')) {
             if (choicesContainerEl.children.length > 0 && Array.from(choicesContainerEl.children).every(btn => btn.disabled && btn.tagName === 'BUTTON')) {
                // Не добавляем "нечего делать", если есть задизейбленные кнопки, т.к. их текст уже информирует.
             } else if (choicesContainerEl.children.length === 0) {
                const p = document.createElement("p");
                p.textContent = "Здесь больше нечего делать.";
                choicesContainerEl.appendChild(p);
            }
        }
    });
}

function processChoice(choiceObject) {
    console.log("Processing choice:", choiceObject);
    const choicesContainerEl = document.getElementById("choices-container");
    if (choicesContainerEl) choicesContainerEl.innerHTML = "";

    let actionTaken = false;
    let actionResultIsScreenChange = false;

    if (choiceObject.actionFunctionName && typeof window[choiceObject.actionFunctionName] === 'function') {
        console.log("Executing action function:", choiceObject.actionFunctionName);
        const result = window[choiceObject.actionFunctionName]();
        if (result === "SCREEN_CHANGED" || result === "LOCATION_CHANGED") {
            actionResultIsScreenChange = true;
        }
        actionTaken = true;
    }

    if (choiceObject.target && !actionResultIsScreenChange) {
        console.log("Moving to target location:", choiceObject.target);
        setCurrentLocation(choiceObject.target);
        actionTaken = true;
        actionResultIsScreenChange = true;
    }

    if (actionTaken && !actionResultIsScreenChange &&
        !combatActive && !terminalHackingActive && !currentMinesweeperGame &&
        document.getElementById("game-main-content")?.classList.contains("active")) {
        console.log("Action taken, no screen/location change, re-rendering current location:", currentLocationId);
        renderLocation(currentLocationId);
    }

    if (!combatActive && !terminalHackingActive && !currentMinesweeperGame && actionTaken) {
        masterGameTick();
    }
}

function setCurrentLocation(newLocationId) {
    console.log("setCurrentLocation called with:", newLocationId);
    if (gameLocations[newLocationId]) {
        const oldLocationId = currentLocationId;
        currentLocationId = newLocationId;
        updateDiscoveredLocations(newLocationId);
        if (oldLocationId !== newLocationId || !document.getElementById("game-output").textContent.trim()) {
            renderLocation(currentLocationId);
        }
        updateMapDisplay();
    } else {
        console.error(`Attempted to move to non-existent location: ${newLocationId}`);
        const gameOutputEl = document.getElementById("game-output");
        if (gameOutputEl) typeWriterEffect(gameOutputEl, `Ошибка: Попытка перейти в несуществующую локацию "${newLocationId}".`);
    }
}


// --- ITEM EFFECT FUNCTIONS ---
function useStimpakEffect(isCombatContext) { player.heal(Math.floor(player.maxHp * 0.3)); addLog(isCombatContext ? "combat" : "game", "Вы использовали Стимулятор.", "player"); return true; }
function useRadawayEffect() { player.reduceRads(250); addLog("game", "Вы использовали Антирадин."); return true; }
function usePurifiedWaterEffect() { player.needs.thirst = Math.max(0, player.needs.thirst - 40); addLog("game", "Вы выпили очищенную воду. Жажда утолена."); updateStatusDisplay(); return true; }
function useDirtyWaterEffect() {
    player.needs.thirst = Math.max(0, player.needs.thirst - 25);
    player.addRads(getRandomInt(5, 15));
    if (Math.random() < 0.1) {
        addLog("game", "Вы выпили грязную воду. Жажда немного отступила, но вы чувствуете себя не очень хорошо. И вы получили дозу радиации.", "warning-color");
    } else {
        addLog("game", "Вы выпили грязную воду. Жажда немного отступила, но вы получили дозу радиации.", "warning-color");
    }
    updateStatusDisplay(); return true;
}
function useCramEffect() { player.needs.hunger = Math.max(0, player.needs.hunger - 30); addLog("game", "Вы съели консервы 'Крэм'. Голод немного отступил."); updateStatusDisplay(); return true; }
function useRadXEffect() {
    addLog("game", "Вы приняли Рад-Х. Ваше сопротивление радиации временно повышено.");
    return true;
}
function useMutantJerkyEffect() {
    player.needs.hunger = Math.max(0, player.needs.hunger - 25);
    player.addRads(getRandomInt(5,15));
    addLog("game", "Вы съели вяленое мясо мутанта. Оно утолило голод, но вы чувствуете легкое недомогание от радиации.");
    updateStatusDisplay();
    return true;
}


// --- DISPLAY UPDATE FUNCTIONS ---
function updateStatusDisplay() {
    document.getElementById("player-hp-status").textContent = player.hp;
    document.getElementById("player-max-hp-status").textContent = player.maxHp;
    document.getElementById("player-ap-status").textContent = player.ap;
    document.getElementById("player-max-ap-status").textContent = player.maxAp;
    document.getElementById("player-level-status").textContent = player.level;

    let conditionText = "Норма"; let conditionClass = "stat-value";
    if (player.hp <= 0) { conditionText = `Выведен из строя`; conditionClass = "stat-value danger-color"; }
    else if (player.hp < player.maxHp * 0.3) { conditionText = `Тяжело ранен`; conditionClass = "stat-value warning-color"; }
    else if (player.hp < player.maxHp * 0.6) { conditionText = `Ранен`; conditionClass = "stat-value"; }
    const playerConditionDisplay = document.getElementById("player-condition");
    playerConditionDisplay.textContent = conditionText; playerConditionDisplay.className = conditionClass;

    document.getElementById("player-rads").textContent = player.rads;
    const playerRadsLevelDisplay = document.getElementById("player-rads-level");
    playerRadsLevelDisplay.textContent = player.radLevel;
    if (player.radLevel === "Нет") playerRadsLevelDisplay.className = "stat-value";
    else if (player.radLevel === "Легкое" || player.radLevel === "Среднее") playerRadsLevelDisplay.className = "stat-value warning-color";
    else playerRadsLevelDisplay.className = "stat-value danger-color";

    document.getElementById("player-stealth-status").textContent = player.isStealthActive ? "Скрыт" : "Обнаружен";
    document.getElementById("player-stealth-status").style.color = player.isStealthActive ? "var(--stealth-color)" : "var(--pipboy-green-medium)";

    Object.keys(player.stats).forEach(key => {
        const statEl = document.getElementById(`stat-${key}`);
        if (statEl) statEl.textContent = player.stats[key];
    });

    Object.keys(player.limbs).forEach(limbId => {
        const limbEl = document.getElementById(`limb-${limbId}`);
        const limbIconEl = limbEl ? limbEl.previousElementSibling.querySelector('.limb-icon') : null;
        if (limbEl && limbIconEl) {
            const limb = player.limbs[limbId];
            limbEl.textContent = limb.status;
            if (limb.status === "Норма") { limbEl.className = "limb-condition limb-ok"; limbIconEl.textContent = "[✓]"; limbIconEl.style.color="var(--pipboy-green-medium)";}
            else if (limb.status === "Легкое ранение" || limb.status === "Тяжелое ранение") { limbEl.className = "limb-condition limb-injured"; limbIconEl.textContent = "[!]"; limbIconEl.style.color="var(--warning-color)";}
            else if (limb.status === "Искалечено") { limbEl.className = "limb-condition limb-crippled"; limbIconEl.textContent = "[X]"; limbIconEl.style.color="var(--danger-color)";}
        }
    });

    document.getElementById("player-xp").textContent = player.xp;
    document.getElementById("player-xp-next").textContent = player.xpToNextLevel;
    document.getElementById("player-caps").textContent = player.caps;

    document.getElementById("current-time").textContent = `${String(currentGameHour).padStart(2, '0')}:${String(currentGameMinute).padStart(2, '0')}`;
    document.getElementById("current-weather").textContent = currentWeather;
}
function updateInventoryDisplay() {
    const lists = {
        weapons: document.getElementById("inventory-weapons-list"),
        apparel: document.getElementById("inventory-apparel-list"),
        aid: document.getElementById("inventory-aid-list"),
        misc: document.getElementById("inventory-misc-list")
    };
    Object.keys(lists).forEach(category => {
        const listElement = lists[category];
        if (!listElement) return;
        listElement.innerHTML = "";
        const items = player.inventory[category];
        if (items.length === 0 && category !== 'apparel') { listElement.innerHTML = "<li>Пусто</li>"; return; }
        if (category === 'apparel' && !items.find(i => i.id === 'vault_suit') && items.length === 0) { listElement.innerHTML = "<li>Нет одежды</li>"; }


        items.forEach(item => {
            const li = document.createElement("li");
            let text = `${item.name} (x${item.quantity})`;
            if (item.equipped) text += " <span style='color: var(--pipboy-green-medium);'>[Экипировано]</span>";
            if (item.weight !== undefined) text += ` (Вес: ${((item.weight || 0) * (item.quantity || 1)).toFixed(2)})`;
            li.innerHTML = text;
            if (category === 'aid' && item.effectFunctionName) {
                const useButton = document.createElement('button');
                useButton.textContent = "Исп."; useButton.style.marginLeft = "10px"; useButton.style.padding = "3px 6px";
                useButton.style.fontSize = "0.85em"; useButton.style.borderWidth = "1px"; useButton.classList.add("main-button");
                useButton.onclick = (e) => {
                    e.stopPropagation();
                    if (item.quantity > 0) {
                        let canUse = true; let apCost = 0;
                        if (combatActive && item.apCost) {
                            apCost = item.apCost;
                            if (player.ap < apCost) { addLog("combat", "Недостаточно ОД!", "system"); canUse = false; }
                        }
                        if (canUse && typeof window[item.effectFunctionName] === 'function') {
                            const success = window[item.effectFunctionName](combatActive);
                            if (success !== false) {
                                if(apCost > 0) player.ap -= apCost;
                                item.quantity--;
                                if (item.quantity <= 0) player.inventory[category] = player.inventory[category].filter(i => !(i.id === item.id && i.uniqueMarker === item.uniqueMarker));
                                updateInventoryDisplay(); updateAllDisplays();
                            }
                        } else if (typeof window[item.effectFunctionName] !== 'function') { console.error("Effect function not found:", item.effectFunctionName); addLog("game", "Ошибка: Действие предмета не найдено.", "system"); }
                    }
                };
                if (item.quantity === 0) useButton.classList.add("disabled-button");
                li.appendChild(useButton);
            }
            listElement.appendChild(li);
        });
    });
    document.getElementById("current-weight").textContent = player.currentCarryWeight.toFixed(2);
    document.getElementById("max-weight").textContent = player.maxCarryWeight;
    const weightElement = document.getElementById("inventory-weight");
    if (player.isOverencumbered) weightElement.classList.add("overencumbered"); else weightElement.classList.remove("overencumbered");

    const stimpakCount = player.inventory.aid.reduce((sum, item) => (item.id === 'stimpak' || item.id.startsWith('stimpak_')) ? sum + (item.quantity || 0) : sum, 0);
    document.getElementById("stimpak-count").textContent = stimpakCount;

    const actionUseStimpakButton = document.getElementById("action-use-stimpak");
    const stimpakItemForButton = player.inventory.aid.find(i => (i.id === 'stimpak' || i.id.startsWith('stimpak_')) && i.quantity > 0);
    actionUseStimpakButton.disabled = !(stimpakItemForButton && (!combatActive || player.ap >= (stimpakItemForButton.apCost || 2)));
    if(actionUseStimpakButton.disabled) actionUseStimpakButton.classList.add("disabled-button"); else actionUseStimpakButton.classList.remove("disabled-button");
}
function addItemToInventory(itemData, category = 'misc') {
    const targetCategoryName = itemData.category || category;
    const targetCategory = player.inventory[targetCategoryName];

    if (!targetCategory) { console.error("Invalid inventory category:", targetCategoryName, itemData); return; }

    const existingItem = !itemData.uniqueMarker ? targetCategory.find(item => item.id === itemData.id && !item.uniqueMarker) : null;

    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 0) + (itemData.quantity || 1);
    } else {
        const baseId = itemData.id.replace(/_instance_.*|_unique_.*|_rr_stash|_vault_hall_locker_1|_dog_found_.*|_springvale_1|_1$/,'');
        const baseItem = allItems[baseId] || allItems[itemData.id] || {};

        const newItem = {
            ...baseItem,
            ...itemData,
            quantity: itemData.quantity || 1,
            category: targetCategoryName
        };
        if (!newItem.name && baseItem.name) newItem.name = baseItem.name;
        if (newItem.name === undefined) newItem.name = newItem.id;

        targetCategory.push(newItem);
    }
    updateInventoryDisplay();
}
function updateDataDisplay() {
    const questListEl = document.getElementById("quest-list"); questListEl.innerHTML = "";
    if (player.quests.length === 0) questListEl.innerHTML = "<li>Нет активных заданий.</li>";
    else player.quests.forEach(quest => {
        const listItem = document.createElement("li");
        listItem.innerHTML = `${quest.status === "active" ? "◆" : "✓"} ${quest.name}: <span style="font-size:0.9em; color:var(--pipboy-green-medium);">${quest.description}</span>`;
        if (quest.status === "active") listItem.classList.add("quest-active");
        if (quest.status === "completed") listItem.classList.add("quest-completed");
        questListEl.appendChild(listItem);
    });
    updateHolodiskDisplay(); updateReputationDisplay();
}
function updateHolodiskDisplay() {
    const holodiskListEl = document.getElementById("holodisk-list"); holodiskListEl.innerHTML = "";
    if (player.foundHolodisks.length === 0) holodiskListEl.innerHTML = "<li>Нет найденных записей.</li>";
    else player.foundHolodisks.forEach(diskId => {
        const diskData = storyTexts.holodiskContents[diskId];
        if (diskData) {
            const listItem = document.createElement("li");
            listItem.textContent = diskData.title; listItem.style.cursor = "pointer";
            listItem.onclick = () => {
                const gameOutputEl = document.getElementById("game-output");
                const choicesContainerEl = document.getElementById("choices-container");
                if (gameOutputEl && choicesContainerEl) {
                    showTab("game");
                    choicesContainerEl.innerHTML = "";
                    typeWriterEffect(gameOutputEl, `--- ${diskData.title} ---\n${diskData.content.replace(/\n/g, '<br>')}\n--- Конец записи ---`, 10, () => {
                        const backButton = document.createElement("button");
                        backButton.classList.add("main-button");
                        backButton.textContent = "Закрыть запись";
                        backButton.onclick = () => renderLocation(currentLocationId);
                        choicesContainerEl.appendChild(backButton);
                    });
                }
            };
            holodiskListEl.appendChild(listItem);
        }
    });
}
function updateReputationDisplay() {
    const reputationListEl = document.getElementById("reputation-list"); reputationListEl.innerHTML = "";
    let hasReputation = false;
    for (const factionId in player.reputation) {
        hasReputation = true; let factionName = factionId;
        if (factionId === "settlers") factionName = "Поселенцы";
        else if (factionId === "scavengers") factionName = "Мусорщики";
        else if (factionId === "brotherhood_outpost") factionName = "Братство (Аванпост)";
        const repValue = player.reputation[factionId]; let repStatusText = "Нейтрально"; let repClass = "stat-value";
        let repStyle = "";
        if (repValue <= -50) { repStatusText = "Враждебно"; repClass = "danger-color"; }
        else if (repValue <= -10) { repStatusText = "Недружелюбно"; repClass = "warning-color"; }
        else if (repValue >= 50) { repStatusText = "Союзник"; repStyle = "style='color:#66ff66;'"; }
        else if (repValue >= 10) { repStatusText = "Дружелюбно"; }
        const listItem = document.createElement("li"); listItem.classList.add("reputation-item");
        listItem.innerHTML = `<span>${factionName}</span> <span class="${repClass}" ${repStyle}>${repStatusText} (${repValue})</span>`;
        reputationListEl.appendChild(listItem);
    }
    if (!hasReputation) reputationListEl.innerHTML = "<li>Нет данных о репутации.</li>";
}
function addQuest(newQuest) {
    if (!player.quests.find(q => q.id === newQuest.id)) {
        player.quests.push(newQuest); updateDataDisplay();
        addLog("game", `Новое задание: ${newQuest.name}`, "item");
        if (newQuest.journalEntry) unlockPlotEntry(newQuest.journalEntry);
    }
}
function completeQuest(questId) {
    const quest = player.quests.find(q => q.id === questId);
    if (quest && quest.status !== "completed") {
        quest.status = "completed"; updateDataDisplay();
        addLog("game", `Задание выполнено: ${quest.name}`, "item");
        player.addXp(getRandomInt(50,100));
        if (quest.unlocksPlotEntryOnComplete) unlockPlotEntry(quest.unlocksPlotEntryOnComplete);
        if (quest.reward) {
            if (quest.reward.caps) { player.caps += quest.reward.caps; addLog("game", `Получено ${quest.reward.caps} крышек.`, "item"); }
            if (quest.reward.items) {
                quest.reward.items.forEach(itemRef => {
                    const itemToAddTemplate = allItems[itemRef.id];
                    if (itemToAddTemplate) {
                         addItemToInventory(
                            {...itemToAddTemplate, id: itemRef.id, quantity: itemRef.quantity || 1},
                            itemToAddTemplate.category || 'misc'
                        );
                        addLog("game", `Получено: ${itemToAddTemplate.name} (x${itemRef.quantity || 1})`, "item");
                    } else {
                        addLog("game", `Попытка добавить несуществующий предмет в награду: ${itemRef.id}`, "system");
                    }
                });
            }
            if (quest.reward.reputation) {
                player.changeReputation(quest.reward.reputation.factionId, quest.reward.reputation.amount);
            }
        }
        updateAllDisplays();
    }
}
function updateMapDisplay() {
    const discoveredLocationsListEl = document.getElementById("discovered-locations-list");
    discoveredLocationsListEl.innerHTML = "";
    if (player.discoveredLocations.length > 0) {
        document.getElementById("map-status").textContent = "Загружены данные о ближайших локациях.";
        player.discoveredLocations.forEach(locId => {
            const locData = gameLocations[locId];
            if (locData) {
                const listItem = document.createElement("li");
                listItem.textContent = `${locData.mapIcon || "●"} ${locData.name}`;
                if (locId === currentLocationId) listItem.style.color = "var(--pipboy-green-bright)";
                discoveredLocationsListEl.appendChild(listItem);
            }
        });
    } else {
        document.getElementById("map-status").textContent = "Данные карты не найдены.";
    }
    const currentLocMapNameEl = document.getElementById("current-location-map-name");
    if (gameLocations[currentLocationId]) {
        currentLocMapNameEl.textContent = gameLocations[currentLocationId].name;
    } else {
        currentLocMapNameEl.textContent = "Неизвестно";
    }
    document.getElementById("local-map-display").innerHTML = "<p>Карта текущей локации недоступна (не реализовано).</p>";
}
function updateDiscoveredLocations(locationId) { // Это глобальная функция
    if (!player.discoveredLocations.includes(locationId)) {
        player.discoveredLocations.push(locationId);
        const locName = gameLocations[locationId] ? gameLocations[locationId].name : locationId;
        addLog("game", `Открыта новая локация: ${locName}`, "info-color");
        updateMapDisplay();
    }
}
function updatePerksDisplay() {
    const perksListDisplay = document.getElementById("perks-list");
    const perkPointsDisplay = document.getElementById("perk-points");
    perksListDisplay.innerHTML = ""; perkPointsDisplay.textContent = player.perkPoints;
    availablePerks.forEach(perk => {
        const li = document.createElement("li"); li.classList.add("perk-item");
        if (player.hasPerk(perk.id)) li.classList.add("owned");
        let requirementsMet = true; let reqTextParts = [];
        if (perk.requires) {
            if (perk.requires.level && player.level < perk.requires.level) { requirementsMet = false; reqTextParts.push(`УР:${perk.requires.level}`); }
            Object.keys(perk.requires).forEach(statKey => {
                if (statKey !== 'level' && player.stats[statKey] < perk.requires[statKey]) { requirementsMet = false; reqTextParts.push(`${statKey.toUpperCase()}:${perk.requires[statKey]}`); }
            });
        }
        const reqText = reqTextParts.length > 0 ? ` (Треб: ${reqTextParts.join(', ')})` : "";
        li.innerHTML = `<h4>${perk.name}${player.hasPerk(perk.id) ? " <span style='color:var(--pipboy-green-medium)'>[ИЗУЧЕНО]</span>" : ""}</h4><p>${perk.description}${!player.hasPerk(perk.id) ? reqText : ""}</p>`;
        if (!player.hasPerk(perk.id)) {
            const learnButton = document.createElement("button"); learnButton.textContent = "Изучить (1 ОП)"; learnButton.classList.add("main-button");
            learnButton.style.marginTop = "8px"; learnButton.style.fontSize = "0.9em"; learnButton.style.padding = "6px 10px";
            if (player.perkPoints >= (perk.cost || 1) && requirementsMet) learnButton.onclick = () => player.learnPerk(perk.id);
            else { learnButton.classList.add("disabled-button"); learnButton.textContent = requirementsMet ? "Нет ОП" : "Недоступно"; }
            li.appendChild(learnButton);
        }
        perksListDisplay.appendChild(li);
    });
}
function updatePlotJournalDisplay() {
    const plotJournalDisplay = document.getElementById("plot-journal");
    if (!plotJournalDisplay) return;
    plotJournalDisplay.innerHTML = "";
    const unlockedEntries = storyTexts.plotJournalEntries.filter(entry => entry.unlocked);
    if (unlockedEntries.length === 0) plotJournalDisplay.innerHTML = "<p>Сюжетный журнал пуст.</p>";
    else unlockedEntries.forEach(entry => {
        const entryDiv = document.createElement("div");
        entryDiv.innerHTML = `<h4>${entry.title}</h4><p>${entry.text.replace(/\n/g, '<br>')}</p><hr style="border-color: var(--pipboy-green-darker); margin:10px 0;">`;
        plotJournalDisplay.appendChild(entryDiv);
    });
}

// --- LOCATION ACTIONS ---
function inspectVaultDoor() { addLog("game", "Это стандартная дверь Убежища класса 'Циклоп'. Без питания или ручного обхода она не откроется."); return "NO_SCREEN_CHANGE"; }
function approachVaultTerminal() {
    const term = terminals["vault_door_terminal"];
    if (!term.lockedOut) {
        startTerminalHacking("vault_door_terminal");
        return "SCREEN_CHANGED";
    } else {
        addLog("game",`Терминал управления дверью ЗАБЛОКИРОВАН еще на ${Math.ceil(term.lockoutTimeLeft / TICKS_PER_GAME_HOUR)} ч.`);
        return "NO_SCREEN_CHANGE";
    }
}
function isVaultTerminalNotLocked() { return !terminals["vault_door_terminal"].lockedOut; } // Это условие теперь менее полезно, т.к. текст кнопки меняется
function canPickOverseerLock() { return player.inventory.misc.find(i => i.id === 'bobby_pin')?.quantity > 0 && player.skills.lockpick >= 25; }
function tryPickOverseerLock() {
    if (player.skills.lockpick >= 25) {
         addLog("game", "Вы пытаетесь вскрыть замок в комнату Смотрителя... *щелк* Замок поддался!", "item");
         player.addXp(15);
         const bobbyPinItem = player.inventory.misc.find(i => i.id === 'bobby_pin');
         if (bobbyPinItem) {
            bobbyPinItem.quantity--;
            if (bobbyPinItem.quantity <= 0) player.inventory.misc = player.inventory.misc.filter(p => p.id !== 'bobby_pin');
         }
         gameLocations["vault_entrance_hall"].customFlags.overseerRoomUnlocked = true;
         // Не вызываем renderLocation здесь, processChoice сделает это, если NO_SCREEN_CHANGE
         return "NO_SCREEN_CHANGE";
    } else {
        addLog("game", "Вы пытаетесь ковыряться в замке заколкой, но он слишком сложен для ваших навыков.");
        return "NO_SCREEN_CHANGE";
    }
}
function searchOverseerDesk() {
    const locData = gameLocations["overseer_office"];
    addLog("game", "Вы обыскиваете стол и полки в кабинете Смотрителя...");
    let foundSomething = false;
    if (!locData.customFlags.keyCardFound && Math.random() < 0.5) {
        addItemToInventory({...allItems["overseer_keycard"], id:"overseer_keycard_found", uniqueMarker: true}, "misc"); // Делаем ID уникальным
        addLog("game", "Найдена ключ-карта Смотрителя!", "item");
        locData.customFlags.keyCardFound = true;
        foundSomething = true;
    }
    if (Math.random() < 0.3) {
        addItemToInventory({...allItems.scrap_metal, quantity: getRandomInt(1,3), id: `scrap_overseer_${Date.now()}`, uniqueMarker: true}, "misc");
        addLog("game", "Найден металлолом.", "item");
        foundSomething = true;
    }
    if (!foundSomething) {
        addLog("game", "Ничего особенно ценного не найдено.");
    }
    locData.customFlags.deskSearched = true;
    return "NO_SCREEN_CHANGE";
}

function approachOverseerTerminal() {
    const term = terminals["overseer_terminal"];
    if (!term.lockedOut) {
        startTerminalHacking("overseer_terminal");
        return "SCREEN_CHANGED";
    } else {
        addLog("game",`Терминал Смотрителя ЗАБЛОКИРОВАН еще на ${Math.ceil(term.lockoutTimeLeft / TICKS_PER_GAME_HOUR)} ч.`);
        return "NO_SCREEN_CHANGE";
    }
}
function tryPickOverseerSafe() {
    const locData = gameLocations["overseer_office"];
    const overseerSafeCode = "2077";

    if (locData.customFlags.safeOpened) {
        addLog("game", "Сейф уже открыт и пуст.");
        return "NO_SCREEN_CHANGE";
    }

    const hasKeyCard = player.inventory.misc.find(i => i.id === "overseer_keycard_found"); // Проверяем найденную карту
    const knowsCodeFromTerminal = terminals["overseer_terminal"].customFlags?.securityLogRead; // Если прочитал протоколы

    if (hasKeyCard) {
        addLog("game", "Вы используете ключ-карту Смотрителя. Сейф со щелчком открывается!", "item");
    } else if (knowsCodeFromTerminal && prompt(`Вы знаете код (${overseerSafeCode}) из терминала. Ввести его? (да/нет)`)?.toLowerCase() === 'да') {
        addLog("game", "Код из терминала подошел! Сейф открыт.", "item");
    } else if (player.skills.lockpick >= 40) {
        addLog("game", "Вы умело вскрываете сложный замок сейфа!", "item");
    } else if (prompt(`Введите код для сейфа (или нажмите Отмена для попытки взлома, ${player.skills.lockpick}/40):`) === overseerSafeCode) {
        addLog("game", "Код подошел! Сейф открыт.", "item");
    } else if (player.skills.lockpick >= 25 && player.inventory.misc.find(i => i.id === 'bobby_pin')?.quantity > 0) {
        addLog("game", "Вы пытаетесь взломать сейф заколкой... *щелк* Замок поддался!", "item");
        const bobbyPin = player.inventory.misc.find(i => i.id === 'bobby_pin');
        if (bobbyPin) bobbyPin.quantity--;
        if (bobbyPin && bobbyPin.quantity <= 0) player.inventory.misc = player.inventory.misc.filter(p => p.id !== 'bobby_pin');
    } else {
        addLog("game", "Сейф слишком сложен для ваших навыков взлома, и вы не знаете код или у вас нет ключ-карты.");
        return "NO_SCREEN_CHANGE";
    }

    player.addXp(50);
    addItemToInventory({...allItems["10mm_pistol"], quantity: 1, id: "10mm_pistol_overseer_safe", uniqueMarker: true}, "weapons");
    addItemToInventory({...allItems["10mm_ammo_rounds"], quantity: getRandomInt(10,20), id: "10mm_ammo_overseer_safe", uniqueMarker: true}, "misc");
    addItemToInventory({...allItems.stimpak, quantity: 2, id: "stimpak_overseer_safe", uniqueMarker: true}, "aid");
    addLog("game", "В сейфе найдены: 10мм Пистолет, патроны и стимуляторы!", "item");
    locData.customFlags.safeOpened = true;
    return "NO_SCREEN_CHANGE";
}

function onEnterOverseerOffice() {
    updateDiscoveredLocations("overseer_office");
    // Можно добавить описание при первом входе
}
function searchLockersVaultHall() {
    const locationData = gameLocations["vault_entrance_hall"]; let itemsFoundLog = "";
    if (!locationData.customFlags) locationData.customFlags = {};

    if (locationData.collectables) locationData.collectables.forEach(collectable => {
        if (!collectable.isCollected) {
            if (collectable.type === "holodisk") player.collectHolodisk(collectable.id);
            collectable.isCollected = true;
            itemsFoundLog += (itemsFoundLog.length > 0 ? ", " : "") + collectable.name;
        }
    });

    const stimpakUniqueId = "stimpak_vault_hall_locker_1";
    const bobbyPinUniqueId = "bobby_pin_vault_hall_locker_1";
    let foundThisTime = false;

    if (!locationData.customFlags[stimpakUniqueId]) {
        addItemToInventory({ ...allItems.stimpak, id: stimpakUniqueId, quantity: 1, uniqueMarker:true }, 'aid');
        itemsFoundLog += (itemsFoundLog.length > 0 ? ", " : "") + "Стимулятор";
        locationData.customFlags[stimpakUniqueId] = true;
        foundThisTime = true;
    }
    if (!locationData.customFlags[bobbyPinUniqueId]) {
        addItemToInventory({ ...allItems.bobby_pin, id: bobbyPinUniqueId, quantity: 2, uniqueMarker:true }, 'misc');
        itemsFoundLog += (itemsFoundLog.length > 0 ? ", " : "") + "Заколки (2)";
        locationData.customFlags[bobbyPinUniqueId] = true;
        foundThisTime = true;
    }

    if (itemsFoundLog.length > 0) {
        addLog("game", `В шкафчиках найдено: ${itemsFoundLog}!`, "item");
    } else if (!foundThisTime && locationData.customFlags[stimpakUniqueId] && locationData.customFlags[bobbyPinUniqueId] && (!locationData.collectables || locationData.collectables.every(c => c.isCollected))) {
        addLog("game", "Шкафчики уже пусты.");
    } else if (!foundThisTime) {
        addLog("game", "Шкафчики пусты.");
    }
    return "NO_SCREEN_CHANGE";
}
function onEnterVaultHall() {
    updateDiscoveredLocations("vault_entrance_hall");
    const locationData = gameLocations["vault_entrance_hall"];
    if (locationData.collectables) locationData.collectables.forEach(collectable => {
        if (!collectable.isCollected && collectable.type === "holodisk" && Math.random() < 0.3) addLog("game", `Вы замечаете ${collectable.name.toLowerCase()} на консоли.`);
    });
}
function lookAroundWasteland() { addLog("game", "Вдалеке виднеются руины небольшого городка. Отсюда туда ведет старая дорога. На западе - заправка 'Красная Ракета'."); return "NO_SCREEN_CHANGE"; }
function canReturnToVault() { return gameLocations["vault_entrance_hall"].customFlags.isDoorOpen || false; }
function onEnterWastelandNearVault() {
    const mainQuest = player.quests.find(q => q.id === "main_quest_1");
    if(mainQuest && mainQuest.status === "active") completeQuest("main_quest_1");
    unlockPlotEntry("entry_002_first_steps");
    addQuest({ id: "explore_wasteland", name: "Первые шаги", description: "Исследовать ближайшие окрестности Убежища.", status: "active", unlocksPlotEntryOnComplete: "entry_003_springvale_contact" });
    updateDiscoveredLocations("wasteland_near_vault");
    if (gameLocations["wasteland_near_vault"].radExposure) player.addRads(gameLocations["wasteland_near_vault"].radExposure);
}
function searchRedRocketStation() {
    let foundSomething = false;
    const locData = gameLocations["red_rocket_station"];
    if (!locData.customFlags) locData.customFlags = {};

    const scrapUniqueId = "scrap_rr_1";
    const wrenchUniqueId = "wrench_rr_1";

    if (!locData.customFlags[scrapUniqueId]) {
        if (Math.random() < 0.4) {
            addItemToInventory({...(allItems["scrap_metal"] || {id:"scrap_metal", name:"Металлолом", weight:0.5}), quantity:getRandomInt(1,2), id: scrapUniqueId, uniqueMarker: true}, 'misc');
            addLog("game", "Вы нашли немного металлолома.", "item");
            foundSomething = true;
            locData.customFlags[scrapUniqueId] = true;
        }
    }
    if (!locData.customFlags[wrenchUniqueId]) {
        if (Math.random() < 0.2) {
            addItemToInventory({id: wrenchUniqueId, name:"Гаечный ключ", weight:1, uniqueMarker:true}, "misc");
            addLog("game", "Найден старый гаечный ключ!", "item");
            foundSomething = true;
            locData.customFlags[wrenchUniqueId] = true;
        }
    }

    if (locData.customFlags.terminalHacked && !locData.customFlags.stashLooted) {
        addLog("game", "Вы вспоминаете про тайник, открытый терминалом...", "info-color");
        addItemToInventory({...(allItems["stimpak"] || {id:"stimpak", name:"Стимулятор", effectFunctionName:"useStimpakEffect", apCost:2, weight:0.1}), id:"stimpak_rr_stash", quantity:1, uniqueMarker:true}, "aid");
        addItemToInventory({...(allItems["10mm_ammo_rounds"] || {id:"10mm_ammo_rounds", name:"10мм патроны", weight:0.1}), id:"10mm_ammo_rr_stash", quantity:getRandomInt(5,10), uniqueMarker:true}, "misc");
        addLog("game", "В тайнике найдены стимулятор и патроны!", "item");
        locData.customFlags.stashLooted = true;
        foundSomething = true;
    }

    if (!foundSomething && (locData.customFlags[scrapUniqueId] || locData.customFlags[wrenchUniqueId]) && (!locData.customFlags.terminalHacked || locData.customFlags.stashLooted)) {
        addLog("game", "Здесь больше ничего нет.");
    } else if (!foundSomething && !locData.customFlags[scrapUniqueId] && !locData.customFlags[wrenchUniqueId] && !locData.customFlags.terminalHacked) {
         addLog("game", "Кажется, здесь пусто.");
    }
    return "NO_SCREEN_CHANGE";
}
function isDogAtRedRocketNotYetFriend() { return !gameLocations["red_rocket_station"].customFlags.dogFound && !player.companion; }
function approachDogAtRedRocket() {
    addLog("game", "Собака смотрит на вас, виляя хвостом. Кажется, она не агрессивна.");
    const loc = gameLocations["red_rocket_station"];
    const approachChoiceIndex = loc.choices.findIndex(c => c.actionFunctionName === "approachDogAtRedRocket");
    if (approachChoiceIndex !== -1) {
        loc.choices.splice(approachChoiceIndex, 1,
            { text: "Попытаться подружиться с собакой (Харизма 5 / Друг Животных)", actionFunctionName: "tryBefriendDog" },
            { text: "Оставить собаку в покое", actionFunctionName: "leaveDogAlone" }
        );
        renderLocation(currentLocationId);
    }
    return "NO_SCREEN_CHANGE";
}
function tryBefriendDog() {
    if (player.stats.c >= 5 || player.hasPerk("animal_friend_1")) {
        addLog("game", "Собака радостно подбегает к вам и трется о ноги. Вы нашли верного друга!", "item");
        const dogNPCTemplate = gameNpcData.dogmeat_companion;
        player.companion = JSON.parse(JSON.stringify(dogNPCTemplate.companionDetails));
        gameLocations["red_rocket_station"].customFlags.dogFound = true;
        unlockPlotEntry("entry_004_dogmeat_found");
        addLog("game", `Псина теперь ваш компаньон! Откройте вкладку "COMP" для взаимодействия.`);
        player.changeReputation("scavengers", 5);
        const loc = gameLocations["red_rocket_station"];
        loc.choices = loc.choices.filter(c => c.actionFunctionName !== "tryBefriendDog" && c.actionFunctionName !== "leaveDogAlone");
        const collarNote = loc.collectables.find(c => c.id === "dog_collar_note");
        if (collarNote && collarNote.requiresDogFound && !collarNote.isCollected) {
            addLog("game", "Вы замечаете старую записку, прикрепленную к ошейнику Псины.");
            player.collectHolodisk(collarNote.id);
            collarNote.isCollected = true;
        }
        updateCompanionTab();
    } else {
        addLog("game", "Собака рычит и отбегает. Кажется, вы ей не понравились.");
        player.changeReputation("scavengers", -2);
    }
    renderLocation(currentLocationId);
    return "NO_SCREEN_CHANGE";
}
function leaveDogAlone() {
    addLog("game", "Вы решаете не беспокоить собаку.");
    const loc = gameLocations["red_rocket_station"];
    loc.choices = loc.choices.filter(c => c.actionFunctionName !== "tryBefriendDog" && c.actionFunctionName !== "leaveDogAlone");
    if (!loc.choices.find(c=> c.actionFunctionName === "approachDogAtRedRocket")) {
        loc.choices.splice(1,0, { text: "Подойти к собаке", conditionFunctionName: "isDogAtRedRocketNotYetFriend", actionFunctionName: "approachDogAtRedRocket" });
    }
    renderLocation(currentLocationId);
    return "NO_SCREEN_CHANGE";
}
function isRedRocketTerminalAvailable() { return !terminals["red_rocket_terminal"].customFlags?.hackedSuccessfully && !terminals["red_rocket_terminal"].lockedOut; }
function approachRedRocketTerminal() {
    const term = terminals["red_rocket_terminal"];
    if (player.skills.science >= term.skillDC || player.hasPerk("hacker_1")) {
        startTerminalHacking("red_rocket_terminal");
        return "SCREEN_CHANGED";
    } else {
        addLog("game", `Этот терминал слишком сложен для ваших навыков (${player.skills.science}/${term.skillDC} Науки).`);
        return "NO_SCREEN_CHANGE";
    }
}
function onSuccessRedRocketTerminal() {
    addLog("game", "Терминал: Доступ получен. Система безопасности 'Красной Ракеты' частично деактивирована.", "item");
    terminals["red_rocket_terminal"].customFlags.hackedSuccessfully = true; // Новый флаг
    gameLocations["red_rocket_station"].customFlags.trapDisarmed = true; // Обезвреживаем ловушку на складе
    addLog("game", "На терминале также указано расположение небольшого тайника с припасами на складе.", "info-color");
    // Не нужно вызывать renderLocation, т.к. _exitTerminalHacking это сделает
    return "NO_SCREEN_CHANGE";
}
function enterRedRocketStorage() {
    const locData = gameLocations["red_rocket_station"];
    if (locData.hasTrap && !locData.customFlags.trapDisarmed) {
        addLog("game", "Вы замечаете натянутую леску у входа на склад... Это ловушка!", "warning-color");
        const storageChoice = locData.choices.find(c => c.actionFunctionName === "enterRedRocketStorage");
        if (storageChoice) {
            storageChoice.text = "Попытаться обезвредить ловушку на складе";
            storageChoice.actionFunctionName = "tryDisarmRedRocketTrap";
            renderLocation(currentLocationId);
        }
        return "NO_SCREEN_CHANGE";
    }
    addLog("game", "Вы входите на склад. Здесь темно и пахнет старым маслом.");
    if (!locData.customFlags.storageLooted) {
        let foundStorageLoot = false;
        if (Math.random() < 0.3 && !locData.customFlags.storage_scrap_looted) {
           addItemToInventory({...(allItems["scrap_metal"] || {id:"scrap_metal", name:"Металлолом", weight:0.5}), quantity:1, id: "scrap_rr_storage_1", uniqueMarker: true}, 'misc');
           addLog("game", "На полке найден кусок металлолома.", "item");
           locData.customFlags.storage_scrap_looted = true;
           foundStorageLoot = true;
        }
        if (locData.customFlags.terminalHacked && !locData.customFlags.stashLooted) {
            searchRedRocketStation(); // Эта функция теперь только для тайника
        }
        if (!foundStorageLoot && !(locData.customFlags.terminalHacked && !locData.customFlags.stashLooted)) {
           if (!locData.customFlags.storage_scrap_looted) addLog("game", "Кажется, здесь больше ничего ценного нет.");
        }
        locData.customFlags.storageLooted = true;
    } else if (locData.customFlags.terminalHacked && !locData.customFlags.stashLooted) {
        searchRedRocketStation();
    }
    else {
         addLog("game", "Вы уже обыскивали этот склад.");
    }

    const choiceToUpdate = locData.choices.find(c => c.actionFunctionName === "tryDisarmRedRocketTrap" || c.actionFunctionName === "enterRedRocketStorage");
    if (choiceToUpdate) {
        choiceToUpdate.text = "Осмотреть складское помещение";
        choiceToUpdate.actionFunctionName = "enterRedRocketStorage";
    }
    return "NO_SCREEN_CHANGE";
}
function tryDisarmRedRocketTrap() {
    const trapData = gameLocations["red_rocket_station"].trap;
    if (player.hasPerk("light_step_1")) {
        addLog("game", "Благодаря 'Легкому шагу', вы аккуратно обходите ловушку, не активировав её!", "item");
        gameLocations["red_rocket_station"].customFlags.trapDisarmed = true;
        player.addXp(15);
        const storageChoice = gameLocations["red_rocket_station"].choices.find(c => c.actionFunctionName === "tryDisarmRedRocketTrap");
        if (storageChoice) {
            storageChoice.text = "Войти на склад (ловушка обезврежена)";
            storageChoice.actionFunctionName = "enterRedRocketStorage";
        }
        renderLocation(currentLocationId);
        return "NO_SCREEN_CHANGE";
    }
    startMinesweeperGame(trapData.difficulty, trapData.damage);
    return "SCREEN_CHANGED";
}
function onEnterRedRocket() {
    updateDiscoveredLocations("red_rocket_station");
    if(gameLocations["red_rocket_station"].radExposure) player.addRads(gameLocations["red_rocket_station"].radExposure);
    const locData = gameLocations["red_rocket_station"];
    if (locData.collectables) locData.collectables.forEach(collectable => {
        if (!collectable.isCollected && collectable.id === "dog_collar_note" && collectable.requiresDogFound && locData.customFlags.dogFound && player.companion && player.companion.id === "dogmeat") {
            addLog("game", `Вы замечаете ${collectable.name.toLowerCase()}, прикрепленную к ошейнику Псины.`);
            player.collectHolodisk(collectable.id);
            collectable.isCollected = true;
        }
    });
}
function searchSpringvaleRuins() {
    const junkUniqueId = "scrap_springvale_1";
    const locData = gameLocations["ruined_town_outskirts"];
    if (!locData.customFlags) locData.customFlags = {};

    if (!locData.customFlags[junkUniqueId]) {
        addItemToInventory({...(allItems["scrap_metal"] || {id:"scrap_metal", name:"Металлолом", weight:0.5}), quantity: getRandomInt(2,4), id: junkUniqueId, uniqueMarker: true}, "misc");
        addLog("game", "Вы нашли немного металлолома.", "item");
        player.changeReputation("scavengers", 1);
        locData.customFlags[junkUniqueId] = true;
    } else { addLog("game", "Больше ничего ценного в этих руинах нет."); }

    if (player.hasPerk("scrounger_1") && Math.random() < 0.25 && !locData.customFlags["scrounger_springvale_1"]) {
        const ammoTypes = ["10mm_ammo_rounds", "shotgun_shells_ammo"];
        const foundAmmoId = ammoTypes[getRandomInt(0, ammoTypes.length - 1)];
        const qty = getRandomInt(3,8);
        const ammoTemplate = allItems[foundAmmoId] || {id: foundAmmoId, name: foundAmmoId.replace("_ammo","") + " патроны", weight:0.01 * qty, type:"ammo"};
        addItemToInventory({...ammoTemplate, quantity:qty, id: `scrounged_${foundAmmoId}_springvale_1`, uniqueMarker: true }, "misc");
        addLog("game", `Благодаря чутью кладоискателя, вы нашли ${qty} ${ammoTemplate.name}!`, "item");
        locData.customFlags["scrounger_springvale_1"] = true;
    }
    return "NO_SCREEN_CHANGE";
}
function trySneakPastSpringvaleRuins() {
    const baseDetectionChance = 30;
    let detectionChance = baseDetectionChance - player.skills.stealth - (player.stats.a * 2);
    if (player.isOverencumbered) detectionChance += 20;
    if (currentWeather === "Пыльная буря" || (isNightTime() && currentWeather !== "Ясно")) detectionChance -= 15;

    if (getRandomInt(1, 100) > Math.max(5, detectionChance)) {
        addLog("game", "Вам удалось незаметно проскользнуть мимо основных руин.", "stealth-color");
        player.addXp(10);
    } else {
        addLog("game", "Вас заметили! Из руин доносится враждебный крик! (Событие/бой пока не реализованы)", "danger-color");
    }
    return "NO_SCREEN_CHANGE";
}
function onEnterSpringvaleOutskirts() {
    updateDiscoveredLocations("ruined_town_outskirts");
    if(gameLocations["ruined_town_outskirts"].radExposure) player.addRads(gameLocations["ruined_town_outskirts"].radExposure);
    const locationData = gameLocations["ruined_town_outskirts"];
    if (locationData.collectables) locationData.collectables.forEach(collectable => {
        if (!collectable.isCollected && collectable.type === "holodisk" && Math.random() < 0.4) addLog("game", `Вы замечаете ${collectable.name.toLowerCase()} среди обломков.`);
    });
}
function enterSpringvaleStore() { setCurrentLocation("springvale_store_interior"); return "LOCATION_CHANGED"; }
function peekSpringvaleStoreWindow() {
    const joe = gameNpcData.settler_store;
    if (player.stats.p >= 6 || player.hasPerk("awareness")) addLog("game", `Вы видите человека (${joe.name}) внутри, он не выглядит враждебным, но вооружен простым ружьем.`);
    else addLog("game", "Окно слишком грязное, ничего не разглядеть.");
    return "NO_SCREEN_CHANGE";
}
function onEnterSpringvaleStoreEntrance() { updateDiscoveredLocations("springvale_store_entrance");}
function askJoeAboutPlace() {
    const joe = gameNpcData.settler_store;
    if (joe.attitude === "hostile") addLog("game", `${joe.name} атакует! (Бой с NPC не реализован)`);
    else addLog("game", `Джо: ${storyTexts.npcDialogues.joeTheSettler.aboutPlace}`);
    return "NO_SCREEN_CHANGE";
}
function isJoeFriendly() { return gameNpcData.settler_store.attitude !== "hostile"; }
function tradeWithJoe() { addLog("game", `Джо: ${storyTexts.npcDialogues.joeTheSettler.tradeOffer} (Механика торговли не реализована)`); return "NO_SCREEN_CHANGE";}
function askJoeAboutWasteland() {
    if (player.stats.c >= 5 || player.skills.speech >= 30) {
        addLog("game", `Джо: ${storyTexts.npcDialogues.joeTheSettler.wastelandInfoSuccess}`);
        if (!player.quests.find(q=>q.id === "power_plant_rumor")) addQuest({id: "power_plant_rumor", name: "Слухи об электростанции", description: "Проверить слухи о старой электростанции на севере.", status: "active"});
        player.changeReputation("settlers", 2);
    } else addLog("game", `Джо: ${storyTexts.npcDialogues.joeTheSettler.wastelandInfoFail}`);
    return "NO_SCREEN_CHANGE";
}
function askJoeAboutDistressSignal() {
    addLog("game", `Джо: ${storyTexts.npcDialogues.joeTheSettler.distressSignalLead}`);
    if (!player.quests.find(q => q.id === "distress_signal_investigation")) {
        addQuest({
            id: "distress_signal_investigation",
            name: "Сигнал Бедствия",
            description: "Расследовать источник слабого сигнала, который поймал Джо.",
            status: "active",
            journalEntry: "entry_007_distress_signal"
        });
        unlockPlotEntry("entry_007_distress_signal"); // Также разблокируем запись
    }
    const loc = gameLocations["springvale_store_interior"];
    loc.choices = loc.choices.filter(c => c.actionFunctionName !== "askJoeAboutDistressSignal");
    renderLocation(currentLocationId); // Обновить выборы
    return "NO_SCREEN_CHANGE";
}

function onEnterSpringvaleStoreInterior() {
    const exploreQuest = player.quests.find(q => q.id === "explore_wasteland");
    if (exploreQuest && exploreQuest.status === "active") completeQuest("explore_wasteland");
    if (isJoeFriendly() && Math.random() < 0.3) addLog("game", `Джо кивает вам: "Заходи, путник. Только без глупостей."`);
}
function isJoeFriendlyAndQuestAvailable_FixAntenna() {
    const quest = player.quests.find(q => q.id === "joe_fix_antenna");
    const npcQuestData = gameNpcData.settler_store.questsGiven.find(q => q.id === "joe_fix_antenna");
    return isJoeFriendly() && (!quest || quest.status === "not_started") && npcQuestData && npcQuestData.status === "not_started";
}
function startJoeQuest_FixAntenna() {
    addLog("game", `Джо: ${storyTexts.npcDialogues.joeTheSettler.askForAntennaHelp}`);
    addQuest({
        id: "joe_fix_antenna", name: "Починить антенну Джо",
        description: "Найти детали (3 металлолома, 2 электроники) и починить антенну на крыше Супер-Дупер Марта.",
        status: "active", unlocksPlotEntryOnComplete: "entry_005_antenna_repaired",
        reward: { caps: 50, items: [{id:"purified_water", quantity:2}], reputation: {factionId:"settlers", amount:10} }
    });
    gameNpcData.settler_store.questsGiven.find(q=>q.id==="joe_fix_antenna").status = "started";
    const currentLoc = gameLocations[currentLocationId];
    const choiceIndex = currentLoc.choices.findIndex(c => c.questId === "joe_fix_antenna");
    if (choiceIndex !== -1) {
        currentLoc.choices[choiceIndex].text = "[Спросить про антенну] Как там моя работа?";
        currentLoc.choices[choiceIndex].actionFunctionName = "checkJoeQuest_FixAntenna";
        currentLoc.choices[choiceIndex].conditionFunctionName = () => isJoeFriendly() && player.quests.find(q=>q.id === "joe_fix_antenna" && q.status === "active");
        delete currentLoc.choices[choiceIndex].questId;
        renderLocation(currentLocationId);
    }
    return "NO_SCREEN_CHANGE";
}
function checkJoeQuest_FixAntenna() {
    const scrap = player.inventory.misc.find(i => i.id === "scrap_metal");
    const electronics = player.inventory.misc.find(i => i.id === "electronics_scrap");
    if (scrap && scrap.quantity >=3 && electronics && electronics.quantity >=2) {
        addLog("game", `Джо: "${storyTexts.npcDialogues.joeTheSettler.antennaQuestCompleted}"`);
        player.inventory.misc.find(i => i.id === "scrap_metal").quantity -=3;
        if(player.inventory.misc.find(i => i.id === "scrap_metal").quantity <= 0) player.inventory.misc = player.inventory.misc.filter(i=>i.id !== "scrap_metal");
        player.inventory.misc.find(i => i.id === "electronics_scrap").quantity -=2;
        if(player.inventory.misc.find(i => i.id === "electronics_scrap").quantity <= 0) player.inventory.misc = player.inventory.misc.filter(i=>i.id !== "electronics_scrap");

        completeQuest("joe_fix_antenna");
        gameNpcData.settler_store.attitude = "friendly";
        const currentLoc = gameLocations[currentLocationId];
        const choiceIndex = currentLoc.choices.findIndex(c => c.actionFunctionName === "checkJoeQuest_FixAntenna");
        if (choiceIndex !== -1) { currentLoc.choices.splice(choiceIndex, 1); }
        // Добавляем новый вариант диалога для следующего квеста, если его еще нет
        if (!currentLoc.choices.find(c => c.actionFunctionName === "askJoeAboutDistressSignal")) {
             currentLoc.choices.push({ text: "[Спросить] Слышал что-нибудь необычное по радио?",
              conditionFunctionName: () => isJoeFriendly() && player.quests.find(q => q.id === "joe_fix_antenna" && q.status === "completed") && !player.quests.find(q => q.id === "distress_signal_investigation"),
              actionFunctionName: "askJoeAboutDistressSignal"});
        }
        renderLocation(currentLocationId);
    } else { addLog("game", `Джо: ${storyTexts.npcDialogues.joeTheSettler.antennaQuestInProgress}`); }
    updateInventoryDisplay();
    return "NO_SCREEN_CHANGE";
}

// --- BASE ACTIONS ---
function canFoundBaseAtRedRocket() {
    if (playerBase.isFounded) return false;
    const rrData = gameLocations["red_rocket_station"];
    return rrData.customFlags.terminalHacked;
}

function attemptToFoundBaseAtRedRocket() {
    if (canFoundBaseAtRedRocket()) {
        if (typeof foundPlayerBase === "function" && foundPlayerBase("red_rocket_station")) {
            gameLocations["red_rocket_station"].customFlags.baseFoundedHere = true;
            const choiceIndex = gameLocations["red_rocket_station"].choices.findIndex(c => c.actionFunctionName === "attemptToFoundBaseAtRedRocket");
            if (choiceIndex !== -1) {
                gameLocations["red_rocket_station"].choices.splice(choiceIndex, 1);
            }
            addLog("game", "Заправка 'Красная Ракета' теперь ваше убежище! Используйте вкладку BASE для управления.", "item");
            renderLocation(currentLocationId);
        } else {
            addLog("game", "Не удалось основать базу. Проверьте, достаточно ли у вас ресурсов для начального обустройства.", "system");
        }
    } else {
        addLog("game", "Вы еще не можете основать здесь базу. Убедитесь, что место безопасно и подготовлено (например, взломайте терминал).", "system");
    }
    return "NO_SCREEN_CHANGE";
}


// --- TERMINAL ACTIONS ---
function onGenericTerminalLockout(terminalId) {
    const term = terminals[terminalId];
    if (term) {
        term.lockedOut = true; // Устанавливаем флаг блокировки
        term.lockoutTimeLeft = term.lockoutTimeBase * TICKS_PER_GAME_HOUR;
        addLog("game", `Терминал ${term.id} заблокирован на ${term.lockoutTimeBase}ч. Попробуйте позже.`);
        // Обновляем отображение текущей локации, чтобы текст кнопки терминала изменился
        if (currentLocationId === "vault_entrance_hall" || currentLocationId === "overseer_office" || currentLocationId === "red_rocket_station") {
             renderLocation(currentLocationId);
        }
    }
    return "NO_SCREEN_CHANGE";
}

function onSuccessVaultDoorTerminal() {
    addLog("game", "Терминал: Доступ получен. Дверь Убежища открыта.", "item");
    const vaultHall = gameLocations["vault_entrance_hall"];
    vaultHall.customFlags.isDoorOpen = true;
    const terminalChoice = vaultHall.choices.find(c => c.actionFunctionName === "approachVaultTerminal");
    if (terminalChoice) {
        terminalChoice.text = "Терминал управления дверью (Дверь открыта)";
        terminalChoice.conditionFunctionName = () => false; // Делаем неактивным
    }
    if (!vaultHall.choices.find(c => c.target === "wasteland_near_vault")) {
         vaultHall.choices.push({text: "Выйти в Пустошь", target: "wasteland_near_vault"});
    }
    const mainQuest = player.quests.find(q => q.id === "main_quest_1");
    if(mainQuest && mainQuest.status === "active") unlockPlotEntry(mainQuest.journalEntry);
    return "NO_SCREEN_CHANGE"; // Выход из терминала обновит игровой экран
}

function onSuccessOverseerTerminal() {
    addLog("game", "Доступ к терминалу Смотрителя получен.", "item");
    const term = terminals["overseer_terminal"];
    term.customFlags.accessedAllEntries = false; // Сбрасываем, если нужно читать по одной
    term.customFlags.personalLogRead = false;
    term.customFlags.securityLogRead = false;

    const terminalLogEl = document.getElementById("terminal-log");
    const terminalOutputEl = document.getElementById("terminal-output");
    const terminalInputAreaEl = document.getElementById("terminal-input-area");

    if (terminalOutputEl) terminalOutputEl.innerHTML = "<h3>Файлы терминала Смотрителя:</h3>";
    if (terminalLogEl) terminalLogEl.innerHTML = "";
    if (terminalInputAreaEl) terminalInputAreaEl.style.display = "none";

    term.entries.forEach(entry => {
        const entryButton = document.createElement("button");
        entryButton.classList.add("main-button");
        entryButton.style.display = "block"; // Чтобы каждая кнопка была на новой строке
        entryButton.style.marginBottom = "5px";
        entryButton.textContent = entry.name;
        entryButton.onclick = () => {
            if (terminalOutputEl) terminalOutputEl.innerHTML = "";
            if (entry.holodiskId) {
                const holodisk = storyTexts.holodiskContents[entry.holodiskId];
                if (holodisk) {
                    typeWriterEffect(terminalOutputEl, `--- ${holodisk.title} ---\n${holodisk.content.replace(/\n/g, '<br>')}\n--- Конец записи ---`);
                    player.collectHolodisk(entry.holodiskId);
                    if (entry.id === "personal_log") term.customFlags.personalLogRead = true;
                    if (entry.id === "security_protocols") term.customFlags.securityLogRead = true;

                    if (term.customFlags.personalLogRead && term.customFlags.securityLogRead) {
                        term.customFlags.accessedAllEntries = true;
                        unlockPlotEntry("entry_006_overseer_secrets");
                    }
                }
            } else if (entry.text) {
                typeWriterEffect(terminalOutputEl, entry.text.replace(/\n/g, '<br>'));
            }
            const backButton = document.createElement("button");
            backButton.textContent = "Назад к файлам";
            backButton.classList.add("main-button");
            backButton.style.marginTop = "10px";
            backButton.onclick = () => { onSuccessOverseerTerminal(); }; // Рекурсивный вызов для перерисовки списка
            if (terminalOutputEl) {
                terminalOutputEl.appendChild(document.createElement("hr"));
                terminalOutputEl.appendChild(backButton);
            }
        };
        if (terminalOutputEl) terminalOutputEl.appendChild(entryButton);
    });

    const exitButton = document.getElementById("terminal-exit-button");
    if (exitButton) exitButton.style.display = "block";
    const submitButton = document.getElementById("terminal-submit-button");
    if(submitButton) submitButton.style.display = "none";
    // Это не возврат к игре, а смена содержимого экрана терминала
}


// --- COMBAT FUNCTIONS ---
// ... (код без изменений) ...
function startCombat(enemyId) {
    const enemyDataTemplate = enemies[enemyId];
    if (!enemyDataTemplate) { console.error("Enemy not found:", enemyId); addLog("combat", "Ошибка: Противник не найден."); return; }
    currentEnemy = JSON.parse(JSON.stringify(enemyDataTemplate));
    currentEnemy.hp = currentEnemy.maxHp;
    currentEnemy.parts.forEach(part => part.currentHp = part.hp);
    combatActive = true;
    showScreenContent("arena-content");
    document.getElementById("arena-selection-screen").style.display = 'none';
    document.getElementById("combat-screen-content").style.display = 'block';
    const leaveArenaBtn = document.getElementById("action-leave-arena");
    leaveArenaBtn.style.display = 'none'; leaveArenaBtn.classList.add("disabled-button");
    document.getElementById("combat-log").innerHTML = "";
    addLog("combat", `Начало боя с ${currentEnemy.name}!`, "system");
    player.ap = player.maxAp;
    updateCombatDisplay(); renderEnemyParts(); checkCombatButtons();
}
function updateCombatDisplay() {
    if (!combatActive || !currentEnemy) return;
    document.getElementById("player-combat-hp").textContent = player.hp;
    document.getElementById("player-combat-max-hp").textContent = player.maxHp;
    document.getElementById("player-combat-hp-bar").style.width = `${Math.max(0,(player.hp / player.maxHp) * 100)}%`;
    document.getElementById("player-combat-ap").textContent = player.ap;
    document.getElementById("player-combat-max-ap").textContent = player.maxAp;
    document.getElementById("enemy-name").textContent = currentEnemy.name;
    document.getElementById("enemy-combat-hp").textContent = currentEnemy.hp;
    document.getElementById("enemy-combat-max-hp").textContent = currentEnemy.maxHp;
    document.getElementById("enemy-combat-hp-bar").style.width = `${Math.max(0,(currentEnemy.hp / currentEnemy.maxHp) * 100)}%`;
    const equippedWeapon = player.inventory.weapons.find(w => w.equipped) || {apCost: 2, name: "Кулаки"};
    document.getElementById("attack-ap-cost").textContent = equippedWeapon.apCost;
    updateInventoryDisplay();
}
function renderEnemyParts() {
    const enemyPartsContainerEl = document.getElementById("enemy-parts");
    enemyPartsContainerEl.innerHTML = ""; if (!currentEnemy) return;
    currentEnemy.parts.forEach(part => {
        if (part.currentHp <= 0 && part.status === "crippled") return;
        const button = document.createElement("button"); const hitChance = calculateHitChance(part);
        let partInfoText = "";
        if (player.hasPerk("awareness") || player.stats.p >= 7) {
            partInfoText = ` (${part.currentHp}/${part.hp} HP, ${part.status === "crippled" ? "<span style='color:orange'>Искал.</span>" : "OK"})`;
        }
        button.innerHTML = `${part.name}${partInfoText} <span class="target-info">[${hitChance}% Шанс]</span>`;
        const equippedWeapon = player.inventory.weapons.find(w => w.equipped) || {apCost: 2};
        button.disabled = player.ap < equippedWeapon.apCost || part.status === "crippled";
        if (part.status === "crippled") button.style.borderColor = "orange";
        if (button.disabled) button.classList.add("disabled-button"); else button.classList.remove("disabled-button");
        button.onclick = () => playerAttack(part);
        enemyPartsContainerEl.appendChild(button);
    });
    checkCombatButtons();
}
function calculateHitChance(targetPart) {
    let chance = BASE_HIT_CHANCE + (player.hasPerk("gunslinger_1") && player.inventory.weapons.find(w=>w.equipped)?.type === "ranged" ? 10 : 0);
    chance += player.stats.p * 2.5; chance += targetPart.hitChanceMod;
    if (player.limbs.left_arm.status === "Искалечено" || player.limbs.right_arm.status === "Искалечено") chance -= 20;
    if (player.limbs.head.status === "Искалечено") chance -= 15;
    if (targetPart.status === "crippled") chance -= 20;
    if (isNightTime() && currentWeather !== "Пыльная буря" && currentWeather !== "Радиационная буря") chance -=10;
    if (currentWeather === "Пыльная буря") chance -= 15;
    return Math.max(0, Math.min(95, Math.round(chance)));
}
function playerAttack(targetPart) {
    const equippedWeapon = player.inventory.weapons.find(w => w.equipped) || {name: "Кулаки", damage: {min:2, max:4}, apCost: 2, type: "melee"};
    if (player.ap < equippedWeapon.apCost) { addLog("combat", "Недостаточно ОД для атаки!", "system"); return; }
    player.ap -= equippedWeapon.apCost;
    const hitChance = calculateHitChance(targetPart); const roll = getRandomInt(1, 100);
    let message = `Вы атакуете ${currentEnemy.name} в ${targetPart.name.toLowerCase()} (${equippedWeapon.name})... `;
    if (roll <= hitChance) {
        let damage = getRandomInt(equippedWeapon.damage.min, equippedWeapon.damage.max);
        if (equippedWeapon.type === "melee") damage += Math.floor(player.stats.s / 2);
        if (player.hasPerk("bloody_mess_1")) damage = Math.floor(damage * 1.05);
        damage = Math.round(damage * targetPart.damageMod);
        let criticalHit = false;
        const critChance = 5 + player.stats.l + (player.hasPerk("better_criticals_1") ? 5 : 0);
        if (getRandomInt(1, 100) <= critChance) {
            criticalHit = true; damage = Math.round(damage * (1.5 + (player.hasPerk("better_criticals_1") ? 0.5 : 0) ));
            message += `<span class="critical-hit">КРИТИЧЕСКОЕ ПОПАДАНИЕ!</span> `;
        }
        message += `Попадание! Урон: ${damage}.`;
        addLog("combat", message, criticalHit ? "critical" : "player");
        currentEnemy.hp -= damage; targetPart.currentHp -= damage;
        if (targetPart.currentHp <= 0 && targetPart.status !== "crippled") {
            targetPart.status = "crippled"; addLog("combat", `${targetPart.name} ${currentEnemy.name} искалечен(а)!`, "system");
            if (targetPart.id === "head") currentEnemy.accuracyBonus = (currentEnemy.accuracyBonus || 0) - 15;
            if (targetPart.id.includes("arm")) {currentEnemy.damage.min = Math.max(1, currentEnemy.damage.min-2); currentEnemy.damage.max = Math.max(1, currentEnemy.damage.max -3);}
            renderEnemyParts();
        }
        if (currentEnemy.hp <= 0) { currentEnemy.hp = 0; updateCombatDisplay(); endCombat(true); return; }
    } else { message += `Промах!`; addLog("combat", message, "player"); }
    updateCombatDisplay();
    if (player.companion && currentEnemy.hp > 0 && combatActive) {
        companionTurn(player.companion, currentEnemy);
    }
    if (currentEnemy.hp > 0 && combatActive) { setTimeout(enemyTurn, 800); }
    checkCombatButtons();
}
function enemyTurn() {
    if (!combatActive || !currentEnemy || currentEnemy.hp <= 0 || player.hp <=0) return;
    addLog("combat", `${currentEnemy.name} атакует...`, "enemy");
    let targetLimbForPlayer = null; const playerLimbIds = Object.keys(player.limbs);
    const nonCrippledPlayerLimbs = playerLimbIds.filter(id => player.limbs[id].status !== "Искалечено");
    if (nonCrippledPlayerLimbs.length > 0 && getRandomInt(1,100) <= 40) {
        targetLimbForPlayer = nonCrippledPlayerLimbs[getRandomInt(0, nonCrippledPlayerLimbs.length - 1)];
        addLog("combat", `${currentEnemy.name} целится в вашу ${player.limbs[targetLimbForPlayer].name.toLowerCase()}!`, "enemy");
    }
    let playerEvasionBonus = player.skills.stealth / 5;
    if (player.limbs.left_leg.status === "Искалечено" || player.limbs.right_leg.status === "Искалечено") playerEvasionBonus -= 15;
    if (player.isOverencumbered) playerEvasionBonus -=10;
    const baseEnemyHitChance = 55 + (currentEnemy.accuracyBonus || 0) - (player.stats.a + playerEvasionBonus);
    const enemyRoll = getRandomInt(1, 100);
    if (enemyRoll <= Math.max(5, baseEnemyHitChance)) {
        let damage = getRandomInt(currentEnemy.damage.min, currentEnemy.damage.max);
        addLog("combat", `${currentEnemy.name} попадает и наносит ${damage} урона!`, "damage_taken_player");
        const result = player.takeDamage(damage, targetLimbForPlayer);
        if (result === "player_defeated") { endCombat(false); return; }
    } else { addLog("combat", `${currentEnemy.name} промахивается.`, "enemy"); }
    let apToRegen = Math.floor(player.maxAp * player.apRegenRate + player.stats.a / 2);
    if (player.hasPerk("action_boy_1")) apToRegen = Math.floor(apToRegen * 1.35);
    player.ap = Math.min(player.maxAp, player.ap + apToRegen);
    updateAllDisplays(); renderEnemyParts(); checkCombatButtons();
}
function endCombat(playerWon) {
    combatActive = false;
    const leaveArenaBtn = document.getElementById("action-leave-arena");
    leaveArenaBtn.style.display = 'block'; leaveArenaBtn.classList.remove("disabled-button");
    if (playerWon) {
        addLog("combat", `Вы победили ${currentEnemy.name}!`, "system");
        player.addXp(currentEnemy.xpValue);
        if (currentEnemy.lootTable) {
            let lootGained = "";
            currentEnemy.lootTable.forEach(lootItem => {
                if (Math.random() < lootItem.chance) {
                    const qty = Array.isArray(lootItem.quantity) ? getRandomInt(lootItem.quantity[0], lootItem.quantity[1]) : lootItem.quantity;
                    const itemTemplate = allItems[lootItem.itemId] || { name: lootItem.itemId, weight:0, category: lootItem.type || 'misc' };
                    addItemToInventory(
                        {...itemTemplate, id: `${lootItem.itemId}_enemyloot_${Date.now()}_${getRandomInt(0,999)}`, quantity: qty, uniqueMarker: true},
                        itemTemplate.category
                    );
                    lootGained += `${qty}x ${itemTemplate.name}, `;
                }
            });
            if (lootGained) addLog("combat", `С врага собрано: ${lootGained.slice(0,-2)}.`, "item");
        }
    } else {
        addLog("combat", `Вы были повержены...`, "system");
        player.hp = 1;
    }
    if (player.companion) player.companion.currentHp = player.companion.hp;
    updateAllDisplays(); checkCombatButtons();
}
function checkCombatButtons() {
    const isBattleOver = !combatActive || !currentEnemy || currentEnemy.hp <= 0 || player.hp <= 0;
    document.querySelectorAll('#enemy-parts button, .combat-actions button').forEach(btn => {
        if (btn.id !== 'action-leave-arena') {
            btn.disabled = isBattleOver;
            if(isBattleOver) btn.classList.add("disabled-button"); else btn.classList.remove("disabled-button");
        }
    });
    const leaveArenaBtn = document.getElementById("action-leave-arena");
    if (isBattleOver) { leaveArenaBtn.disabled = false; leaveArenaBtn.classList.remove("disabled-button"); }
    else { leaveArenaBtn.disabled = true; leaveArenaBtn.classList.add("disabled-button"); }

    if (!isBattleOver) {
        const equippedWeapon = player.inventory.weapons.find(w => w.equipped) || {apCost: 2};
        document.querySelectorAll('#enemy-parts button').forEach(btn => {
            const partNameMatch = btn.innerHTML.match(/^([^<\(]+)/);
            const partNameClean = partNameMatch ? partNameMatch[0].trim().toLowerCase() : "unknown";
            const partObject = currentEnemy.parts.find(p => p.name.toLowerCase() === partNameClean || p.id === partNameClean);
            btn.disabled = player.ap < equippedWeapon.apCost || (partObject && partObject.status === "crippled");
            if(btn.disabled) btn.classList.add("disabled-button"); else btn.classList.remove("disabled-button");
        });
        const stimpakItem = player.inventory.aid.find(i => (i.id === 'stimpak' || i.id.startsWith('stimpak_')) && i.quantity > 0);
        const stimpakApCost = stimpakItem ? (stimpakItem.apCost || 2) : 2;
        const actionUseStimpakButtonEl = document.getElementById("action-use-stimpak");
        actionUseStimpakButtonEl.disabled = !(stimpakItem && player.ap >= stimpakApCost);
        if(actionUseStimpakButtonEl.disabled) actionUseStimpakButtonEl.classList.add("disabled-button"); else actionUseStimpakButtonEl.classList.remove("disabled-button");
        const actionPassTurnButtonEl = document.getElementById("action-pass-turn");
        actionPassTurnButtonEl.disabled = false; actionPassTurnButtonEl.classList.remove("disabled-button");
    }
}

// --- TERMINAL HACKING FUNCTIONS ---
const terminalOutputDisplay = document.getElementById("terminal-output");
function startTerminalHacking(terminalId) {
    currentTerminal = terminals[terminalId];
    if (!currentTerminal) { addLog("game", "Ошибка: Терминал не найден или неактивен."); return "NO_SCREEN_CHANGE"; }
    if (currentTerminal.lockedOut && currentTerminal.lockoutTimeLeft > 0) {
        addLog("game", `Терминал ${currentTerminal.id} заблокирован еще на ${Math.ceil(currentTerminal.lockoutTimeLeft / TICKS_PER_GAME_HOUR)} ч.`);
        return "NO_SCREEN_CHANGE";
    }
    currentTerminal.lockedOut = false; // Сбрасываем блокировку, если время вышло (на всякий случай)
    currentTerminal.lockoutTimeLeft = 0;


    const activePipboyTab = document.querySelector('#pipboy-tabs .tab-button.active');
    if (activePipboyTab) {
        activePipboyTab.classList.add('active-before-special-screen');
    }

    terminalHackingActive = true;
    showScreenContent("terminal-hacking-screen");
    document.getElementById("terminal-difficulty").textContent = `(${currentTerminal.difficulty})`;
    terminalAttemptsLeft = currentTerminal.attempts + (player.hasPerk("hacker_1") ? 1 : 0);
    document.getElementById("terminal-log").innerHTML = "";
    document.getElementById("terminal-success-message").style.display = "none";
    document.getElementById("terminal-failure-message").style.display = "none";
    const terminalUserInputEl = document.getElementById("terminal-user-input");
    terminalUserInputEl.value = ""; terminalUserInputEl.disabled = false;
    const submitBtn = document.getElementById("terminal-submit-button");
    submitBtn.disabled = false; submitBtn.classList.remove("disabled-button");
    generateTerminalDisplay(); updateTerminalAttemptsDisplay();
    addLog("terminal", "Введите 'помощь' для списка команд.");
    return "SCREEN_CHANGED";
}
function generateTerminalDisplay() {
    terminalOutputDisplay.innerHTML = ""; terminalWords = [];
    const chars = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"; const lineLength = 32; const numLines = 14;
    const wordPool = [...currentTerminal.wordPool.filter(w => w.length === currentTerminal.passwordLength)];
    if (wordPool.length === 0) { addLog("terminal", "Ошибка конфигурации: нет слов нужной длины."); terminalPassword = "ERROR"; }
    else terminalPassword = wordPool.splice(getRandomInt(0, wordPool.length - 1), 1)[0];
    terminalWords.push(terminalPassword);
    const numDuds = Math.min(wordPool.length, getRandomInt(6, 12));
    for (let i = 0; i < numDuds; i++) { if (wordPool.length === 0) break; terminalWords.push(wordPool.splice(getRandomInt(0, wordPool.length - 1), 1)[0]); }
    terminalWords.sort(() => Math.random() - 0.5); let currentWordIndex = 0;
    for (let i = 0; i < numLines; i++) {
        let lineContent = "";
        for (let j = 0; j < lineLength; j++) {
            if (currentWordIndex < terminalWords.length && (lineLength - (lineContent.replace(/<[^>]*>/g, "").length)) >= terminalWords[currentWordIndex].length && Math.random() < 0.20) {
                const word = terminalWords[currentWordIndex];
                lineContent += `<span class="word-option" data-word="${word}">${word}</span>`; j += word.length -1; currentWordIndex++;
            } else lineContent += chars[getRandomInt(0, chars.length - 1)];
        }
        terminalOutputDisplay.innerHTML += lineContent + "<br>";
    }
    terminalOutputDisplay.querySelectorAll('.word-option').forEach(span => { span.onclick = () => processTerminalInput(span.dataset.word); });
    addLog("terminal", `Система инициализирована. Пароль: ${currentTerminal.passwordLength} букв.`);
}
function processTerminalInput(input) {
    input = input.trim().toUpperCase(); if (!terminalHackingActive || input.length === 0) return;
    const terminalUserInputEl = document.getElementById("terminal-user-input");
    if (input.toLowerCase() === "помощь") { addLog("terminal", "Команды: <слово_для_проверки>, выход."); terminalUserInputEl.value = ""; return; }
    if (input.toLowerCase() === "выход") { _exitTerminalHacking(); return; }
    if (input.length !== currentTerminal.passwordLength) { addLog("terminal", `Ошибка: Длина пароля - ${currentTerminal.passwordLength} букв.`); terminalUserInputEl.value = ""; return; }
    if (input === terminalPassword) {
        terminalHackingActive = false;
        document.getElementById("terminal-success-text").textContent = storyTexts.terminalSuccessMessages[currentTerminal.successMessageKey] || "Доступ получен!";
        document.getElementById("terminal-success-message").style.display = "block"; document.getElementById("terminal-failure-message").style.display = "none";
        terminalUserInputEl.disabled = true; const submitBtn = document.getElementById("terminal-submit-button"); submitBtn.disabled = true; submitBtn.classList.add("disabled-button");
        if (currentTerminal.onSuccessFunctionName && typeof window[currentTerminal.onSuccessFunctionName] === 'function') window[currentTerminal.onSuccessFunctionName]();
        if (currentTerminal.customFlags) currentTerminal.customFlags.hackedSuccessfully = true; // Общий флаг успешного взлома
        player.addXp(25 + (currentTerminal.difficulty === "Средний" ? 15:0) + (currentTerminal.difficulty === "Сложный" ? 30:0));
    } else {
        terminalAttemptsLeft--; updateTerminalAttemptsDisplay();
        if (terminalAttemptsLeft <= 0) {
            terminalHackingActive = false;
            addLog("terminal", "Слишком много неудачных попыток. Система заблокирована.");
            if (currentTerminal.onLockoutFunctionName && typeof window[currentTerminal.onLockoutFunctionName] === 'function') {
                window[currentTerminal.onLockoutFunctionName](currentTerminal.id);
            } else {
                currentTerminal.lockedOut = true; // Стандартная блокировка, если нет спец. функции
            }
            document.getElementById("terminal-failure-message").style.display = "block"; document.getElementById("terminal-success-message").style.display = "none";
            terminalUserInputEl.disabled = true; const submitBtn = document.getElementById("terminal-submit-button"); submitBtn.disabled = true; submitBtn.classList.add("disabled-button");
        } else {
            let likeness = 0; for (let i = 0; i < currentTerminal.passwordLength; i++) if (input.charAt(i) === terminalPassword.charAt(i)) likeness++;
            addLog("terminal", `Доступ запрещен. Совпадение: ${likeness}/${currentTerminal.passwordLength}.`);
        }
    }
    terminalUserInputEl.value = "";
}
function updateTerminalAttemptsDisplay() { document.getElementById("terminal-attempts-left").textContent = terminalAttemptsLeft; }
function _exitTerminalHacking() {
    terminalHackingActive = false;
    const gameMainContentEl = document.getElementById("game-main-content");
    let tabToRestore = "status";

    if(gameMainContentEl && gameMainContentEl.classList.contains("active-before-terminal")){
        tabToRestore = "game";
        gameMainContentEl.classList.remove("active-before-terminal");
    } else {
        const previouslyActiveButton = Array.from(document.querySelectorAll('#pipboy-tabs .tab-button')).find(btn => btn.classList.contains('active-before-special-screen'));
        if(previouslyActiveButton) {
            tabToRestore = previouslyActiveButton.dataset.tab;
        }
    }
    document.querySelectorAll('#pipboy-tabs .tab-button').forEach(btn => btn.classList.remove('active-before-special-screen'));

    // Если это был терминал Смотрителя и мы получили доступ, не перерисовываем локацию,
    // а оставляем пользователя на экране терминала для чтения записей.
    if (currentTerminal && currentTerminal.id === "overseer_terminal" && currentTerminal.customFlags?.accessedAllEntries !== undefined && !currentTerminal.lockedOut) {
         // onSuccessOverseerTerminal уже обновил экран терминала
         // Ничего не делаем здесь, чтобы пользователь мог читать
    } else {
        showTab(tabToRestore);
        if (tabToRestore === "game") renderLocation(currentLocationId);
    }
    currentTerminal = null; // Сбрасываем текущий терминал только после всех действий
}

// --- COMPANION FUNCTIONS ---
function updateCompanionTab() {
    const companionStatusArea = document.getElementById("companion-status-area");
    const companionInvArea = document.getElementById("companion-inventory-area");
    const companionCommandsArea = document.getElementById("companion-commands-area");

    if (player.companion) {
        companionStatusArea.innerHTML = `
            <h3>${player.companion.name}</h3>
            <div class="stat-item"><span>Состояние:</span> <span class="stat-value">${player.companion.currentHp > 0 ? "В порядке" : "Выведен из строя"}</span></div>
            <div class="stat-item"><span>HP:</span> <span class="stat-value">${player.companion.currentHp} / ${player.companion.hp}</span></div>
            <div class="stat-item"><span>Настроение:</span> <span class="stat-value">${player.companion.mood || "Нейтральное"}</span></div>
            <div class="stat-item"><span>Статус:</span> <span class="stat-value">${player.companion.isWaiting ? "Ждет" : "Следует"}</span></div>
        `;
        companionInvArea.style.display = "block";
        companionCommandsArea.style.display = "block";
        document.getElementById("companion-name-inv").textContent = player.companion.name;
        const companionInvList = document.getElementById("companion-inventory-list");
        companionInvList.innerHTML = player.companion.inventory && player.companion.inventory.length > 0 ? "" : "<li>Пусто</li>";
        document.getElementById("companion-command-wait").textContent = player.companion.isWaiting ? "Следовать за мной" : "Ждать здесь";
    } else {
        companionStatusArea.innerHTML = "<p>У вас нет компаньона.</p>";
        companionInvArea.style.display = "none";
        companionCommandsArea.style.display = "none";
    }
}
function companionTurn(companion, enemy) {
    if (!companion || companion.currentHp <= 0 || !enemy || enemy.hp <= 0) return;
    addLog("combat", `${companion.name} атакует ${enemy.name}...`, "info-color");
    const companionHitChance = 70;
    if (getRandomInt(1, 100) <= companionHitChance) {
        const damage = getRandomInt(companion.attackDamage.min, companion.attackDamage.max);
        enemy.hp -= damage;
        addLog("combat", `${companion.name} наносит ${damage} урона!`, "info-color");
        if (enemy.hp <= 0) {
            enemy.hp = 0;
            addLog("combat", `${enemy.name} повержен атакой ${companion.name}!`, "info-color");
        }
    } else {
        addLog("combat", `${companion.name} промахивается.`, "info-color");
    }
    updateCombatDisplay();
}
function companionCommandToggleWait() {
    if (player.companion) {
        player.companion.isWaiting = !player.companion.isWaiting;
        addLog("game", `${player.companion.name} теперь ${player.companion.isWaiting ? "ждет здесь" : "следует за вами"}.`, "info-color");
        updateCompanionTab();
    }
}
function companionCommandSearch() {
    if (player.companion && typeof window[player.companion.onSearchFunctionName] === 'function') {
        window[player.companion.onSearchFunctionName]();
    } else if (player.companion) {
        addLog("game", `${player.companion.name} обнюхивает окрестности, но ничего не находит.`, "system");
    }
}
function dogmeatAttackEffect() { /* Логика атаки уже в companionTurn */ }
function dogmeatSearchEffect() {
    if (Math.random() < 0.3) {
        const lootPool = [
            {template: allItems.bobby_pin, uniqueIdSuffix: "bobby_pin_dog_1"},
            {template: allItems.scrap_metal, uniqueIdSuffix: "scrap_dog_1"},
            {template: allItems.cram, uniqueIdSuffix: "cram_dog_1"}
        ];
        const potentialLootData = lootPool[getRandomInt(0, lootPool.length -1)];
        const uniqueItemId = `${potentialLootData.template.id}_${potentialLootData.uniqueIdSuffix}`;
        const foundMarker = `dogloot_${uniqueItemId}`;

        if (!player[foundMarker]) {
            addItemToInventory(
                {...potentialLootData.template, id: uniqueItemId, quantity: 1, uniqueMarker: true},
                potentialLootData.template.category || 'misc'
            );
            addLog("game", `Псина что-то нашел и принес вам: ${potentialLootData.template.name}!`, "item");
            player[foundMarker] = true;
        } else {
            addLog("game", "Псина обнюхал все вокруг, но ничего нового не нашел.", "system");
        }
    } else {
        addLog("game", "Псина обнюхал все вокруг, но ничего интересного не нашел.", "system");
    }
}
function companionCommandDismiss() {
    if (player.companion) {
        addLog("game", `Вы отпустили ${player.companion.name}. Он убегает в Пустошь.`, "info-color");
        const redRocket = gameLocations["red_rocket_station"];
        if (redRocket && player.companion.id === "dogmeat") {
            redRocket.customFlags.dogFound = false;
            if (!redRocket.choices.find(c=>c.actionFunctionName === "approachDogAtRedRocket")) {
                 redRocket.choices.splice(1,0, { text: "Подойти к собаке", conditionFunctionName: "isDogAtRedRocketNotYetFriend", actionFunctionName: "approachDogAtRedRocket" });
            }
        }
        player.companion = null;
        updateCompanionTab();
        if (currentLocationId === "red_rocket_station") renderLocation(currentLocationId);
    }
}

// --- TIME & WEATHER FUNCTIONS ---
function advanceTime(minutes) {
    currentGameMinute += minutes;
    let hoursAdvancedThisCall = 0;
    while (currentGameMinute >= 60) {
        currentGameMinute -= 60;
        currentGameHour++;
        hoursAdvancedThisCall++;
        if (Math.random() < WEATHER_CHANGE_CHANCE) {
            const oldWeather = currentWeather;
            currentWeather = WEATHER_TYPES[getRandomInt(0, WEATHER_TYPES.length - 1)];
            if (oldWeather !== currentWeather) addLog("game", `Погода изменилась: ${currentWeather}.`, "info-color");
        }
    }
    if (hoursAdvancedThisCall > 0) {
        player.updateNeeds(hoursAdvancedThisCall);
        // Обновляем таймеры блокировки терминалов
        Object.values(terminals).forEach(term => {
            if (term.lockedOut && term.lockoutTimeLeft > 0) {
                term.lockoutTimeLeft -= hoursAdvancedThisCall * TICKS_PER_GAME_HOUR; // Уменьшаем на количество тиков
                if (term.lockoutTimeLeft <= 0) {
                    term.lockedOut = false;
                    term.lockoutTimeLeft = 0;
                    addLog("game", `Терминал ${term.id} снова доступен.`, "info-color");
                    // Если игрок в локации с этим терминалом, нужно обновить выборы
                    if (term.id === terminals[currentTerminal?.id]?.id || // Если это текущий терминал (маловероятно)
                        (currentLocationId === "vault_entrance_hall" && term.id === "vault_door_terminal") ||
                        (currentLocationId === "overseer_office" && term.id === "overseer_terminal") ||
                        (currentLocationId === "red_rocket_station" && term.id === "red_rocket_terminal")
                    ) {
                        if (document.getElementById("game-main-content")?.classList.contains("active")) {
                             renderLocation(currentLocationId);
                        }
                    }
                }
            }
        });
    }

    while (currentGameHour >= GAME_HOURS_PER_DAY) {
        currentGameHour -= GAME_HOURS_PER_DAY;
        currentDay++;
        addLog("game", `Наступил новый день (${currentDay}-й).`, "info-color");
    }
    updateStatusDisplay();
    return hoursAdvancedThisCall;
}
function isNightTime() { return currentGameHour >= 20 || currentGameHour < 6; }

// --- RADIO FUNCTIONS ---
let currentRadioStation = "off";
const radioOutputLog = [];
const MAX_RADIO_LOG_MESSAGES = 10;

function tuneRadio(stationId) {
    currentRadioStation = stationId;
    const radioOutputEl = document.getElementById("radio-output");
    radioOutputEl.innerHTML = "";
    radioOutputLog.length = 0;

    document.querySelectorAll(".radio-station-button").forEach(btn => {
        btn.classList.remove("active-station");
        if (btn.dataset.station === stationId) {
            btn.classList.add("active-station");
        }
    });

    if (stationId === "off") {
        addLog("radio", "Радио выключено.");
    } else {
        const stationButton = document.querySelector(`.radio-station-button[data-station="${stationId}"]`);
        const stationName = stationButton ? stationButton.textContent : "Неизвестная станция";
        addLog("radio", `Настройка на станцию: ${stationName}...`);
        if (storyTexts.radioStationContent[stationId] && storyTexts.radioStationContent[stationId].length > 0) {
            for (let i=0; i<3; i++) {
                const messages = storyTexts.radioStationContent[stationId];
                addRadioMessage(messages[getRandomInt(0, messages.length -1)]);
            }
        } else {
            addRadioMessage("*только помехи*");
        }
    }
}
function addRadioMessage(message) {
    if (currentRadioStation === "off") return;
    if (radioOutputLog.length >= MAX_RADIO_LOG_MESSAGES) {
        radioOutputLog.shift();
    }
    radioOutputLog.push(`[${String(currentGameHour).padStart(2, '0')}:${String(currentGameMinute).padStart(2, '0')}] ${message}`);

    const radioOutputEl = document.getElementById("radio-output");
    radioOutputEl.innerHTML = "";
    radioOutputLog.forEach(logMsg => {
        const p = document.createElement("p");
        p.textContent = logMsg;
        radioOutputEl.appendChild(p);
    });
    radioOutputEl.scrollTop = radioOutputEl.scrollHeight;
}


// --- MINESWEEPER (TRAP DISARM) FUNCTIONS ---
function startMinesweeperGame(difficulty, damageOnFail) {
    let rows, cols, mines;
    const difficultyStr = String(difficulty).toLowerCase();
    if (difficultyStr === "easy") { rows = 5; cols = 5; mines = 3; }
    else if (difficultyStr === "medium") { rows = 7; cols = 7; mines = 6; }
    else { rows = 8; cols = 8; mines = 10; }

    currentMinesweeperGame = {
        rows, cols, mines, damageOnFail,
        grid: [], revealedCells: 0, flagsPlaced: 0, gameOver: false,
        boardGenerated: false
    };
    const activePipboyTab = document.querySelector('#pipboy-tabs .tab-button.active');
    if (activePipboyTab) {
        activePipboyTab.classList.add('active-before-special-screen');
    }

    document.getElementById("minesweeper-difficulty").textContent = difficultyStr.charAt(0).toUpperCase() + difficultyStr.slice(1);
    document.getElementById("minesweeper-mine-count").textContent = mines;
    document.getElementById("minesweeper-message").textContent = "Кликните на ячейку, чтобы открыть. ПКМ (или долгий тап), чтобы пометить флажком.";

    const gridElement = document.getElementById("minesweeper-grid");
    gridElement.innerHTML = "";
    gridElement.style.setProperty('--minesweeper-rows', rows);
    gridElement.style.setProperty('--minesweeper-cols', cols);

    for (let r = 0; r < rows; r++) {
        currentMinesweeperGame.grid[r] = [];
        for (let c = 0; c < cols; c++) {
            currentMinesweeperGame.grid[r][c] = { isMine: false, isRevealed: false, isFlagged: false, adjacentMines: 0 };
            const cell = document.createElement("div");
            cell.classList.add("mine-cell");
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener("click", handleMinesweeperCellClick);
            cell.addEventListener("contextmenu", handleMinesweeperCellRightClick);
            gridElement.appendChild(cell);
        }
    }
    showScreenContent("minesweeper-screen");
    return "SCREEN_CHANGED";
}
function generateMinesweeperBoard(initialRow, initialCol) {
    const { rows, cols, mines } = currentMinesweeperGame;
    let minesPlaced = 0;
    while (minesPlaced < mines) {
        const r = getRandomInt(0, rows - 1);
        const c = getRandomInt(0, cols - 1);
        if (!currentMinesweeperGame.grid[r][c].isMine &&
            (Math.abs(r - initialRow) > 1 || Math.abs(c - initialCol) > 1) ) {
            currentMinesweeperGame.grid[r][c].isMine = true;
            minesPlaced++;
        }
    }
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!currentMinesweeperGame.grid[r][c].isMine) {
                let count = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = r + dr;
                        const nc = c + dc;
                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && currentMinesweeperGame.grid[nr][nc].isMine) {
                            count++;
                        }
                    }
                }
                currentMinesweeperGame.grid[r][c].adjacentMines = count;
            }
        }
    }
    currentMinesweeperGame.boardGenerated = true;
}
function handleMinesweeperCellClick(event) {
    if (!currentMinesweeperGame || currentMinesweeperGame.gameOver) return;
    const row = parseInt(event.target.dataset.row);
    const col = parseInt(event.target.dataset.col);
    const cellData = currentMinesweeperGame.grid[row][col];

    if (cellData.isRevealed || cellData.isFlagged) return;

    if (!currentMinesweeperGame.boardGenerated) {
        generateMinesweeperBoard(row, col);
    }

    if (cellData.isMine) {
        revealAllMines();
        document.getElementById("minesweeper-message").textContent = storyTexts.trapDisarmMessages.failure_major_damage;
        player.takeDamage(getRandomInt(currentMinesweeperGame.damageOnFail.min, currentMinesweeperGame.damageOnFail.max));
        currentMinesweeperGame.gameOver = true;
        document.getElementById("minesweeper-exit-button").textContent = "Закрыть (Ловушка сработала)";
        return;
    }
    revealMinesweeperCell(row, col);
    checkMinesweeperWin();
}
function handleMinesweeperCellRightClick(event) {
    event.preventDefault();
    if (!currentMinesweeperGame || currentMinesweeperGame.gameOver) return;
    const row = parseInt(event.target.dataset.row);
    const col = parseInt(event.target.dataset.col);
    const cellData = currentMinesweeperGame.grid[row][col];

    if (cellData.isRevealed) return;

    cellData.isFlagged = !cellData.isFlagged;
    event.target.classList.toggle("flagged", cellData.isFlagged);
    currentMinesweeperGame.flagsPlaced += cellData.isFlagged ? 1 : -1;
    checkMinesweeperWin();
}
function revealMinesweeperCell(r, c) {
    const { rows, cols, grid } = currentMinesweeperGame;
    if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c].isRevealed || grid[r][c].isFlagged) return;

    const cellData = grid[r][c];
    const cellElement = document.querySelector(`.mine-cell[data-row="${r}"][data-col="${c}"]`);

    cellData.isRevealed = true;
    cellElement.classList.add("revealed");
    currentMinesweeperGame.revealedCells++;

    if (cellData.adjacentMines > 0) {
        cellElement.textContent = cellData.adjacentMines;
        cellElement.classList.add(`adj-${cellData.adjacentMines}`);
    } else {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                revealMinesweeperCell(r + dr, c + dc);
            }
        }
    }
}
function revealAllMines() {
    const { rows, cols, grid } = currentMinesweeperGame;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c].isMine) {
                const cellElement = document.querySelector(`.mine-cell[data-row="${r}"][data-col="${c}"]`);
                cellElement.classList.add("mine", "revealed");
                cellElement.textContent = "✹";
            }
        }
    }
}
function checkMinesweeperWin() {
    const { rows, cols, mines, revealedCells } = currentMinesweeperGame;
    if (revealedCells === (rows * cols) - mines) {
        document.getElementById("minesweeper-message").textContent = storyTexts.trapDisarmMessages.success;
        currentMinesweeperGame.gameOver = true;
        revealAllMines();
        player.addXp(20 + mines * 2);
        const currentLocData = gameLocations[currentLocationId];
        if (currentLocData && currentLocData.trap && currentLocData.trap.id === "rr_storage_trap") {
            currentLocData.customFlags.trapDisarmed = true;
        }
        document.getElementById("minesweeper-exit-button").textContent = "Продолжить";
    }
}
function exitMinesweeper(triggered = false) {
    if (currentMinesweeperGame && !currentMinesweeperGame.gameOver && !triggered) {
         if (Math.random() < 0.25) {
            addLog("game", storyTexts.trapDisarmMessages.отказался_сработала, "danger-color");
            player.takeDamage(Math.floor(getRandomInt(currentMinesweeperGame.damageOnFail.min, currentMinesweeperGame.damageOnFail.max) / 2) );
         } else {
            addLog("game", storyTexts.trapDisarmMessages.отказался_безопасно, "info-color");
         }
    }
    const gameMainContentEl = document.getElementById("game-main-content");
    let tabToRestore = "status";

    if(gameMainContentEl && gameMainContentEl.classList.contains("active-before-minesweeper")){
        tabToRestore = "game";
        gameMainContentEl.classList.remove("active-before-minesweeper");
    } else {
        const previouslyActiveButton = Array.from(document.querySelectorAll('#pipboy-tabs .tab-button')).find(btn => btn.classList.contains('active-before-special-screen'));
        if(previouslyActiveButton) {
            tabToRestore = previouslyActiveButton.dataset.tab;
        }
    }
    document.querySelectorAll('#pipboy-tabs .tab-button').forEach(btn => btn.classList.remove('active-before-special-screen'));

    currentMinesweeperGame = null;

    const locData = gameLocations[currentLocationId];
    if (locData && locData.trap && locData.trap.id === "rr_storage_trap") {
        const storageChoice = locData.choices.find(c => c.actionFunctionName === "tryDisarmRedRocketTrap" || c.actionFunctionName === "enterRedRocketStorage" );
        if (storageChoice) {
            if (locData.customFlags.trapDisarmed) {
                storageChoice.text = "Войти на склад (ловушка обезврежена)";
            } else {
                storageChoice.text = "Попытаться обезвредить ловушку на складе";
            }
            storageChoice.actionFunctionName = locData.customFlags.trapDisarmed ? "enterRedRocketStorage" : "tryDisarmRedRocketTrap";
        }
    }
    showTab(tabToRestore);
    if (tabToRestore === "game") {
        renderLocation(currentLocationId);
    }
}


// --- SCREEN/TAB MANAGEMENT ---
function showTab(tabIdToShow) {
    console.log("showTab called for:", tabIdToShow);
    document.querySelectorAll(".screen-content").forEach(content => {
        content.classList.remove("active");
        content.classList.remove("active-before-terminal");
        content.classList.remove("active-before-minesweeper");
    });
    document.querySelectorAll(".tab-button").forEach(button => {
        button.classList.remove("active");
        button.classList.remove("active-before-special-screen");
    });

    const gameMainContentEl = document.getElementById("game-main-content");

    if (tabIdToShow === "game") {
        console.log("Switching to 'game' tab.");
        currentActiveScreenContentId = "game-main-content";
        if (gameMainContentEl) gameMainContentEl.classList.add("active");

        const gameButton = document.querySelector(`.tab-button[data-tab="game"]`);
        if (gameButton) gameButton.classList.add("active");

        const gameOutputEl = document.getElementById("game-output");
        if (currentLocationId && (!combatActive && !terminalHackingActive && !currentMinesweeperGame)) {
             console.log("Game tab: Rendering current location:", currentLocationId);
             renderLocation(currentLocationId);
        } else if (!currentLocationId && gameOutputEl && gameOutputEl.innerHTML.includes("Pip-Boy OS")) {
             console.log("Game tab: Initial boot, setCurrentLocation will handle rendering from bootUpPipBoy.");
        } else {
            console.log("Game tab: In special mode (combat/terminal/etc.) or no currentLocationId, not rendering location now.");
        }
    } else {
        console.log("Switching to tab:", tabIdToShow);
        currentActiveScreenContentId = tabIdToShow + "-content";
        if (gameMainContentEl) gameMainContentEl.classList.remove("active");

        const targetContent = document.getElementById(currentActiveScreenContentId);
        if (targetContent) {
            targetContent.classList.add("active");
            console.log("Activated content:", currentActiveScreenContentId);
        } else if (tabIdToShow === "base") {
             const baseDiv = document.getElementById("base-content") || createBaseContentDiv();
             if (baseDiv) {
                baseDiv.classList.add("active");
                console.log("Activated base content (created if didn't exist).");
             }
        } else {
            console.warn("Target content not found for tabId:", tabIdToShow, " (element ID: ", currentActiveScreenContentId, ")");
        }

        const targetButton = document.querySelector(`.tab-button[data-tab="${tabIdToShow}"]`);
        if (targetButton) targetButton.classList.add("active");

        if (tabIdToShow === "arena") {
            if (!combatActive) {
                document.getElementById("arena-selection-screen").style.display = 'block';
                document.getElementById("combat-screen-content").style.display = 'none';
            } else {
                 document.getElementById("arena-selection-screen").style.display = 'none';
                 document.getElementById("combat-screen-content").style.display = 'block';
                 renderEnemyParts(); checkCombatButtons();
            }
        }
        if (tabIdToShow === "plot") updatePlotJournalDisplay();
        if (tabIdToShow === "companion") updateCompanionTab();
        if (tabIdToShow === "radio" && currentRadioStation === "off") tuneRadio("off");
        if (tabIdToShow === "base") {
             updateBaseTabDisplay();
        }
    }
    updateAllDisplays();
    const pipboyScreen = document.getElementById('pipboy-screen');
    if (pipboyScreen) pipboyScreen.scrollTop = 0;
}

function createBaseContentDiv() {
    let baseContentDiv = document.getElementById("base-content");
    if (!baseContentDiv) {
        const screenContainer = document.getElementById('pipboy-screen');
        if (screenContainer) {
            baseContentDiv = document.createElement('div');
            baseContentDiv.id = "base-content";
            baseContentDiv.classList.add('screen-content');
            baseContentDiv.innerHTML = `<h2>УПРАВЛЕНИЕ БАЗОЙ (<span id="base-name-display"></span>)</h2>
                                        <div id="base-overview-section"></div>
                                        <div id="base-resources-section"></div>
                                        <div id="base-buildings-section"></div>
                                        <div id="base-construction-section"></div>
                                        <div id="base-settlers-section"></div>
                                        <div id="base-defense-section"></div>`;
            screenContainer.appendChild(baseContentDiv);
            console.log("Base content div created and appended.");
        } else {
            console.error("Pipboy screen container not found for createBaseContentDiv");
        }
    }
    return baseContentDiv;
}

function showScreenContent(screenId) {
    const previouslyActiveTab = document.querySelector('#pipboy-tabs .tab-button.active');
    if (previouslyActiveTab) {
        previouslyActiveTab.classList.remove('active');
        previouslyActiveTab.classList.add('active-before-special-screen');
    }

    document.querySelectorAll(".screen-content").forEach(content => content.classList.remove("active"));
    const targetContent = document.getElementById(screenId);
    const gameMainContentEl = document.getElementById("game-main-content");

    if (targetContent) {
        targetContent.classList.add("active");
        currentActiveScreenContentId = screenId;

        if(gameMainContentEl && gameMainContentEl.classList.contains('active-before-terminal')){}
        else if (gameMainContentEl && gameMainContentEl.classList.contains('active-before-minesweeper')) {}
        else if (gameMainContentEl && gameMainContentEl !== targetContent && previouslyActiveTab && previouslyActiveTab.dataset.tab === "game"){
            if(screenId === "terminal-hacking-screen") gameMainContentEl.classList.add("active-before-terminal");
            if(screenId === "minesweeper-screen") gameMainContentEl.classList.add("active-before-minesweeper");
        }


        if (previouslyActiveTab) {
            previouslyActiveTab.classList.add('active');
        } else {
            const gameButton = document.querySelector('.tab-button[data-tab="game"]');
            if (gameButton) gameButton.classList.add('active');
        }

    } else console.error("Screen content not found: ", screenId);
    updateAllDisplays();
    const pipboyScreen = document.getElementById('pipboy-screen');
    if (pipboyScreen) pipboyScreen.scrollTop = 0;
}
function updateAllDisplays() {
    updateStatusDisplay(); updateInventoryDisplay(); updateDataDisplay();
    updateMapDisplay(); updatePerksDisplay(); updatePlotJournalDisplay();
    updateCompanionTab();
    if (combatActive && currentEnemy) { updateCombatDisplay(); checkCombatButtons(); }
    else if (!combatActive && document.getElementById("arena-content")?.classList.contains("active")) {
        const arenaSelection = document.getElementById("arena-selection-screen");
        const combatScreen = document.getElementById("combat-screen-content");
        if (arenaSelection) arenaSelection.style.display = 'block';
        if (combatScreen) combatScreen.style.display = 'none';
    }
     if (playerBase.isFounded && document.getElementById("base-content")?.classList.contains("active")) {
        updateBaseTabDisplay();
    }
}

// --- EVENT LISTENERS & INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired.");
    document.querySelectorAll(".tab-button").forEach(button => {
        if (button.id !== "base-tab-button") {
            button.addEventListener("click", () => {
                const tabId = button.getAttribute("data-tab");
                console.log("Tab button clicked:", tabId);
                if (combatActive && tabId !== "arena") { addLog("combat", "Сначала завершите бой.", "system"); return; }
                if (terminalHackingActive && !["status", "inv", "data", "plot", "perks", "map", "radio", "companion", "game", "base"].includes(tabId) ) { addLog("terminal", "Завершите взлом.", "system"); return; }
                if (currentMinesweeperGame && !["status", "inv", "data", "plot", "perks", "map", "radio", "companion", "game", "base"].includes(tabId)) { addLog("game", "Завершите обезвреживание ловушки.", "system"); return;}
                showTab(tabId);
            });
        }
    });

    const baseTabButton = document.getElementById('base-tab-button');
    if (baseTabButton) {
        console.log("Base tab button found, attaching listener.");
        baseTabButton.addEventListener("click", () => {
            console.log("Base tab button clicked.");
            showTab("base");
        });
    } else {
        console.warn("Base tab button (#base-tab-button) not found on DOMContentLoaded! It should be in HTML.");
    }


    document.querySelectorAll('#arena-selection-screen button').forEach(button => { button.addEventListener('click', () => startCombat(button.getAttribute('data-enemy'))); });
    document.getElementById("action-use-stimpak").onclick = () => {
        const stimpakItem = player.inventory.aid.find(i => (i.id === 'stimpak' || i.id.startsWith('stimpak_')) && i.quantity > 0);
        if (!stimpakItem) {addLog("combat", "У вас нет стимуляторов!", "system"); return;}
        const stimpakApCost = stimpakItem.apCost || 2;
        if (player.ap >= stimpakApCost) {
            player.ap -= stimpakApCost;
            if (typeof window[stimpakItem.effectFunctionName] === 'function') {
                window[stimpakItem.effectFunctionName](true);
                stimpakItem.quantity--;
                 if (stimpakItem.quantity <= 0) player.inventory.aid = player.inventory.aid.filter(i => !(i.id === stimpakItem.id && i.uniqueMarker === stimpakItem.uniqueMarker));
            }
            updateAllDisplays(); checkCombatButtons();
        } else addLog("combat", "Недостаточно ОД!", "system");
    };
    document.getElementById("action-pass-turn").onclick = () => {
        if (!combatActive || !currentEnemy || currentEnemy.hp <= 0 || player.hp <= 0) return;
        addLog("combat", "Вы пропускаете ход.", "player");
        let apToRegen = Math.floor(player.maxAp * (player.apRegenRate * 2) + player.stats.a);
        if (player.hasPerk("action_boy_1")) apToRegen = Math.floor(apToRegen * 1.35);
        player.ap = Math.min(player.maxAp, player.ap + apToRegen);
        updateCombatDisplay();
        if (player.companion && currentEnemy.hp > 0 && combatActive) companionTurn(player.companion, currentEnemy);
        if (combatActive && currentEnemy && currentEnemy.hp > 0) setTimeout(enemyTurn, 500);
        checkCombatButtons();
    };
    document.getElementById("action-leave-arena").onclick = () => {
        combatActive = false; currentEnemy = null;
        const combatScreen = document.getElementById("combat-screen-content");
        const arenaSelection = document.getElementById("arena-selection-screen");
        if (combatScreen) combatScreen.style.display = 'none';
        if (arenaSelection) arenaSelection.style.display = 'block';
        showTab("status"); updateAllDisplays();
    };
    document.getElementById("terminal-submit-button").onclick = () => processTerminalInput(document.getElementById("terminal-user-input").value);
    document.getElementById("terminal-user-input").addEventListener('keypress', (e) => { if (e.key === 'Enter') processTerminalInput(document.getElementById("terminal-user-input").value); });
    document.getElementById("terminal-exit-button").onclick = _exitTerminalHacking;
    document.getElementById("terminal-close-success-button").onclick = _exitTerminalHacking;
    document.getElementById("terminal-close-failure-button").onclick = _exitTerminalHacking;

    document.getElementById("companion-command-wait").addEventListener("click", companionCommandToggleWait);
    document.getElementById("companion-command-search").addEventListener("click", companionCommandSearch);
    document.getElementById("companion-command-dismiss").addEventListener("click", companionCommandDismiss);
    document.getElementById("companion-command-trade").addEventListener("click", () => addLog("game", "Обмен вещами с компаньоном пока не реализован.", "system"));

    document.querySelectorAll(".radio-station-button").forEach(button => {
        button.addEventListener("click", () => tuneRadio(button.dataset.station));
    });
    document.getElementById("minesweeper-exit-button").addEventListener("click", () => exitMinesweeper(false));

    Object.keys(player.limbs).forEach(limbId => player.updateLimbStatus(limbId));
    player.updateRadLevel(); player.updateNeeds();
    createBaseContentDiv();
    updateAllDisplays();
    bootUpPipBoy();

    if (playerBase.isFounded) {
        if (baseTabButton) baseTabButton.style.display = "";
        updateBaseTabDisplay();
    } else {
        if (baseTabButton) baseTabButton.style.display = "none";
    }
    recalculateBasePower();
    console.log("DOMContentLoaded complete. Initial player object:", JSON.parse(JSON.stringify(player)));
    console.log("Initial gameLocations['vault_entrance_hall']:", JSON.parse(JSON.stringify(gameLocations['vault_entrance_hall'])));
});

function bootUpPipBoy() {
    console.log("bootUpPipBoy called");
    const bootMessage = [
        "Pip-Boy OS (R) RobCo Industries", "Версия ПО: 3000.7.0", "Авторское право 2077 Корпорация Волт-Тек", "",
        "ЗАГРУЗКА СИСТЕМЫ...", "ПРОВЕРКА ПАМЯТИ.....[OK]", "ПРОВЕРКА ЦП.........[OK]", "ЗАГРУЗКА МОДУЛЕЙ...",
        "  GAME.........[ЗАГРУЖЕН]",
        "  STAT.........[ЗАГРУЖЕН]",
        "  INV..........[ЗАГРУЖЕН]", "  DATA.........[ЗАГРУЖЕН]",
        "  PLOT.........[ЗАГРУЖЕН]", "  COMP.........[ЗАГРУЖЕН]", "  PERKS........[ЗАГРУЖЕН]",
        "  MAP..........[СЕКТОР НЕИЗВЕСТЕН]", "  RADIO........[ПОИСК ЧАСТОТ]", "  BASE.........[ОЖИДАНИЕ ИНИЦИАЛИЗАЦИИ]", "",
        "ДОБРО ПОЖАЛОВАТЬ, ПОЛЬЗОВАТЕЛЬ."
    ].join('\n');

    showTab("game"); // Изначально активируем вкладку GAME

    const gameOutputEl = document.getElementById("game-output");
    if (gameOutputEl) {
        typeWriterEffect(gameOutputEl, bootMessage, 15, () => {
            console.log("Boot message typeWriterEffect completed.");
            setTimeout(() => {
                console.log("Calling setCurrentLocation from bootUpPipBoy for:", player.discoveredLocations[0] || "vault_entrance_hall");
                setCurrentLocation(player.discoveredLocations[0] || "vault_entrance_hall");
            }, 1000);
        });
    } else {
        console.error("bootUpPipBoy: game-output element not found!");
    }
}

function masterGameTick() {
    gameTickCounter++;
    let timeAdvancedThisTickInHours = 0;

    if (gameTickCounter % TICKS_PER_MINUTE_IRL === 0) {
        const minutesToAdvance = 15 + getRandomInt(0,15);
        timeAdvancedThisTickInHours = advanceTime(minutesToAdvance);
    }

    if (playerBase.isFounded && timeAdvancedThisTickInHours > 0) {
        updateBaseState(timeAdvancedThisTickInHours);
    }

     // Обновление таймеров блокировки терминалов
    Object.values(terminals).forEach(term => {
        if (term.lockedOut && term.lockoutTimeLeft > 0) {
            term.lockoutTimeLeft -= timeAdvancedThisTickInHours * TICKS_PER_GAME_HOUR;
            if (term.lockoutTimeLeft <= 0) {
                term.lockedOut = false;
                term.lockoutTimeLeft = 0;
                addLog("game", `Терминал ${term.id || '??'} снова доступен.`, "info-color");
                 // Если игрок в локации с этим терминалом и на игровом экране, обновляем выборы
                const gameIsActive = document.getElementById("game-main-content")?.classList.contains("active");
                const currentTerminalRelevant = (currentLocationId === "vault_entrance_hall" && term.id === "vault_door_terminal") ||
                                            (currentLocationId === "overseer_office" && term.id === "overseer_terminal") ||
                                            (currentLocationId === "red_rocket_station" && term.id === "red_rocket_terminal");
                if (gameIsActive && currentTerminalRelevant) {
                    renderLocation(currentLocationId);
                }
            }
        }
    });


    const currentLocData = gameLocations[currentLocationId];
    if (currentLocData && currentLocData.radExposure && gameTickCounter % (TICKS_PER_MINUTE_IRL * 2) === 0) {
        let radAmount = currentLocData.radExposure;
        if(currentWeather === "Радиационная буря") radAmount *= 3;
        if (radAmount > 0) {
            player.addRads(radAmount);
            if (player.hp > 0) {
                 addLog("game", `Вы чувствуете, как радиация проникает в тело (+${radAmount} RAD).`, "system");
            }
        }
    }

    if (currentRadioStation !== "off" && gameTickCounter % 5 === 0) {
        if (storyTexts.radioStationContent[currentRadioStation] && storyTexts.radioStationContent[currentRadioStation].length > 0) {
            const messages = storyTexts.radioStationContent[currentRadioStation];
            addRadioMessage(messages[getRandomInt(0, messages.length -1)]);
        }
    }
    if (player.isStealthActive && Math.random() < 0.05 && !combatActive) {
        addLog("game", "Вы случайно привлекли к себе внимание и вышли из режима скрытности.", "warning-color");
        player.isStealthActive = false;
    }

    updateStatusDisplay();
}
// script.js
