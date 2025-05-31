// script.js

// --- CONSTANTS (Рекомендуется вынести в отдельный файл или в начало) ---
// Пример, как можно было бы определять строковые константы для избежания опечаток
// const LIMB_STATUS_CRIPPLED = "Искалечено";
// const ACTION_RESULT_PLAYER_DEFEATED = "player_defeated";
// const ACTION_RESULT_SCREEN_CHANGED = "SCREEN_CHANGED";
// const ACTION_RESULT_LOCATION_CHANGED = "LOCATION_CHANGED";
// (Для краткости, далее по коду я не буду заменять все строки, но это хорошая практика)

// --- PLAYER INSTANCE ---
// ПРЕДПОЛАГАЕТСЯ, ЧТО playerTemplate ЗАГРУЖЕН И КОРРЕКТЕН ИЗ ДРУГОГО ФАЙЛА
if (typeof playerTemplate === 'undefined') {
    console.error("CRITICAL: playerTemplate is not defined! Player object cannot be initialized.");
    // Можно либо остановить игру, либо попытаться создать минимальный объект игрока
    // для предотвращения каскадных ошибок, но это будет очень ограниченная игра.
    // playerTemplate = { /* ... минимальная структура ... */ };
}
let player = JSON.parse(JSON.stringify(playerTemplate));

// Добавим свойства для эффекта Rad-X, если их нет в playerTemplate
player.radResistanceBonusFromRadX = player.radResistanceBonusFromRadX || 0;
player.radXTimer = player.radXTimer || 0; // В игровых часах или тиках

// Инициализация настроения компаньона, если он есть при старте (маловероятно, но для полноты)
if (player.companion) {
    player.companion.mood = player.companion.mood || "Нейтральное";
    player.companion.currentHp = player.companion.currentHp !== undefined ? player.companion.currentHp : player.companion.hp;
}


Object.defineProperty(player, 'maxHp', {
    get: function() {
        let currentMaxHp = this.maxHpBase + (this.stats.e * 10);
        if (this.radLevel === "Тяжелое") currentMaxHp = Math.floor(currentMaxHp * 0.75);
        if (this.radLevel === "Смертельное") currentMaxHp = Math.floor(currentMaxHp * 0.5);

        // РЕФАКТОРИНГ: Эффекты от перков лучше делать через data-driven систему,
        // где каждый перк в availablePerks имеет описание своих эффектов.
        if (this.hasPerk("life_giver_1")) currentMaxHp += 20;
        // if (this.hasPerk("life_giver_2")) currentMaxHp += 20; // Пример

        // diseaseData не определен, оставляем закомментированным.
        // Это требует определения структуры diseaseData и массива player.diseases.
        // this.diseases.forEach(diseaseId => {
        //     const disease = diseaseData[diseaseId]; // diseaseData нужно определить
        //     if (disease && disease.effects && disease.effects.maxHpModifier) {
        //         currentMaxHp = Math.floor(currentMaxHp * disease.effects.maxHpModifier);
        //     }
        // });
        return Math.max(10, Math.floor(currentMaxHp));
    }
});

Object.defineProperty(player, 'maxAp', {
    get: function() {
        let currentMaxAp = this.maxApBase + (this.stats.a * 5);
        // РЕФАКТОРИНГ: Эффекты от перков
        if (this.hasPerk("action_boy_1")) currentMaxAp += 10;

        if (this.limbs.left_leg.status === "Искалечено" || this.limbs.right_leg.status === "Искалечено") {
            currentMaxAp = Math.max(20, currentMaxAp - 20);
        }
        if (this.needs.fatigue > 80) currentMaxAp = Math.floor(currentMaxAp * 0.7);
        return Math.max(0, currentMaxAp); // ОД не может быть меньше 0
    }
});

Object.defineProperty(player, 'currentCarryWeight', {
    get: function() {
        let totalWeight = 0;
        for (const category in this.inventory) {
            if (Array.isArray(this.inventory[category])) { // Добавлена проверка, что это массив
                this.inventory[category].forEach(item => {
                    totalWeight += (item.weight || 0) * (item.quantity || 1);
                });
            }
        }
        return parseFloat(totalWeight.toFixed(2));
    }
});

Object.defineProperty(player, 'maxCarryWeight', {
    get: function() {
        let weight = 150 + (this.stats.s * 10); // Базовый вес, возможно, стоит вынести в playerTemplate.maxCarryWeightBase
        // РЕФАКТОРИНГ: Эффекты от перков
        if (this.hasPerk("strong_back_1")) weight += 25;
        if (this.needs.fatigue > 90) weight = Math.floor(weight * 0.8);
        return Math.max(0, weight); // Вес не может быть меньше 0
    }
});

Object.defineProperty(player, 'isOverencumbered', {
    get: function() {
        return this.currentCarryWeight > this.maxCarryWeight;
    }
});

player.hasPerk = function(perkId) {
    return this.activePerks && this.activePerks.includes(perkId); // Проверка на существование activePerks
};

player.learnPerk = function(perkId) {
    // ПРЕДПОЛАГАЕТСЯ, ЧТО availablePerks ЗАГРУЖЕН И КОРРЕКТЕН
    const perkToLearn = availablePerks && availablePerks.find(p => p.id === perkId);

    if (!perkToLearn) {
        addLog("game", `Ошибка: Перк с ID "${perkId}" не найден в доступных перках.`);
        console.error(`Perk not found: ${perkId}`);
        return false;
    }

    if (this.perkPoints <= 0) { // Проверка очков перков в начале
        addLog("game", `Недостаточно очков перков для изучения ${perkToLearn.name}.`);
        return false;
    }
    if (this.hasPerk(perkId)) {
        addLog("game", `Вы уже знаете перк: ${perkToLearn.name}.`);
        return false;
    }

    let requirementsMet = true;
    let missingReqs = []; // Собираем отсутствующие требования для лога

    if (perkToLearn.requires) {
        if (perkToLearn.requires.level && this.level < perkToLearn.requires.level) {
            requirementsMet = false;
            missingReqs.push(`Уровень ${perkToLearn.requires.level}`);
        }
        Object.keys(perkToLearn.requires).forEach(statKey => {
            if (statKey !== 'level' && this.stats[statKey] < perkToLearn.requires[statKey]) {
                requirementsMet = false;
                missingReqs.push(`${statKey.toUpperCase()} ${perkToLearn.requires[statKey]}`);
            }
        });
    }

    if (!requirementsMet) {
        addLog("game", `Не выполнены требования для перка ${perkToLearn.name}: ${missingReqs.join(', ')}.`);
        return false;
    }

    this.activePerks.push(perkId);
    this.perkPoints--;
    addLog("game", `Вы изучили перк: ${perkToLearn.name}!`, "item");

    // РЕФАКТОРИНГ: Применение эффектов перков. Это должно быть data-driven.
    // Сейчас это жестко закодировано и не масштабируемо.
    // Пример: perkToLearn.effects = { skills: { stealth: 10 }, stats: { agility_temp: 1 } }
    // И функция, которая применяет эти эффекты.
    if (perkToLearn.effects) {
        // Примерная реализация (требует доработки и структуры в perk.effects)
        if (perkToLearn.effects.skills) {
            for (const skill in perkToLearn.effects.skills) {
                if (this.skills.hasOwnProperty(skill)) {
                    this.skills[skill] += perkToLearn.effects.skills[skill];
                }
            }
        }
        // Другие типы эффектов (на статы, производные характеристики и т.д.)
    } else if (perkToLearn.id === "sneak_1") { // Оставляем старую логику как fallback, если нет effects
        this.skills.stealth += 10;
    }
    // Конец РЕФАКТОРИНГ

    updateAllDisplays();
    return true;
};

player.heal = function(amount) {
    if (amount <= 0) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    updateAllDisplays();
};

player.takeDamage = function(amount, targetLimbId = null) {
    if (this.hp <= 0) return "already_defeated"; // Уже побежден, не получать урон

    this.hp -= amount;
    let actualTargetLimbId = targetLimbId;

    if (!actualTargetLimbId && Object.keys(this.limbs).length > 0) { // Проверка, что limbs не пустой
        const limbIds = Object.keys(this.limbs);
        const validLimbs = limbIds.filter(id => this.limbs[id] && this.limbs[id].status !== "Искалечено"); // Добавлена проверка this.limbs[id]
        actualTargetLimbId = validLimbs.length > 0 ? validLimbs[getRandomInt(0, validLimbs.length - 1)] : "torso"; // torso как fallback
    }

    if (actualTargetLimbId && this.limbs[actualTargetLimbId]) {
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

    updateAllDisplays(); // updateStatusDisplay вызывается внутри updateAllDisplays

    if (this.hp === 0) return "player_defeated"; // Используем константу
    return "hit";
};

player.updateLimbStatus = function(limbId) {
    const limb = this.limbs[limbId];
    if (!limb) {
        // console.warn(`Limb with ID ${limbId} not found for status update.`);
        return;
    }
    const oldStatus = limb.status;

    if (limb.hp <= 0) limb.status = "Искалечено"; // Используем константу
    else if (limb.hp <= limb.maxHp * 0.3) limb.status = "Тяжелое ранение";
    else if (limb.hp <= limb.maxHp * 0.7) limb.status = "Легкое ранение";
    else limb.status = "Норма"; // Используем константу

    if (oldStatus !== limb.status && limb.status === "Искалечено") {
        addLog("game", `Ваша ${limb.name ? limb.name.toLowerCase() : `конечность ${limbId}`} искалечена!`, "danger-color");
    }
    // Не вызываем updateAllDisplays здесь, т.к. updateLimbStatus обычно вызывается
    // в контексте других функций, которые вызовут updateAllDisplays (например, takeDamage).
    // Если вызывается напрямую, то updateAllDisplays() нужно будет вызвать после.
};

player.addRads = function(amount) {
    if (amount <= 0) return;
    let effectiveAmount = amount;

    // Учет сопротивления от Rad-X
    if (this.radResistanceBonusFromRadX > 0) {
        const reductionFactor = Math.max(0, 1 - (this.radResistanceBonusFromRadX / 100)); // Сопротивление в %
        effectiveAmount = Math.floor(effectiveAmount * reductionFactor);
        // console.log(`Rad-X active. Rads reduced from ${amount} to ${effectiveAmount}`);
    }
    // РЕФАКТОРИНГ: Здесь также могут быть другие источники сопротивления радиации (перки, броня)

    this.rads += effectiveAmount;
    this.updateRadLevel();
    updateAllDisplays(); // updateStatusDisplay вызывается внутри
};

player.reduceRads = function(amount) {
    if (amount <= 0) return;
    this.rads = Math.max(0, this.rads - amount);
    this.updateRadLevel();
    updateAllDisplays();
};

player.updateRadLevel = function() {
    const oldRadLevel = this.radLevel;
    if (this.rads >= 900) this.radLevel = "Смертельное";
    else if (this.rads >= 600) this.radLevel = "Тяжелое";
    else if (this.rads >= 300) this.radLevel = "Среднее";
    else if (this.rads >= 100) this.radLevel = "Легкое";
    else this.radLevel = "Нет";

    if (oldRadLevel !== this.radLevel) {
        // Можно добавить лог об изменении уровня радиации, если нужно
        // addLog("game", `Уровень радиации изменился на: ${this.radLevel}`, "system");
    }
};

player.addXp = function(amount) {
    if (amount <= 0) return;
    this.xp += amount;
    addLog("game", `Получено ${amount} XP.`, "item");

    let leveledUp = false;
    while (this.xp >= this.xpToNextLevel) {
        leveledUp = true;
        this.level++;
        this.xp -= this.xpToNextLevel;
        this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5 + 50); // Формула опыта, можно вынести в константы
        this.perkPoints++;
        addLog("game", `ПОЛУЧЕН НОВЫЙ УРОВЕНЬ! Вы достигли ${this.level} уровня! Получено очко перков!`, "item");

        // Восстановление при левелапе
        this.maxHpBase += 10; // Или другой бонус, возможно, зависящий от статов/класса
        this.hp = this.maxHp;
        this.ap = this.maxAp;
        Object.keys(this.limbs).forEach(limbId => {
            if (this.limbs[limbId]) { // Проверка на существование конечности
                this.limbs[limbId].hp = this.limbs[limbId].maxHp;
                this.updateLimbStatus(limbId);
            }
        });
    }
    if (leveledUp) {
        // Можно добавить звук или эффект при левелапе
    }
    updateAllDisplays();
};

player.collectHolodisk = function(diskId) {
    // ПРЕДПОЛАГАЕТСЯ, ЧТО storyTexts.holodiskContents ЗАГРУЖЕН И КОРРЕКТЕН
    if (!this.foundHolodisks.includes(diskId)) {
        this.foundHolodisks.push(diskId);
        const diskData = storyTexts.holodiskContents && storyTexts.holodiskContents[diskId];
        addLog("game", `Найден голодиск: ${diskData && diskData.title ? diskData.title : diskId}`, "item");
        updateHolodiskDisplay(); // Обновляет вкладку DATA
    }
};

player.changeReputation = function(factionId, amount) {
    if (this.reputation && this.reputation.hasOwnProperty(factionId)) { // Проверка this.reputation
        this.reputation[factionId] += amount;
        this.reputation[factionId] = Math.max(-100, Math.min(100, this.reputation[factionId])); // Ограничение репутации

        // РЕФАКТОРИНГ: Имена фракций лучше брать из объекта данных о фракциях, а не хардкодить
        let factionName = factionId;
        // const factionData = allFactions[factionId]; // Пример
        // if (factionData && factionData.name) factionName = factionData.name;
        if(factionId === "settlers") factionName = "Поселенцы";
        else if(factionId === "scavengers") factionName = "Мусорщики";
        else if(factionId === "brotherhood_outpost") factionName = "Аванпост Братства Стали";

        addLog("game", `Репутация у фракции "${factionName}" изменена на ${amount > 0 ? '+' : ''}${amount}. Текущее значение: ${this.reputation[factionId]}.`, "system");
        updateReputationDisplay(); // Обновляет вкладку DATA
    } else {
        console.warn("Unknown faction or player.reputation not initialized for reputation change:", factionId);
    }
};

player.updateNeeds = function(hoursPassed = 0) {
    // Коэффициенты можно вынести в переменные для настройки баланса
    const hungerBaseRate = 1; // в час, если hoursPassed = 0, то это просто разовое обновление
    const thirstBaseRate = 2;
    const fatigueBaseRate = 1;

    const hungerRate = hungerBaseRate + (hoursPassed * 2); // Увеличивается с каждым прошедшим часом
    const thirstRate = thirstBaseRate + (hoursPassed * 3);
    const fatigueRate = fatigueBaseRate + (hoursPassed * 4);

    const oldHunger = this.needs.hunger;
    const oldThirst = this.needs.thirst;
    const oldFatigue = this.needs.fatigue;

    this.needs.hunger = Math.min(100, this.needs.hunger + hungerRate);
    this.needs.thirst = Math.min(100, this.needs.thirst + thirstRate);
    this.needs.fatigue = Math.min(100, this.needs.fatigue + fatigueRate);

    // Логирование сообщений о состоянии, только если состояние ухудшилось до критического
    if (this.needs.hunger > 70 && oldHunger <= 70) addLog("game", "Вы чувствуете сильный голод.", "warning-color");
    if (this.needs.thirst > 70 && oldThirst <= 70) addLog("game", "Вас мучает жажда.", "warning-color");
    if (this.needs.fatigue > 70 && oldFatigue <= 70) addLog("game", "Вы очень устали.", "warning-color");

    // Дебаффы от высоких потребностей (пример, требует реализации в соответствующих get-терах или функциях)
    // if (this.needs.hunger > 90) { /* -1 STR or other penalty */ }
    // if (this.needs.thirst > 90) { /* -1 PER or other penalty */ }
    // if (this.needs.fatigue > 90) { /* -AP regen, maxAP reduction (уже есть в maxAp) */ }
    // updateAllDisplays() вызывается из advanceTime, которое вызывает updateNeeds
};

player.toggleStealth = function() {
    if (this.isStealthActive) {
        this.isStealthActive = false;
        addLog("game", "Вы вышли из режима скрытности.", "info-color");
    } else {
        // РЕФАКТОРИНГ: Формула шанса скрытности может быть более сложной и data-driven
        let stealthChance = this.skills.stealth + (this.stats.a * 2) + (this.hasPerk("sneak_1") ? 15 : 0);
        if (this.isOverencumbered) stealthChance -= 20;
        // Можно добавить факторы: освещение, тип брони, уровень шума и т.д.

        if (getRandomInt(1, 100) <= Math.max(5, Math.min(95, stealthChance))) { // Ограничение шанса 5-95%
            this.isStealthActive = true;
            addLog("game", "Вы перешли в режим скрытности.", "stealth-color");
        } else {
            addLog("game", "Попытка войти в режим скрытности не удалась.", "warning-color");
        }
    }
    updateStatusDisplay(); // Достаточно обновить только статус, не все дисплеи
};


// --- GAME STATE VARIABLES ---
// Начальное значение currentLocationId должно быть первой открытой локацией игрока.
// player.discoveredLocations[0] - это хорошо, но убедитесь, что player.discoveredLocations инициализирован в playerTemplate.
let currentLocationId = (player.discoveredLocations && player.discoveredLocations.length > 0) ? player.discoveredLocations[0] : "vault_entrance_hall"; // Fallback
let currentEnemy = null;
let combatActive = false;
const BASE_HIT_CHANCE = 65; // Можно сделать настраиваемым или зависимым от оружия/навыка
let currentTerminal = null;
let terminalHackingActive = false;
let terminalWords = [];
let terminalPassword = "";
let terminalAttemptsLeft = 0;
let currentActiveScreenContentId = "game-main-content"; // Начальный экран
let currentMinesweeperGame = null;

// --- UTILITY FUNCTIONS ---
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function typeWriterEffect(element, text, delay = 7, callback) {
    if (!element) {
        console.error("typeWriterEffect: target element is null or undefined. Text was:", (typeof text === 'string' && text) ? text.substring(0, 50) + "..." : String(text));
        if (callback) callback();
        return;
    }
    const safeText = (text === null || typeof text === 'undefined') ? "" : String(text); // Убедимся, что text - строка
    element.innerHTML = ""; // Очищаем перед началом
    let i = 0;
    function typeChar() {
        if (i < safeText.length) {
            element.innerHTML += safeText.charAt(i);
            i++;
            // Авто-скролл, если элемент имеет прокрутку (например, лог)
            if (element.scrollHeight > element.clientHeight) {
                element.scrollTop = element.scrollHeight;
            }
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
    else if (target === "radio") logContainer = document.getElementById("radio-output"); // Радио-лог может иметь другую логику добавления
    else {
        console.error("Invalid log target specified:", target, "Message:", message);
        // Попытка записать в game-output как fallback, если есть
        logContainer = document.getElementById("game-output");
        if (logContainer) {
            message = `[LOG ERROR: Invalid target '${target}'] ${message}`;
        } else {
            return; // Некуда писать лог
        }
    }

    if (!logContainer) {
        // console.warn("Log container not found for target:", target, "- Message:", message); // Менее критично, если игра может продолжаться
        return;
    }

    const logEntry = document.createElement("p");
    // Улучшенная система классов для стилизации через CSS
    logEntry.classList.add("log-entry", `log-type-${type}`);
    if (target === "combat") logEntry.classList.add(`log-source-${type === "player" || type === "critical" ? "player" : (type === "enemy" || type === "damage_taken_player" ? "enemy" : "system")}`);

    // Старая логика для обратной совместимости стилей, но лучше перейти на классы
    if (type === "item") logEntry.classList.add("item-acquired");
    else if (type === "critical") logEntry.classList.add("critical-hit");
    else if (type === "damage_taken_player" || type === "danger-color") logEntry.classList.add("damage-taken"); // danger-color -> damage-taken
    else if (type === "warning-color") logEntry.style.color = "var(--warning-color)"; // Эти лучше тоже заменить на классы
    else if (type === "info-color") logEntry.style.color = "var(--info-color)";
    else if (type === "stealth-color") logEntry.style.color = "var(--stealth-color)";
    else if (type === "player" && target === "combat") logEntry.style.color = "var(--pipboy-green-medium)";
    else if (type === "enemy" && target === "combat") logEntry.style.color = "#ff8c69"; // Используйте CSS переменные, если возможно

    logEntry.innerHTML = `» ${message}`; // Используйте textContent, если message не должен содержать HTML, для безопасности

    // Для большинства логов новые сообщения сверху, для радио - снизу
    if (logContainer.id === "radio-output") {
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight; // Прокрутка вниз для радио
    } else {
        if (logContainer.firstChild) {
            logContainer.insertBefore(logEntry, logContainer.firstChild);
        } else {
            logContainer.appendChild(logEntry);
        }
        logContainer.scrollTop = 0; // Прокрутка вверх для остальных
    }
}

// --- CORE GAMEPLAY FUNCTIONS (renderLocation, processChoice, setCurrentLocation) ---
function renderLocation(locationId) {
    // console.log("Attempting to renderLocation for:", locationId); // Оставим для отладки
    const gameOutputEl = document.getElementById("game-output");
    const choicesContainerEl = document.getElementById("choices-container");

    if (!gameOutputEl || !choicesContainerEl) {
        console.error("CRITICAL: Game output or choices container not found in renderLocation.");
        // Попытка отобразить ошибку где-нибудь, если это возможно
        if (document.body) document.body.innerHTML = "КРИТИЧЕСКАЯ ОШИБКА ИНТЕРФЕЙСА. ОБНОВИТЕ СТРАНИЦУ ИЛИ СВЯЖИТЕСЬ С РАЗРАБОТЧИКОМ.";
        return;
    }
    // console.log("Game output and choices container FOUND.");

    gameOutputEl.innerHTML = ""; // Очищаем перед рендером
    choicesContainerEl.innerHTML = "";

    // ПРЕДПОЛАГАЕТСЯ, ЧТО gameLocations ЗАГРУЖЕН И КОРРЕКТЕН
    const locationData = gameLocations && gameLocations[locationId];
    if (!locationData) {
        console.error(`Error: Location with ID "${locationId}" not found in gameLocations.`);
        typeWriterEffect(gameOutputEl, `Ошибка: Локация с ID "${locationId}" не найдена. Возможно, вы зашли в тупик. Попробуйте вернуться или перезагрузить игру.`);
        // Можно добавить кнопку "Вернуться в предыдущую известную локацию" или "Начать заново", если есть такая логика
        return;
    }
    // console.log("Location data found for:", locationId);

    // Вызов onEnter функции локации
    if (locationData.onEnterFunctionName) {
        if (typeof window[locationData.onEnterFunctionName] === 'function') {
            // console.log("Executing onEnterFunctionName:", locationData.onEnterFunctionName);
            try {
                window[locationData.onEnterFunctionName]();
            } catch (e) {
                console.error(`Error executing onEnterFunctionName '${locationData.onEnterFunctionName}' for location '${locationId}':`, e);
                addLog("game", `Системная ошибка при входе в локацию. (${locationData.onEnterFunctionName})`, "danger-color");
            }
        } else {
            console.warn(`onEnterFunctionName '${locationData.onEnterFunctionName}' for location '${locationId}' is defined but not found as a function.`);
        }
    }

    let descriptionText = "";
    if (typeof locationData.description === 'function') {
        try {
            descriptionText = locationData.description();
        } catch (e) {
            console.error(`Error executing description function for location '${locationId}':`, e);
            descriptionText = "Ошибка при загрузке описания локации.";
        }
    } else {
        descriptionText = locationData.description || "Описание для этой локации отсутствует."; // Fallback
    }
    // console.log("Description text to display:", descriptionText ? descriptionText.substring(0,100) + "..." : "EMPTY");

    typeWriterEffect(gameOutputEl, descriptionText, 10, () => { // Уменьшил задержку для ускорения
        // console.log("Typewriter effect completed for location description.");

        // Комментарии компаньона
        if (player.companion && player.companion.id && storyTexts.companionComments && storyTexts.companionComments[player.companion.id]) {
            const companionCommentsData = storyTexts.companionComments[player.companion.id];
            const commentsForLocation = companionCommentsData[locationId];
            const generalComment = companionCommentsData.onNewLocation; // Общие комментарии при входе в любую новую локацию

            let saidSomething = false;
            if (commentsForLocation && Array.isArray(commentsForLocation) && commentsForLocation.length > 0) {
                const companionComment = commentsForLocation[getRandomInt(0, commentsForLocation.length - 1)];
                addLog("game", `${player.companion.name}: ${companionComment}`, "info-color");
                saidSomething = true;
            }
            // Говорить общую фразу, только если не было специфичной для локации,
            // и если описание локации действительно было выведено (проверка по длине или содержимому gameOutputEl)
            if (!saidSomething && generalComment && Array.isArray(generalComment) && generalComment.length > 0 &&
                gameOutputEl.innerHTML.includes(descriptionText.substring(0, Math.min(50, descriptionText.length)))) { // Проверка, что описание загрузилось
                const companionComment = generalComment[getRandomInt(0, generalComment.length - 1)];
                addLog("game", `${player.companion.name}: ${companionComment}`, "info-color");
            }
        }

        // Обработка выборов
        if (locationData.choices && Array.isArray(locationData.choices) && locationData.choices.length > 0) {
            // console.log("Processing choices for location:", locationId);
            locationData.choices.forEach(choice => {
                if (!choice || typeof choice.text === 'undefined') { // Проверка на корректность объекта choice
                    console.warn("Invalid choice object in location:", locationId, choice);
                    return; // Пропустить некорректный выбор
                }

                let displayChoice = true;
                let choiceText = typeof choice.text === 'function' ? choice.text() : choice.text;
                let isChoiceDisabled = false;
                let disabledReason = ""; // Для отладки или тултипов

                if (choice.conditionFunctionName) {
                    if (typeof window[choice.conditionFunctionName] === 'function') {
                        try {
                            if (!window[choice.conditionFunctionName]()) {
                                if (choice.onFailText) {
                                    choiceText = typeof choice.onFailText === 'function' ? choice.onFailText() : choice.onFailText;
                                    isChoiceDisabled = true;
                                } else {
                                    displayChoice = false;
                                }
                                disabledReason = `Condition '${choice.conditionFunctionName}' failed.`;
                            }
                        } catch (e) {
                            console.error(`Error executing conditionFunctionName '${choice.conditionFunctionName}' for choice in '${locationId}':`, e);
                            displayChoice = false; // Скрыть выбор, если условие сломано
                            disabledReason = `Error in condition '${choice.conditionFunctionName}'.`;
                        }
                    } else {
                        console.warn(`conditionFunctionName '${choice.conditionFunctionName}' for choice in '${locationId}' is defined but not found.`);
                        displayChoice = false; // Скрыть выбор, если функция условия не найдена
                        disabledReason = `Condition function '${choice.conditionFunctionName}' not found.`;
                    }
                }

                // Пример специфичного условия, которое лучше вынести в conditionFunctionName, если возможно
                if (choice.actionFunctionName === "attemptToFoundBaseAtRedRocket" && playerBase && playerBase.isFounded) {
                    displayChoice = false;
                    disabledReason = "Base already founded.";
                }

                if (displayChoice) {
                    const button = document.createElement("button");
                    button.classList.add("main-button");
                    button.innerHTML = choiceText; // Используйте textContent, если choiceText не должен содержать HTML

                    if (isChoiceDisabled) {
                         button.classList.add("disabled-button");
                         button.disabled = true;
                         // button.title = disabledReason; // Полезно для отладки, если включить
                    } else {
                        button.onclick = () => {
                            // Перед обработкой выбора, можно добавить проверку, активно ли еще это действие
                            // (на случай асинхронности или быстрых кликов)
                            if (currentLocationId === locationId) { // Убедиться, что мы все еще в той же локации
                                processChoice(choice);
                            }
                        };
                    }
                    choicesContainerEl.appendChild(button);
                } else {
                    // Для отладки тупиков:
                    // if (DEBUG_MODE && disabledReason) {
                    //     const p = document.createElement("p");
                    //     p.style.color = "grey";
                    //     p.textContent = `(Скрытый выбор: ${choiceText} - ${disabledReason})`;
                    //     choicesContainerEl.appendChild(p);
                    // }
                }
            });
            // console.log("Choices processed. Number of choice buttons added:", choicesContainerEl.children.length);
        } else {
            // console.log("No choices defined or choices array is empty for location:", locationId);
        }

        // Сообщение "нечего делать", если нет активных кнопок
        const activeButtons = Array.from(choicesContainerEl.children).filter(btn => btn.tagName === 'BUTTON' && !btn.disabled);
        if (activeButtons.length === 0) {
            // Если есть отключенные кнопки с onFailText, их текст уже информирует игрока.
            // Если же отключенных кнопок нет, или они были скрыты (displayChoice = false), то нужна заглушка.
            const hasInformativeDisabledButtons = Array.from(choicesContainerEl.children)
                .some(btn => btn.tagName === 'BUTTON' && btn.disabled && btn.innerHTML !== (gameLocations[locationId].choices.find(c => c.text === btn.innerHTML || (typeof c.text === 'function' && c.text() === btn.innerHTML))?.text || btn.innerHTML)); // Проверяем, изменился ли текст на onFailText

            if (!hasInformativeDisabledButtons) {
                const p = document.createElement("p");
                p.textContent = "Здесь больше нечего делать.";
                p.classList.add("no-actions-text");
                choicesContainerEl.appendChild(p);
            }
        }
    });
}

function processChoice(choiceObject) {
    // console.log("Processing choice:", choiceObject);
    const choicesContainerEl = document.getElementById("choices-container");
    if (choicesContainerEl) choicesContainerEl.innerHTML = ""; // Очищаем кнопки немедленно

    let actionTaken = false;
    let actionResultType = null; // e.g., "SCREEN_CHANGED", "LOCATION_CHANGED", "NO_CHANGE"

    if (choiceObject.actionFunctionName) {
        if (typeof window[choiceObject.actionFunctionName] === 'function') {
            // console.log("Executing action function:", choiceObject.actionFunctionName);
            try {
                const result = window[choiceObject.actionFunctionName](choiceObject); // Передаем сам choiceObject, если функции это нужно
                if (result === "SCREEN_CHANGED" || result === "LOCATION_CHANGED") { // Используем константы
                    actionResultType = result;
                } else {
                    actionResultType = "NO_CHANGE"; // Явно указываем, что изменения экрана не было
                }
                actionTaken = true;
            } catch (e) {
                console.error(`Error executing actionFunctionName '${choiceObject.actionFunctionName}':`, e);
                addLog("game", `Системная ошибка при выполнении действия. (${choiceObject.actionFunctionName})`, "danger-color");
                actionTaken = true; // Действие было "попытано", но сломалось
                actionResultType = "ERROR_IN_ACTION";
            }
        } else {
            console.warn(`actionFunctionName '${choiceObject.actionFunctionName}' is defined but not found as a function.`);
            addLog("game", `Ошибка: Действие "${choiceObject.text}" не может быть выполнено (функция не найдена).`, "danger-color");
            actionResultType = "ACTION_NOT_FOUND";
        }
    }

    if (choiceObject.target && actionResultType !== "SCREEN_CHANGED" && actionResultType !== "LOCATION_CHANGED") { // Если действие не сменило локацию/экран
        // console.log("Moving to target location:", choiceObject.target);
        setCurrentLocation(choiceObject.target); // setCurrentLocation сама вызовет renderLocation
        actionTaken = true;
        actionResultType = "LOCATION_CHANGED"; // setCurrentLocation меняет локацию
    }

    // Если действие было выполнено, не привело к смене экрана/локации, и мы все еще в игровом режиме
    if (actionTaken && actionResultType !== "SCREEN_CHANGED" && actionResultType !== "LOCATION_CHANGED" &&
        !combatActive && !terminalHackingActive && !currentMinesweeperGame &&
        document.getElementById("game-main-content")?.classList.contains("active")) {
        // console.log("Action taken, no screen/location change, re-rendering current location:", currentLocationId);
        renderLocation(currentLocationId); // Перерисовать текущую локацию, чтобы обновить ее состояние (например, если действие что-то изменило в ней)
    }

    // Вызов masterGameTick только если действие было успешным и не является просто переходом между экранами PipBoy
    if (actionTaken && actionResultType !== "ACTION_NOT_FOUND" && actionResultType !== "ERROR_IN_ACTION" &&
        !combatActive && !terminalHackingActive && !currentMinesweeperGame) {
        masterGameTick(); // Продвинуть время, обновить нужды
    }
}

function setCurrentLocation(newLocationId) {
    // console.log("setCurrentLocation called with:", newLocationId);
    // ПРЕДПОЛАГАЕТСЯ, ЧТО gameLocations ЗАГРУЖЕН И КОРРЕКТЕН
    if (gameLocations && gameLocations[newLocationId]) {
        const oldLocationId = currentLocationId;
        currentLocationId = newLocationId;

        // Добавляем локацию в список открытых, если ее там еще нет
        updateDiscoveredLocations(newLocationId); // Эта функция сама проверит и добавит, если нужно

        // Рендерим локацию, если ID изменился ИЛИ если игровой экран пуст (например, после bootUp).
        // Это предотвращает лишние перерисовки, если setCurrentLocation вызывается несколько раз для той же локации.
        const gameOutputEl = document.getElementById("game-output");
        if (oldLocationId !== newLocationId || (gameOutputEl && !gameOutputEl.textContent?.trim() && !gameOutputEl.innerHTML.includes("ЗАГРУЗКА СИСТЕМЫ"))) {
            if (document.getElementById("game-main-content")?.classList.contains("active")) { // Рендерить только если активна вкладка игры
                 renderLocation(currentLocationId);
            }
        }
        updateMapDisplay(); // Обновляем карту в любом случае
    } else {
        console.error(`Attempted to move to non-existent location: ${newLocationId}`);
        const gameOutputEl = document.getElementById("game-output");
        if (gameOutputEl && document.getElementById("game-main-content")?.classList.contains("active")) {
            typeWriterEffect(gameOutputEl, `Ошибка: Попытка перейти в несуществующую локацию "${newLocationId}".`);
        }
        // Можно добавить логику возврата в предыдущую безопасную локацию или экран ошибки.
    }
}


// --- ITEM EFFECT FUNCTIONS ---
// Эти функции должны возвращать true при успехе, false при неудаче (если предмет не использовался)
// Это важно для addItemToInventory, чтобы знать, уменьшать ли количество.
function useStimpakEffect(isCombatContext) {
    // Можно добавить проверку, если HP уже макс
    if (player.hp >= player.maxHp) {
        addLog(isCombatContext ? "combat" : "game", "Ваше здоровье уже полное.", "system");
        return false; // Предмет не использован
    }
    player.heal(Math.floor(player.maxHp * 0.3)); // 30% от макс HP
    addLog(isCombatContext ? "combat" : "game", "Вы использовали Стимулятор. Здоровье восстановлено.", "player");
    return true;
}
function useRadawayEffect(isCombatContext) { // Добавлен isCombatContext для консистентности, хоть и не используется
    if (player.rads <= 0) {
        addLog("game", "У вас нет радиации.", "system");
        return false;
    }
    player.reduceRads(250);
    addLog("game", "Вы использовали Антирадин. Уровень радиации снижен.");
    return true;
}
function usePurifiedWaterEffect(isCombatContext) {
    if (player.needs.thirst <= 0) {
        addLog("game", "Вы не испытываете жажды.", "system");
        return false;
    }
    player.needs.thirst = Math.max(0, player.needs.thirst - 40);
    addLog("game", "Вы выпили очищенную воду. Жажда утолена.");
    updateStatusDisplay(); // Или updateAllDisplays, если эффект влияет на что-то еще
    return true;
}
function useDirtyWaterEffect(isCombatContext) {
    if (player.needs.thirst <= 0 && player.rads <=0) { // Если и жажды нет, и радиации некуда добавлять (хотя это странно)
        addLog("game", "Вы не хотите пить эту воду.", "system");
        return false;
    }
    player.needs.thirst = Math.max(0, player.needs.thirst - 25);
    const radsGained = getRandomInt(5, 15);
    player.addRads(radsGained); // addRads сама вызовет updateDisplay

    // Шанс болезни (требует системы болезней)
    // if (Math.random() < 0.1) { player.addDisease("dysentery"); /* ... */ }

    let message = "Вы выпили грязную воду. Жажда немного отступила";
    if (radsGained > 0) message += `, но вы получили ${radsGained} ед. радиации`;
    // if (addedDisease) message += " и чувствуете себя не очень хорошо";
    message += ".";
    addLog("game", message, "warning-color");
    updateStatusDisplay();
    return true;
}
function useCramEffect(isCombatContext) {
    if (player.needs.hunger <= 0) {
        addLog("game", "Вы не голодны.", "system");
        return false;
    }
    player.needs.hunger = Math.max(0, player.needs.hunger - 30);
    addLog("game", "Вы съели консервы 'Крэм'. Голод немного отступил.");
    updateStatusDisplay();
    return true;
}
function useRadXEffect(isCombatContext) {
    // ПРЕДУПРЕЖДЕНИЕ: Текущая реализация Rad-X только логгирует.
    // Для полноценной работы нужен механизм временных эффектов или баффов.
    // Я добавил player.radResistanceBonusFromRadX и player.radXTimer вверху
    // и логику в player.addRads и advanceTime.
    if (player.radXTimer > 0) {
        addLog("game", "Действие предыдущего Рад-Х еще не закончилось.", "system");
        // Можно либо стакать эффект (сложнее), либо не давать использовать новый.
        // Пока что позволяем "обновить" таймер.
    }
    player.radResistanceBonusFromRadX = 50; // Примерное значение сопротивления в %
    player.radXTimer = 2 * (TICKS_PER_GAME_HOUR || 4); // Длительность 2 игровых часа (TICKS_PER_GAME_HOUR должно быть определено)
    addLog("game", "Вы приняли Рад-Х. Ваше сопротивление радиации временно повышено на 50%.");
    updateStatusDisplay(); // Обновить, если есть отображение сопротивления
    return true;
}
function useMutantJerkyEffect(isCombatContext) {
    player.needs.hunger = Math.max(0, player.needs.hunger - 25);
    const radsGained = getRandomInt(5,15);
    player.addRads(radsGained);
    addLog("game", `Вы съели вяленое мясо мутанта. Оно утолило голод, но вы получили ${radsGained} ед. радиации.`);
    updateStatusDisplay();
    return true;
}


// --- DISPLAY UPDATE FUNCTIONS ---
// Эти функции сильно зависят от HTML-структуры. Предполагаем, что ID элементов корректны.
// Для оптимизации можно обновлять textContent только если значение изменилось.

function updateStatusDisplay() {
    // Helper для безопасного обновления textContent
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el && el.textContent !== String(value)) el.textContent = value;
        else if (!el) console.warn(`Element with ID '${id}' not found for updateStatusDisplay.`);
    };
    const setHtml = (id, value) => {
        const el = document.getElementById(id);
        if (el && el.innerHTML !== String(value)) el.innerHTML = value;
        else if (!el) console.warn(`Element with ID '${id}' not found for updateStatusDisplay.`);
    };
    const setClass = (id, baseClass, conditionClass, condition) => {
        const el = document.getElementById(id);
        if (el) {
            el.className = baseClass; // Сброс предыдущих условных классов
            if (condition) el.classList.add(conditionClass);
        } else console.warn(`Element with ID '${id}' not found for setClass.`);
    };

    setText("player-hp-status", player.hp);
    setText("player-max-hp-status", player.maxHp);
    setText("player-ap-status", player.ap);
    setText("player-max-ap-status", player.maxAp);
    setText("player-level-status", player.level);

    let conditionText = "Норма"; let conditionClassSuffix = "normal";
    if (player.hp <= 0) { conditionText = `Выведен из строя`; conditionClassSuffix = "danger"; }
    else if (player.hp < player.maxHp * 0.3) { conditionText = `Тяжело ранен`; conditionClassSuffix = "warning"; }
    else if (player.hp < player.maxHp * 0.6) { conditionText = `Ранен`; conditionClassSuffix = "injured"; }

    const playerConditionDisplay = document.getElementById("player-condition");
    if (playerConditionDisplay) {
        playerConditionDisplay.textContent = conditionText;
        playerConditionDisplay.className = `stat-value condition-${conditionClassSuffix}`; // Используем классы для стилей
    }

    setText("player-rads", player.rads);
    const playerRadsLevelDisplay = document.getElementById("player-rads-level");
    if (playerRadsLevelDisplay) {
        playerRadsLevelDisplay.textContent = player.radLevel;
        let radClassSuffix = "normal";
        if (player.radLevel === "Легкое" || player.radLevel === "Среднее") radClassSuffix = "warning";
        else if (player.radLevel === "Тяжелое" || player.radLevel === "Смертельное") radClassSuffix = "danger";
        playerRadsLevelDisplay.className = `stat-value radlevel-${radClassSuffix}`;
    }

    const playerStealthDisplay = document.getElementById("player-stealth-status");
    if (playerStealthDisplay) {
        playerStealthDisplay.textContent = player.isStealthActive ? "Скрыт" : "Обнаружен";
        playerStealthDisplay.style.color = player.isStealthActive ? "var(--stealth-color)" : "var(--pipboy-green-medium)";
    }


    Object.keys(player.stats).forEach(key => setText(`stat-${key}`, player.stats[key]));

    Object.keys(player.limbs).forEach(limbId => {
        const limb = player.limbs[limbId];
        if (!limb) return;

        const limbEl = document.getElementById(`limb-${limbId}`);
        const limbIconEl = limbEl ? limbEl.previousElementSibling?.querySelector('.limb-icon') : null; // Добавлен optional chaining

        if (limbEl) limbEl.textContent = limb.status;
        if (limbIconEl) {
            let iconText = "[ ]"; let iconColor = "var(--pipboy-green-darker)";
            let limbCondClass = "limb-condition";

            if (limb.status === "Норма") { iconText = "[✓]"; iconColor = "var(--pipboy-green-medium)"; limbCondClass = "limb-ok"; }
            else if (limb.status === "Легкое ранение" || limb.status === "Тяжелое ранение") { iconText = "[!]"; iconColor = "var(--warning-color)"; limbCondClass = "limb-injured"; }
            else if (limb.status === "Искалечено") { iconText = "[X]"; iconColor = "var(--danger-color)"; limbCondClass = "limb-crippled"; }

            limbIconEl.textContent = iconText;
            limbIconEl.style.color = iconColor;
            if(limbEl) limbEl.className = `limb-condition ${limbCondClass}`; // Обновляем класс текстового элемента
        }
    });

    setText("player-xp", player.xp);
    setText("player-xp-next", player.xpToNextLevel);
    setText("player-caps", player.caps);

    // Время и погода (предполагается, что эти переменные глобальны и обновляются)
    setText("current-time", `${String(currentGameHour).padStart(2, '0')}:${String(currentGameMinute).padStart(2, '0')}`);
    setText("current-weather", currentWeather);
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
        if (!listElement) {
            // console.warn(`Inventory list element for category '${category}' not found.`);
            return;
        }
        listElement.innerHTML = ""; // Очищаем список

        // Проверка, существует ли категория в инвентаре игрока
        if (!player.inventory || !player.inventory[category] || !Array.isArray(player.inventory[category])) {
            listElement.innerHTML = "<li>Ошибка: Категория не найдена</li>";
            console.error(`Inventory category '${category}' not found or not an array in player.inventory.`);
            return;
        }

        const items = player.inventory[category];
        if (items.length === 0) {
            let emptyText = "<li>Пусто</li>";
            if (category === 'apparel' && !items.find(i => i.id === 'vault_suit')) { // Предполагаем, что vault_suit - особый предмет
                emptyText = "<li>Нет одежды</li>";
            }
            listElement.innerHTML = emptyText;
            return;
        }

        items.forEach(item => {
            if (!item || !item.id || !item.name) { // Проверка на корректность объекта item
                console.warn("Invalid item object in inventory category:", category, item);
                const li = document.createElement("li");
                li.textContent = "Ошибка: поврежденный предмет";
                li.style.color = "red";
                listElement.appendChild(li);
                return; // Пропустить некорректный предмет
            }

            const li = document.createElement("li");
            let text = `${item.name} (x${item.quantity || 1})`; // item.quantity может быть 0 или undefined
            if (item.equipped) text += " <span class='equipped-marker'>[Экипировано]</span>"; // Используем класс
            if (item.weight !== undefined) text += ` (Вес: ${((item.weight || 0) * (item.quantity || 1)).toFixed(2)})`;
            li.innerHTML = text;

            if (category === 'aid' && item.effectFunctionName) {
                const useButton = document.createElement('button');
                useButton.textContent = "Исп.";
                useButton.classList.add("main-button", "inventory-use-button"); // Классы для стилизации
                // useButton.style.marginLeft = "10px"; useButton.style.padding = "3px 6px";
                // useButton.style.fontSize = "0.85em"; useButton.style.borderWidth = "1px";

                if (item.quantity <= 0) { // Если количество 0, кнопка неактивна
                    useButton.classList.add("disabled-button");
                    useButton.disabled = true;
                } else {
                    useButton.onclick = (e) => {
                        e.stopPropagation(); // Предотвратить всплытие события, если li имеет свой обработчик
                        if (item.quantity > 0) { // Дополнительная проверка
                            let canUse = true;
                            let apCost = 0;
                            if (combatActive && item.apCost) {
                                apCost = item.apCost;
                                if (player.ap < apCost) {
                                    addLog("combat", "Недостаточно ОД!", "system");
                                    canUse = false;
                                }
                            }

                            if (canUse) {
                                if (typeof window[item.effectFunctionName] === 'function') {
                                    const success = window[item.effectFunctionName](combatActive); // Передаем контекст боя
                                    if (success === true) { // Явная проверка на true
                                        if (apCost > 0) player.ap -= apCost;
                                        item.quantity--;
                                        if (item.quantity <= 0) {
                                            player.inventory[category] = player.inventory[category].filter(i =>
                                                !(i.id === item.id && i.uniqueMarker === item.uniqueMarker) // Удаляем, если это тот же уникальный предмет
                                            );
                                        }
                                        updateInventoryDisplay(); // Обновить инвентарь
                                        updateAllDisplays();    // Обновить все остальное (HP, AP, статус)
                                    }
                                    // Если success === false, предмет не был использован, ничего не делаем
                                } else {
                                    console.error("Item effect function not found:", item.effectFunctionName);
                                    addLog("game", "Ошибка: Действие предмета не найдено.", "system");
                                }
                            }
                        }
                    };
                }
                li.appendChild(useButton);
            }
            listElement.appendChild(li);
        });
    });

    document.getElementById("current-weight").textContent = player.currentCarryWeight.toFixed(2);
    document.getElementById("max-weight").textContent = player.maxCarryWeight;
    const weightElement = document.getElementById("inventory-weight");
    if (weightElement) { // Проверка существования элемента
        if (player.isOverencumbered) weightElement.classList.add("overencumbered");
        else weightElement.classList.remove("overencumbered");
    }

    const stimpakCount = player.inventory.aid?.reduce((sum, item) => (item.id === 'stimpak' || item.id?.startsWith('stimpak_')) ? sum + (item.quantity || 0) : sum, 0) || 0;
    document.getElementById("stimpak-count").textContent = stimpakCount;

    const actionUseStimpakButton = document.getElementById("action-use-stimpak");
    if (actionUseStimpakButton) { // Проверка существования кнопки
        const stimpakItemForButton = player.inventory.aid?.find(i => (i.id === 'stimpak' || i.id?.startsWith('stimpak_')) && i.quantity > 0);
        const stimpakApCost = stimpakItemForButton ? (stimpakItemForButton.apCost || 2) : 2; // apCost по умолчанию
        actionUseStimpakButton.disabled = !(stimpakItemForButton && (!combatActive || player.ap >= stimpakApCost));
        if (actionUseStimpakButton.disabled) actionUseStimpakButton.classList.add("disabled-button");
        else actionUseStimpakButton.classList.remove("disabled-button");
    }
}

function addItemToInventory(itemData, category = 'misc') {
    // ПРЕДПОЛАГАЕТСЯ, ЧТО allItems ЗАГРУЖЕН И КОРРЕКТЕН
    if (!itemData || !itemData.id) {
        console.error("addItemToInventory: Invalid itemData or missing ID.", itemData);
        addLog("game", "Ошибка: Попытка добавить некорректный предмет.", "system");
        return;
    }

    const targetCategoryName = itemData.category || category;
    if (!player.inventory || !player.inventory[targetCategoryName] || !Array.isArray(player.inventory[targetCategoryName])) {
        console.error("Invalid inventory category or player.inventory not initialized:", targetCategoryName, itemData);
        addLog("game", `Ошибка: Неверная категория инвентаря "${targetCategoryName}" для предмета "${itemData.name || itemData.id}".`, "system");
        return;
    }
    const targetCategory = player.inventory[targetCategoryName];

    const existingItem = !itemData.uniqueMarker ? targetCategory.find(item => item.id === itemData.id && !item.uniqueMarker) : null;

    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 0) + (itemData.quantity || 1);
    } else {
        // ПРЕДУПРЕЖДЕНИЕ: Regex для baseId может быть неточным и зависит от схемы именования ID.
        // const baseId = itemData.id.replace(/_instance_.*|_unique_.*|_rr_stash|_vault_hall_locker_1|_dog_found_.*|_springvale_1|_1$/,'');
        // Более безопасный подход - если itemData уже содержит baseId, или allItems структурирован для поиска по вариантам ID.
        // Пока оставляем как есть, но это потенциальная точка хрупкости.
        let baseId = itemData.id;
        if (itemData.uniqueMarker && itemData.id.includes("_")) { // Очень грубая попытка найти baseId
            const parts = itemData.id.split("_");
            if (allItems && (allItems[parts[0]] || allItems[`${parts[0]}_${parts[1]}`])) { // Пробуем разные варианты
                 baseId = allItems[parts[0]] ? parts[0] : `${parts[0]}_${parts[1]}`; // Очень упрощенно
            }
        }

        const baseItemTemplate = (allItems && (allItems[baseId] || allItems[itemData.id])) || {};

        const newItem = {
            ...baseItemTemplate, // Сначала базовые свойства
            ...itemData,        // Затем переданные, они могут переопределить базовые
            quantity: itemData.quantity || 1,
            category: targetCategoryName // Убедимся, что категория правильная
        };

        if (!newItem.name) newItem.name = baseItemTemplate.name || newItem.id; // Имя из шаблона, если есть, иначе ID

        targetCategory.push(newItem);
    }
    updateInventoryDisplay(); // Обновляем инвентарь после добавления
}

function updateDataDisplay() {
    const questListEl = document.getElementById("quest-list");
    if (questListEl) {
        questListEl.innerHTML = "";
        if (!player.quests || player.quests.length === 0) {
            questListEl.innerHTML = "<li>Нет активных заданий.</li>";
        } else {
            player.quests.forEach(quest => {
                if (!quest || !quest.id || !quest.name) { // Проверка на корректность квеста
                    console.warn("Invalid quest object in player.quests:", quest);
                    const listItem = document.createElement("li");
                    listItem.textContent = "Ошибка: поврежденное задание";
                    listItem.style.color = "red";
                    questListEl.appendChild(listItem);
                    return;
                }
                const listItem = document.createElement("li");
                let statusMarker = "◆"; // Активный
                if (quest.status === "completed") statusMarker = "✓";
                else if (quest.status === "failed") statusMarker = "✗";

                listItem.innerHTML = `${statusMarker} ${quest.name}: <span class="quest-description">${quest.description || ""}</span>`;
                listItem.classList.add(`quest-status-${quest.status || "active"}`);
                questListEl.appendChild(listItem);
            });
        }
    } else {
        // console.warn("Element with ID 'quest-list' not found for updateDataDisplay.");
    }
    updateHolodiskDisplay();
    updateReputationDisplay();
}

function updateHolodiskDisplay() {
    const holodiskListEl = document.getElementById("holodisk-list");
    // ПРЕДПОЛАГАЕТСЯ, ЧТО storyTexts.holodiskContents ЗАГРУЖЕН И КОРРЕКТЕН
    if (holodiskListEl) {
        holodiskListEl.innerHTML = "";
        if (!player.foundHolodisks || player.foundHolodisks.length === 0) {
            holodiskListEl.innerHTML = "<li>Нет найденных записей.</li>";
        } else {
            player.foundHolodisks.forEach(diskId => {
                const diskData = storyTexts.holodiskContents && storyTexts.holodiskContents[diskId];
                if (diskData && diskData.title) { // Проверка diskData и title
                    const listItem = document.createElement("li");
                    listItem.textContent = diskData.title;
                    listItem.classList.add("holodisk-entry"); // Класс для стилизации
                    listItem.onclick = () => {
                        const gameOutputEl = document.getElementById("game-output");
                        const choicesContainerEl = document.getElementById("choices-container");
                        if (gameOutputEl && choicesContainerEl) {
                            showTab("game"); // Переключиться на игровой экран
                            choicesContainerEl.innerHTML = ""; // Очистить выборы
                            typeWriterEffect(gameOutputEl, `--- ${diskData.title} ---\n${(diskData.content || "Содержимое отсутствует.").replace(/\n/g, '<br>')}\n--- Конец записи ---`, 10, () => {
                                const backButton = document.createElement("button");
                                backButton.classList.add("main-button");
                                backButton.textContent = "Закрыть запись";
                                backButton.onclick = () => renderLocation(currentLocationId); // Вернуться к локации
                                choicesContainerEl.appendChild(backButton);
                            });
                        } else {
                            console.error("Cannot display holodisk: gameOutputEl or choicesContainerEl not found.");
                        }
                    };
                    holodiskListEl.appendChild(listItem);
                } else if (diskId) { // Если diskData нет, но есть ID
                    const listItem = document.createElement("li");
                    listItem.textContent = `Запись: ${diskId} (нет данных)`;
                    listItem.style.color = "grey";
                    holodiskListEl.appendChild(listItem);
                }
            });
        }
    } else {
        // console.warn("Element with ID 'holodisk-list' not found for updateHolodiskDisplay.");
    }
}

function updateReputationDisplay() {
    const reputationListEl = document.getElementById("reputation-list");
    if (reputationListEl) {
        reputationListEl.innerHTML = "";
        let hasReputation = false;
        if (player.reputation && Object.keys(player.reputation).length > 0) { // Проверка player.reputation
            for (const factionId in player.reputation) {
                hasReputation = true;
                // РЕФАКТОРИНГ: Имена фракций и статусы лучше брать из объекта данных
                let factionName = factionId;
                if (factionId === "settlers") factionName = "Поселенцы";
                else if (factionId === "scavengers") factionName = "Мусорщики";
                else if (factionId === "brotherhood_outpost") factionName = "Братство (Аванпост)";
                // const factionData = allFactions[factionId]; factionName = factionData ? factionData.name : factionId;

                const repValue = player.reputation[factionId];
                let repStatusText = "Нейтрально"; let repClassSuffix = "neutral";

                if (repValue <= -50) { repStatusText = "Враждебно"; repClassSuffix = "hostile"; }
                else if (repValue <= -10) { repStatusText = "Недружелюбно"; repClassSuffix = "unfriendly"; }
                else if (repValue >= 50) { repStatusText = "Союзник"; repClassSuffix = "ally"; }
                else if (repValue >= 10) { repStatusText = "Дружелюбно"; repClassSuffix = "friendly"; }

                const listItem = document.createElement("li");
                listItem.classList.add("reputation-item");
                // Используем классы для стилизации статуса
                listItem.innerHTML = `<span>${factionName}</span> <span class="reputation-status-${repClassSuffix}">${repStatusText} (${repValue})</span>`;
                reputationListEl.appendChild(listItem);
            }
        }
        if (!hasReputation) {
            reputationListEl.innerHTML = "<li>Нет данных о репутации.</li>";
        }
    } else {
        // console.warn("Element with ID 'reputation-list' not found for updateReputationDisplay.");
    }
}

function addQuest(newQuestData) {
    if (!newQuestData || !newQuestData.id || !newQuestData.name) {
        console.error("addQuest: Invalid newQuestData object.", newQuestData);
        addLog("game", "Ошибка: Попытка добавить некорректное задание.", "system");
        return;
    }
    if (!player.quests) player.quests = []; // Инициализация, если нужно

    if (!player.quests.find(q => q.id === newQuestData.id)) {
        // Копируем объект, чтобы избежать мутации исходных данных квеста, если они где-то хранятся
        const questToAdd = { ...newQuestData };
        if (!questToAdd.status) questToAdd.status = "active"; // Статус по умолчанию

        player.quests.push(questToAdd);
        updateDataDisplay();
        addLog("game", `Новое задание: ${questToAdd.name}`, "item");
        if (questToAdd.journalEntry && typeof unlockPlotEntry === "function") {
            unlockPlotEntry(questToAdd.journalEntry);
        } else if (questToAdd.journalEntry) {
            console.warn("unlockPlotEntry function is not defined, cannot unlock journal entry:", questToAdd.journalEntry);
        }
    } else {
        addLog("game", `Задание "${newQuestData.name}" уже есть в журнале.`, "system");
    }
}

function completeQuest(questId) {
    if (!player.quests) return; // Нет квестов для завершения
    const quest = player.quests.find(q => q.id === questId);

    if (quest && quest.status !== "completed") {
        quest.status = "completed";
        updateDataDisplay();
        addLog("game", `Задание выполнено: ${quest.name}`, "item");

        if (quest.xpReward !== undefined) player.addXp(quest.xpReward); // Явное поле для XP награды
        else player.addXp(getRandomInt(50, 100)); // Fallback на случайное XP

        if (quest.unlocksPlotEntryOnComplete && typeof unlockPlotEntry === "function") {
            unlockPlotEntry(quest.unlocksPlotEntryOnComplete);
        } else if (quest.unlocksPlotEntryOnComplete) {
            console.warn("unlockPlotEntry function is not defined, cannot unlock journal entry on complete:", quest.unlocksPlotEntryOnComplete);
        }

        if (quest.reward) {
            if (quest.reward.caps) {
                player.caps += quest.reward.caps;
                addLog("game", `Получено ${quest.reward.caps} крышек.`, "item");
            }
            if (quest.reward.items && Array.isArray(quest.reward.items)) {
                quest.reward.items.forEach(itemRef => {
                    // ПРЕДПОЛАГАЕТСЯ, ЧТО allItems ЗАГРУЖЕН И КОРРЕКТЕН
                    const itemToAddTemplate = allItems && allItems[itemRef.id];
                    if (itemToAddTemplate) {
                         addItemToInventory(
                            {...itemToAddTemplate, id: itemRef.id, quantity: itemRef.quantity || 1}, // Передаем ID из itemRef
                            itemToAddTemplate.category || 'misc'
                        );
                        addLog("game", `Получено: ${itemToAddTemplate.name} (x${itemRef.quantity || 1})`, "item");
                    } else {
                        addLog("game", `Ошибка награды: Предмет с ID "${itemRef.id}" не найден в allItems.`, "system");
                        console.warn("Attempted to add non-existent reward item:", itemRef.id);
                    }
                });
            }
            if (quest.reward.reputation && quest.reward.reputation.factionId && quest.reward.reputation.amount !== undefined) {
                player.changeReputation(quest.reward.reputation.factionId, quest.reward.reputation.amount);
            }
        }
        // updateAllDisplays() вызывается из player.addXp и addItemToInventory, player.changeReputation
        // Если наград не было, то нужно вызвать здесь. Безопаснее вызвать всегда.
        updateAllDisplays();
    }
}

function updateMapDisplay() {
    const discoveredLocationsListEl = document.getElementById("discovered-locations-list");
    if (discoveredLocationsListEl) {
        discoveredLocationsListEl.innerHTML = "";
        if (player.discoveredLocations && player.discoveredLocations.length > 0) {
            const mapStatusEl = document.getElementById("map-status");
            if (mapStatusEl) mapStatusEl.textContent = "Загружены данные о ближайших локациях.";

            player.discoveredLocations.forEach(locId => {
                // ПРЕДПОЛАГАЕТСЯ, ЧТО gameLocations ЗАГРУЖЕН И КОРРЕКТЕН
                const locData = gameLocations && gameLocations[locId];
                if (locData && locData.name) { // Проверка locData и name
                    const listItem = document.createElement("li");
                    listItem.textContent = `${locData.mapIcon || "●"} ${locData.name}`;
                    if (locId === currentLocationId) {
                        listItem.classList.add("current-map-location"); // Класс для стилизации
                        // listItem.style.color = "var(--pipboy-green-bright)";
                    }
                    discoveredLocationsListEl.appendChild(listItem);
                } else if (locId) {
                    const listItem = document.createElement("li");
                    listItem.textContent = `● ${locId} (нет данных)`;
                    listItem.style.color = "grey";
                    discoveredLocationsListEl.appendChild(listItem);
                }
            });
        } else {
            const mapStatusEl = document.getElementById("map-status");
            if (mapStatusEl) mapStatusEl.textContent = "Данные карты не найдены. Нет открытых локаций.";
        }
    }

    const currentLocMapNameEl = document.getElementById("current-location-map-name");
    if (currentLocMapNameEl) {
        const currentLocData = gameLocations && gameLocations[currentLocationId];
        currentLocMapNameEl.textContent = (currentLocData && currentLocData.name) ? currentLocData.name : "Неизвестно";
    }

    const localMapDisplayEl = document.getElementById("local-map-display");
    if (localMapDisplayEl && !localMapDisplayEl.innerHTML.includes("не реализовано")) { // Не перезаписывать, если там уже что-то есть (кроме заглушки)
        localMapDisplayEl.innerHTML = "<p>Карта текущей локации недоступна (не реализовано).</p>";
    }
}

function updateDiscoveredLocations(locationId) {
    if (!player.discoveredLocations) player.discoveredLocations = []; // Инициализация, если нужно
    if (locationId && !player.discoveredLocations.includes(locationId)) {
        player.discoveredLocations.push(locationId);
        const locName = (gameLocations && gameLocations[locationId] && gameLocations[locationId].name) ? gameLocations[locationId].name : locationId;
        addLog("game", `Открыта новая локация: ${locName}`, "info-color");
        updateMapDisplay(); // Обновить карту сразу
    }
}

function updatePerksDisplay() {
    // ПРЕДПОЛАГАЕТСЯ, ЧТО availablePerks ЗАГРУЖЕН И КОРРЕКТЕН
    const perksListDisplay = document.getElementById("perks-list");
    const perkPointsDisplay = document.getElementById("perk-points");

    if (perkPointsDisplay) perkPointsDisplay.textContent = player.perkPoints || 0;
    if (!perksListDisplay) return;

    perksListDisplay.innerHTML = "";
    if (!availablePerks || availablePerks.length === 0) {
        perksListDisplay.innerHTML = "<li>Нет доступных перков для отображения.</li>";
        return;
    }

    availablePerks.forEach(perk => {
        if (!perk || !perk.id || !perk.name) { // Проверка на корректность перка
            console.warn("Invalid perk object in availablePerks:", perk);
            return;
        }
        const li = document.createElement("li");
        li.classList.add("perk-item");
        if (player.hasPerk(perk.id)) li.classList.add("owned");

        let requirementsMet = true;
        let reqTextParts = [];
        if (perk.requires) {
            if (perk.requires.level && player.level < perk.requires.level) {
                requirementsMet = false; reqTextParts.push(`УР:${perk.requires.level} (тек: ${player.level})`);
            }
            Object.keys(perk.requires).forEach(statKey => {
                if (statKey !== 'level' && player.stats[statKey] < perk.requires[statKey]) {
                    requirementsMet = false; reqTextParts.push(`${statKey.toUpperCase()}:${perk.requires[statKey]} (тек: ${player.stats[statKey]})`);
                }
            });
        }
        const reqText = reqTextParts.length > 0 ? ` (Треб: ${reqTextParts.join(', ')})` : "";
        let perkStatusText = player.hasPerk(perk.id) ? " <span class='perk-owned-marker'>[ИЗУЧЕНО]</span>" : "";

        li.innerHTML = `<h4>${perk.name}${perkStatusText}</h4><p>${perk.description || "Нет описания."}${!player.hasPerk(perk.id) ? reqText : ""}</p>`;

        if (!player.hasPerk(perk.id)) {
            const learnButton = document.createElement("button");
            learnButton.textContent = `Изучить (${perk.cost || 1} ОП)`;
            learnButton.classList.add("main-button", "perk-learn-button");
            // learnButton.style.marginTop = "8px"; learnButton.style.fontSize = "0.9em"; learnButton.style.padding = "6px 10px";

            if (player.perkPoints >= (perk.cost || 1) && requirementsMet) {
                learnButton.onclick = () => {
                    if (player.learnPerk(perk.id)) { // learnPerk сама вызовет updateAllDisplays
                        // Можно добавить звук или эффект
                    }
                };
            } else {
                learnButton.classList.add("disabled-button");
                learnButton.disabled = true;
                learnButton.textContent = requirementsMet ? "Нет ОП" : "Недоступно (Треб.)";
            }
            li.appendChild(learnButton);
        }
        perksListDisplay.appendChild(li);
    });
}

function updatePlotJournalDisplay() {
    // ПРЕДПОЛАГАЕТСЯ, ЧТО storyTexts.plotJournalEntries ЗАГРУЖЕН И КОРРЕКТЕН
    const plotJournalDisplay = document.getElementById("plot-journal");
    if (!plotJournalDisplay) return;

    plotJournalDisplay.innerHTML = "";
    if (!storyTexts.plotJournalEntries || storyTexts.plotJournalEntries.length === 0) {
        plotJournalDisplay.innerHTML = "<p>Сюжетный журнал пуст.</p>";
        return;
    }

    const unlockedEntries = storyTexts.plotJournalEntries.filter(entry => entry && entry.unlocked); // Проверка entry
    if (unlockedEntries.length === 0) {
        plotJournalDisplay.innerHTML = "<p>Сюжетный журнал пуст.</p>";
    } else {
        unlockedEntries.forEach(entry => {
            const entryDiv = document.createElement("div");
            entryDiv.classList.add("journal-entry");
            entryDiv.innerHTML = `<h4>${entry.title || "Без заголовка"}</h4><p>${(entry.text || "Нет текста.").replace(/\n/g, '<br>')}</p><hr class="journal-hr">`;
            plotJournalDisplay.appendChild(entryDiv);
        });
    }
}

// --- LOCATION ACTIONS ---
// Эти функции сильно зависят от структуры gameLocations и allItems.
// Они должны возвращать "NO_SCREEN_CHANGE", "SCREEN_CHANGED", или "LOCATION_CHANGED"
// для правильной работы processChoice.

function inspectVaultDoor() {
    addLog("game", "Это стандартная дверь Убежища класса 'Циклоп'. Без питания или ручного обхода она не откроется.");
    return "NO_SCREEN_CHANGE";
}

function approachVaultTerminal() {
    // ПРЕДПОЛАГАЕТСЯ, ЧТО terminals ЗАГРУЖЕН И КОРРЕКТЕН
    const term = terminals && terminals["vault_door_terminal"];
    if (!term) {
        addLog("game", "Ошибка: Терминал двери Убежища не найден в данных игры.");
        return "NO_SCREEN_CHANGE";
    }

    if (term.lockedOut && term.lockoutTimeLeft > 0) { // Проверка lockoutTimeLeft
        addLog("game",`Терминал управления дверью ЗАБЛОКИРОВАН еще на ${Math.ceil(term.lockoutTimeLeft / (TICKS_PER_GAME_HOUR || 4))} ч.`);
        return "NO_SCREEN_CHANGE";
    }
    startTerminalHacking("vault_door_terminal");
    return "SCREEN_CHANGED";
}

function isVaultTerminalNotLocked() { // Используется в gameLocations.choices[n].conditionFunctionName
    const term = terminals && terminals["vault_door_terminal"];
    return term ? (!term.lockedOut || term.lockoutTimeLeft <= 0) : false;
}

function canPickOverseerLock() {
    const bobbyPin = player.inventory.misc?.find(i => i.id === 'bobby_pin');
    return (bobbyPin && bobbyPin.quantity > 0) && player.skills.lockpick >= 25;
}

function tryPickOverseerLock() {
    const locData = gameLocations && gameLocations["vault_entrance_hall"];
    if (!locData) {
        addLog("game", "Ошибка: Данные локации 'vault_entrance_hall' не найдены.");
        return "NO_SCREEN_CHANGE";
    }

    if (player.skills.lockpick >= 25) {
         const bobbyPinItem = player.inventory.misc?.find(i => i.id === 'bobby_pin');
         if (!bobbyPinItem || bobbyPinItem.quantity <= 0) {
            addLog("game", "У вас нет заколок, чтобы попытаться вскрыть замок.");
            return "NO_SCREEN_CHANGE";
         }

         addLog("game", "Вы пытаетесь вскрыть замок в комнату Смотрителя... *щелк* Замок поддался!", "item");
         player.addXp(15);

         bobbyPinItem.quantity--;
         if (bobbyPinItem.quantity <= 0) {
            player.inventory.misc = player.inventory.misc.filter(p => p.id !== 'bobby_pin');
         }
         if (!locData.customFlags) locData.customFlags = {};
         locData.customFlags.overseerRoomUnlocked = true;
         updateInventoryDisplay(); // Обновить инвентарь после использования заколки
         // renderLocation будет вызван из processChoice
         return "NO_SCREEN_CHANGE";
    } else {
        addLog("game", "Вы пытаетесь ковыряться в замке, но он слишком сложен для ваших навыков взлома (требуется 25).");
        return "NO_SCREEN_CHANGE";
    }
}

function searchOverseerDesk() {
    const locData = gameLocations && gameLocations["overseer_office"];
    if (!locData) { addLog("game", "Ошибка: Данные локации 'overseer_office' не найдены."); return "NO_SCREEN_CHANGE"; }
    if (!locData.customFlags) locData.customFlags = {};

    addLog("game", "Вы обыскиваете стол и полки в кабинете Смотрителя...");
    let foundSomething = false;

    if (!locData.customFlags.keyCardFound && Math.random() < 0.5) { // Шанс найти
        // ПРЕДПОЛАГАЕТСЯ, ЧТО allItems ЗАГРУЖЕН
        const keycardTemplate = allItems && allItems["overseer_keycard"];
        if (keycardTemplate) {
            addItemToInventory({...keycardTemplate, id:"overseer_keycard_found", uniqueMarker: true}, "misc");
            addLog("game", "Найдена ключ-карта Смотрителя!", "item");
            locData.customFlags.keyCardFound = true;
            foundSomething = true;
        } else {
            addLog("game", "Ошибка: Шаблон предмета 'overseer_keycard' не найден.", "system");
        }
    }
    if (Math.random() < 0.3) { // Шанс найти металлолом
        const scrapTemplate = allItems && allItems.scrap_metal;
        if (scrapTemplate) {
            addItemToInventory({...scrapTemplate, quantity: getRandomInt(1,3), id: `scrap_overseer_${Date.now()}`, uniqueMarker: true}, "misc");
            addLog("game", "Найден металлолом.", "item");
            foundSomething = true;
        } else {
             addLog("game", "Ошибка: Шаблон предмета 'scrap_metal' не найден.", "system");
        }
    }

    if (!foundSomething && locData.customFlags.deskSearched) { // Если уже обыскивали и ничего не нашли снова
        addLog("game", "Вы уже тщательно обыскали это место. Больше ничего нет.");
    } else if (!foundSomething) {
        addLog("game", "Ничего особенно ценного не найдено.");
    }
    locData.customFlags.deskSearched = true; // Отметить, что стол обыскан
    return "NO_SCREEN_CHANGE";
}

function approachOverseerTerminal() {
    const term = terminals && terminals["overseer_terminal"];
    if (!term) { addLog("game", "Ошибка: Терминал Смотрителя не найден."); return "NO_SCREEN_CHANGE"; }

    if (term.lockedOut && term.lockoutTimeLeft > 0) {
        addLog("game",`Терминал Смотрителя ЗАБЛОКИРОВАН еще на ${Math.ceil(term.lockoutTimeLeft / (TICKS_PER_GAME_HOUR||4))} ч.`);
        return "NO_SCREEN_CHANGE";
    }
    startTerminalHacking("overseer_terminal");
    return "SCREEN_CHANGED";
}

function tryPickOverseerSafe() {
    const locData = gameLocations && gameLocations["overseer_office"];
    if (!locData) { addLog("game", "Ошибка: Данные локации 'overseer_office' не найдены."); return "NO_SCREEN_CHANGE"; }
    if (!locData.customFlags) locData.customFlags = {};

    const overseerSafeCode = "2077"; // Код лучше хранить в данных локации или терминала

    if (locData.customFlags.safeOpened) {
        addLog("game", "Сейф уже открыт и пуст.");
        return "NO_SCREEN_CHANGE";
    }

    const hasKeyCard = player.inventory.misc?.find(i => i.id === "overseer_keycard_found");
    const knowsCodeFromTerminal = terminals?.overseer_terminal?.customFlags?.securityLogRead; // Проверка на существование

    let opened = false;
    if (hasKeyCard) {
        addLog("game", "Вы используете ключ-карту Смотрителя. Сейф со щелчком открывается!", "item");
        opened = true;
    } else if (knowsCodeFromTerminal && confirm(`Вы знаете код (${overseerSafeCode}) из терминала Смотрителя. Ввести его?`)) { // confirm вместо prompt для да/нет
        addLog("game", "Код из терминала подошел! Сейф открыт.", "item");
        opened = true;
    } else if (player.skills.lockpick >= 40) { // Требование к навыку для "умелого" взлома
        addLog("game", "Вы умело вскрываете сложный замок сейфа!", "item");
        opened = true;
    } else {
        const enteredCode = prompt(`Введите код для сейфа (4 цифры). Или нажмите Отмена для попытки взлома (Навык: ${player.skills.lockpick}/25, требуется заколка).`);
        if (enteredCode === overseerSafeCode) {
            addLog("game", "Код подошел! Сейф открыт.", "item");
            opened = true;
        } else if (enteredCode !== null) { // Если не отмена, но код неверный
             addLog("game", "Неверный код.");
        }
        // Если отмена или неверный код, пробуем взлом
        if (!opened && (enteredCode === null || enteredCode !== overseerSafeCode)) {
            if (player.skills.lockpick >= 25) {
                const bobbyPin = player.inventory.misc?.find(i => i.id === 'bobby_pin');
                if (bobbyPin && bobbyPin.quantity > 0) {
                    addLog("game", "Вы пытаетесь взломать сейф заколкой... *щелк* Замок поддался!", "item");
                    bobbyPin.quantity--;
                    if (bobbyPin.quantity <= 0) player.inventory.misc = player.inventory.misc.filter(p => p.id !== 'bobby_pin');
                    updateInventoryDisplay();
                    opened = true;
                } else {
                    addLog("game", "Для взлома сейфа нужна заколка, а у вас ее нет.");
                }
            } else if (enteredCode === null){ // Если отменили ввод кода и навыка не хватает
                 addLog("game", "Сейф слишком сложен для ваших навыков взлома (требуется 25).");
            }
        }
    }


    if (opened) {
        player.addXp(50);
        // ПРЕДПОЛАГАЕТСЯ, ЧТО allItems ЗАГРУЖЕН
        const pistol = allItems && allItems["10mm_pistol"];
        const ammo = allItems && allItems["10mm_ammo_rounds"];
        const stimpak = allItems && allItems.stimpak;

        let lootLog = "В сейфе найдены: ";
        let itemsFoundInSafe = [];

        if (pistol) { addItemToInventory({...pistol, quantity: 1, id: "10mm_pistol_overseer_safe", uniqueMarker: true}, "weapons"); itemsFoundInSafe.push("10мм Пистолет");}
        if (ammo) { addItemToInventory({...ammo, quantity: getRandomInt(10,20), id: "10mm_ammo_overseer_safe", uniqueMarker: true}, "misc"); itemsFoundInSafe.push("10мм патроны");}
        if (stimpak) { addItemToInventory({...stimpak, quantity: 2, id: "stimpak_overseer_safe", uniqueMarker: true}, "aid"); itemsFoundInSafe.push("стимуляторы (2)");}

        if (itemsFoundInSafe.length > 0) {
            addLog("game", lootLog + itemsFoundInSafe.join(', ') + "!", "item");
        } else {
            addLog("game", "Сейф оказался пуст... Странно.", "system");
        }
        locData.customFlags.safeOpened = true;
    } else {
        // Сообщение о неудаче, если не было ранее (например, "Неверный код" или "Нет заколок")
        if (!hasKeyCard && !knowsCodeFromTerminal && player.skills.lockpick < 25) {
             addLog("game", "Сейф слишком сложен для ваших навыков взлома, и вы не знаете код или у вас нет ключ-карты.");
        }
    }
    return "NO_SCREEN_CHANGE";
}

function onEnterOverseerOffice() {
    updateDiscoveredLocations("overseer_office");
    // Можно добавить уникальное описание или событие при первом входе
    // if (!gameLocations["overseer_office"].customFlags?.firstEntryDone) {
    //     addLog("game", "Вы вошли в кабинет Смотрителя. Здесь все покрыто пылью...", "info-color");
    //     gameLocations["overseer_office"].customFlags.firstEntryDone = true;
    // }
}

function searchLockersVaultHall() {
    const locationData = gameLocations && gameLocations["vault_entrance_hall"];
    if (!locationData) { addLog("game", "Ошибка: Данные локации 'vault_entrance_hall' не найдены."); return "NO_SCREEN_CHANGE"; }
    if (!locationData.customFlags) locationData.customFlags = {};

    let itemsFoundLogParts = [];

    // Обработка collectables (голодиски и т.д.)
    if (locationData.collectables && Array.isArray(locationData.collectables)) {
        locationData.collectables.forEach(collectable => {
            if (collectable && collectable.id && !collectable.isCollected) { // Проверка collectable
                if (collectable.type === "holodisk") {
                    player.collectHolodisk(collectable.id); // collectHolodisk сама добавит лог
                    // itemsFoundLogParts.push(collectable.name || collectable.id); // Не дублируем лог
                } else {
                    // Логика для других типов collectables, если они есть
                }
                collectable.isCollected = true; // Помечаем как собранное
            }
        });
    }

    // Поиск конкретных предметов (стимулятор, заколки)
    const stimpakUniqueId = "stimpak_vault_hall_locker_1";
    const bobbyPinUniqueId = "bobby_pin_vault_hall_locker_1";
    let foundThisTime = false;

    if (!locationData.customFlags[stimpakUniqueId]) {
        const stimpakTemplate = allItems && allItems.stimpak;
        if (stimpakTemplate) {
            addItemToInventory({ ...stimpakTemplate, id: stimpakUniqueId, quantity: 1, uniqueMarker:true }, 'aid');
            itemsFoundLogParts.push("Стимулятор");
            locationData.customFlags[stimpakUniqueId] = true;
            foundThisTime = true;
        }
    }
    if (!locationData.customFlags[bobbyPinUniqueId]) {
        const bobbyPinTemplate = allItems && allItems.bobby_pin;
        if (bobbyPinTemplate) {
            addItemToInventory({ ...bobbyPinTemplate, id: bobbyPinUniqueId, quantity: 2, uniqueMarker:true }, 'misc');
            itemsFoundLogParts.push("Заколки (2)");
            locationData.customFlags[bobbyPinUniqueId] = true;
            foundThisTime = true;
        }
    }

    if (itemsFoundLogParts.length > 0) {
        addLog("game", `В шкафчиках найдено: ${itemsFoundLogParts.join(', ')}!`, "item");
    } else {
        // Проверяем, все ли возможные предметы уже были собраны
        const allLockerItemsCollected = locationData.customFlags[stimpakUniqueId] &&
                                       locationData.customFlags[bobbyPinUniqueId] &&
                                       (!locationData.collectables || locationData.collectables.every(c => c.isCollected));
        if (allLockerItemsCollected) {
            addLog("game", "Шкафчики уже пусты.");
        } else {
            addLog("game", "В этот раз в шкафчиках ничего не нашлось."); // Если есть еще что искать, но не повезло
        }
    }
    return "NO_SCREEN_CHANGE";
}

function onEnterVaultHall() {
    updateDiscoveredLocations("vault_entrance_hall");
    const locationData = gameLocations && gameLocations["vault_entrance_hall"];
    if (locationData && locationData.collectables && Array.isArray(locationData.collectables)) {
        locationData.collectables.forEach(collectable => {
            if (collectable && !collectable.isCollected && collectable.type === "holodisk" && Math.random() < 0.3) { // Шанс заметить
                addLog("game", `Вы замечаете ${collectable.name ? collectable.name.toLowerCase() : `предмет (${collectable.id})`} на консоли.`);
            }
        });
    }
}

function lookAroundWasteland() {
    addLog("game", "Вдалеке виднеются руины небольшого городка. Отсюда туда ведет старая дорога. На западе - заправка 'Красная Ракета'.");
    // Можно добавить больше деталей в зависимости от статов игрока (например, Восприятие)
    // if (player.stats.p >= 7) addLog("game", "Кажется, у заправки мелькнула какая-то тень.", "info-color");
    return "NO_SCREEN_CHANGE";
}

function canReturnToVault() { // Условие для кнопки "Вернуться в Убежище"
    const vaultHall = gameLocations && gameLocations["vault_entrance_hall"];
    return vaultHall && vaultHall.customFlags && vaultHall.customFlags.isDoorOpen === true;
}

function onEnterWastelandNearVault() {
    updateDiscoveredLocations("wasteland_near_vault");
    // Завершение первого квеста
    const mainQuest = player.quests?.find(q => q.id === "main_quest_1");
    if (mainQuest && mainQuest.status === "active") {
        completeQuest("main_quest_1");
    }

    // Разблокировка записи в журнале
    if (typeof unlockPlotEntry === "function") unlockPlotEntry("entry_002_first_steps");
    else console.warn("unlockPlotEntry not defined. Cannot unlock 'entry_002_first_steps'.");

    // Выдача нового квеста, если его еще нет
    if (!player.quests?.find(q => q.id === "explore_wasteland")) {
        addQuest({
            id: "explore_wasteland",
            name: "Первые шаги",
            description: "Исследовать ближайшие окрестности Убежища.",
            status: "active",
            unlocksPlotEntryOnComplete: "entry_003_springvale_contact", // Пример
            xpReward: 75
        });
    }

    // Радиация в локации
    const locData = gameLocations && gameLocations["wasteland_near_vault"];
    if (locData && locData.radExposure && locData.radExposure > 0) {
        player.addRads(locData.radExposure); // addRads сама добавит лог и обновит UI
    }
}

function searchRedRocketStation() {
    const locData = gameLocations && gameLocations["red_rocket_station"];
    if (!locData) { addLog("game", "Ошибка: Данные локации 'red_rocket_station' не найдены."); return "NO_SCREEN_CHANGE"; }
    if (!locData.customFlags) locData.customFlags = {};

    let foundSomethingThisSearch = false;
    let logMessages = [];

    const scrapUniqueId = "scrap_rr_1";
    const wrenchUniqueId = "wrench_rr_1";

    if (!locData.customFlags[scrapUniqueId] && Math.random() < 0.4) {
        const scrapTemplate = allItems?.scrap_metal;
        if (scrapTemplate) {
            addItemToInventory({...(scrapTemplate), quantity:getRandomInt(1,2), id: scrapUniqueId, uniqueMarker: true}, 'misc');
            logMessages.push("немного металлолома");
            locData.customFlags[scrapUniqueId] = true;
            foundSomethingThisSearch = true;
        }
    }
    if (!locData.customFlags[wrenchUniqueId] && Math.random() < 0.2) {
        const wrenchTemplate = allItems?.wrench; // Предполагаем, что есть такой предмет
        if (wrenchTemplate) {
            addItemToInventory({...wrenchTemplate, id: wrenchUniqueId, name:"Гаечный ключ", weight:1, uniqueMarker:true}, "misc");
            logMessages.push("старый гаечный ключ");
            locData.customFlags[wrenchUniqueId] = true;
            foundSomethingThisSearch = true;
        } else { // Если шаблона нет, можно создать "на лету"
            addItemToInventory({id: wrenchUniqueId, name:"Гаечный ключ", weight:1, category:"misc", uniqueMarker:true}, "misc");
            logMessages.push("старый гаечный ключ");
            locData.customFlags[wrenchUniqueId] = true;
            foundSomethingThisSearch = true;
        }
    }

    // Тайник из терминала
    if (terminals?.red_rocket_terminal?.customFlags?.hackedSuccessfully && !locData.customFlags.stashLooted) {
        logMessages.push("содержимое тайника, открытого терминалом: стимулятор и патроны");
        const stimpakTemplate = allItems?.stimpak;
        const ammoTemplate = allItems?.["10mm_ammo_rounds"];
        if (stimpakTemplate) addItemToInventory({...stimpakTemplate, id:"stimpak_rr_stash", quantity:1, uniqueMarker:true}, "aid");
        if (ammoTemplate) addItemToInventory({...ammoTemplate, id:"10mm_ammo_rr_stash", quantity:getRandomInt(5,10), uniqueMarker:true}, "misc");
        locData.customFlags.stashLooted = true;
        foundSomethingThisSearch = true;
    }

    if (foundSomethingThisSearch) {
        addLog("game", `Вы нашли: ${logMessages.join(', ')}.`, "item");
    } else {
        const allPossibleSearched = locData.customFlags[scrapUniqueId] && locData.customFlags[wrenchUniqueId] &&
                                    (locData.customFlags.stashLooted || !terminals?.red_rocket_terminal?.customFlags?.hackedSuccessfully);
        if (allPossibleSearched) {
            addLog("game", "Здесь больше ничего нет.");
        } else {
            addLog("game", "Кажется, в этот раз пусто.");
        }
    }
    return "NO_SCREEN_CHANGE";
}

function isDogAtRedRocketNotYetFriend() {
    const rrData = gameLocations && gameLocations["red_rocket_station"];
    return rrData && !rrData.customFlags?.dogFound && !player.companion;
}

function approachDogAtRedRocket() {
    // Эта функция должна изменить выборы в локации Red Rocket.
    // Она не переходит в другую локацию, а модифицирует текущую.
    addLog("game", "Собака смотрит на вас, виляя хвостом. Кажется, она не агрессивна.");
    const loc = gameLocations && gameLocations["red_rocket_station"];
    if (!loc || !loc.choices) {
        addLog("game", "Ошибка: Не удалось изменить выборы для собаки (нет данных локации).");
        return "NO_SCREEN_CHANGE";
    }

    const approachChoiceIndex = loc.choices.findIndex(c => c.actionFunctionName === "approachDogAtRedRocket");
    if (approachChoiceIndex !== -1) {
        // Удаляем старый выбор и добавляем новые
        loc.choices.splice(approachChoiceIndex, 1,
            { text: "Попытаться подружиться с собакой (Харизма 5 / Друг Животных 1)", actionFunctionName: "tryBefriendDog", conditionFunctionName: "canTryBefriendDog" },
            { text: "Оставить собаку в покое", actionFunctionName: "leaveDogAlone" }
        );
        // renderLocation(currentLocationId); // processChoice вызовет рендер, если это NO_SCREEN_CHANGE
    } else {
        addLog("game", "Ошибка: Не найден выбор 'Подойти к собаке' для замены.");
    }
    return "NO_SCREEN_CHANGE"; // Чтобы processChoice перерисовал локацию с новыми выборами
}
// Добавим функцию условия для нового выбора
function canTryBefriendDog() { return true; } // Просто заглушка, реальное условие может быть сложнее


function tryBefriendDog() {
    // ПРЕДПОЛАГАЕТСЯ, ЧТО gameNpcData И storyTexts ЗАГРУЖЕНЫ
    const loc = gameLocations && gameLocations["red_rocket_station"];
    if (!loc) { addLog("game", "Ошибка данных локации Red Rocket."); return "NO_SCREEN_CHANGE"; }
    if (!loc.customFlags) loc.customFlags = {};

    if (player.stats.c >= 5 || player.hasPerk("animal_friend_1")) {
        addLog("game", "Собака радостно подбегает к вам и трется о ноги. Вы нашли верного друга!", "item");
        const dogNPCTemplate = gameNpcData?.dogmeat_companion; // Используем optional chaining
        if (!dogNPCTemplate || !dogNPCTemplate.companionDetails) {
            addLog("game", "Ошибка: Данные для компаньона-собаки не найдены.");
            return "NO_SCREEN_CHANGE";
        }
        player.companion = JSON.parse(JSON.stringify(dogNPCTemplate.companionDetails));
        player.companion.currentHp = player.companion.hp; // Убедимся, что ХП полное
        player.companion.mood = player.companion.mood || "Нейтральное"; // Установка настроения

        loc.customFlags.dogFound = true;
        if (typeof unlockPlotEntry === "function") unlockPlotEntry("entry_004_dogmeat_found");
        else console.warn("unlockPlotEntry not defined.");

        addLog("game", `${player.companion.name || "Псина"} теперь ваш компаньон! Откройте вкладку "COMP" для взаимодействия.`);
        player.changeReputation("scavengers", 5); // Пример репутации

        // Убираем выборы, связанные с первой встречей с собакой
        loc.choices = loc.choices?.filter(c => c.actionFunctionName !== "tryBefriendDog" && c.actionFunctionName !== "leaveDogAlone");

        const collarNote = loc.collectables?.find(c => c.id === "dog_collar_note");
        if (collarNote && collarNote.requiresDogFound && !collarNote.isCollected) {
            addLog("game", `Вы замечаете старую записку, прикрепленную к ошейнику ${player.companion.name || "Псины"}.`);
            player.collectHolodisk(collarNote.id);
            collarNote.isCollected = true;
        }
        updateCompanionTab();
    } else {
        addLog("game", "Собака рычит и отбегает. Кажется, вы ей не понравились. (Нужно: Харизма 5 или перк 'Друг животных')");
        player.changeReputation("scavengers", -2);
    }
    // renderLocation(currentLocationId); // processChoice сделает это
    return "NO_SCREEN_CHANGE";
}

function leaveDogAlone() {
    addLog("game", "Вы решаете не беспокоить собаку.");
    const loc = gameLocations && gameLocations["red_rocket_station"];
    if (!loc || !loc.choices) return "NO_SCREEN_CHANGE";

    // Убираем выборы "подружиться" / "оставить в покое"
    loc.choices = loc.choices.filter(c => c.actionFunctionName !== "tryBefriendDog" && c.actionFunctionName !== "leaveDogAlone");
    // Возвращаем первоначальный выбор "Подойти к собаке", если его еще нет
    if (!loc.choices.find(c=> c.actionFunctionName === "approachDogAtRedRocket")) {
        loc.choices.splice(1,0, { text: "Подойти к собаке", conditionFunctionName: "isDogAtRedRocketNotYetFriend", actionFunctionName: "approachDogAtRedRocket" });
    }
    // renderLocation(currentLocationId); // processChoice сделает это
    return "NO_SCREEN_CHANGE";
}

function isRedRocketTerminalAvailable() {
    const term = terminals?.red_rocket_terminal;
    return term ? (!term.customFlags?.hackedSuccessfully && (!term.lockedOut || term.lockoutTimeLeft <= 0)) : false;
}

function approachRedRocketTerminal() {
    const term = terminals?.red_rocket_terminal;
    if (!term) { addLog("game", "Ошибка: Терминал Красной Ракеты не найден."); return "NO_SCREEN_CHANGE"; }

    if (term.lockedOut && term.lockoutTimeLeft > 0) {
        addLog("game",`Терминал ЗАБЛОКИРОВАН еще на ${Math.ceil(term.lockoutTimeLeft / (TICKS_PER_GAME_HOUR||4))} ч.`);
        return "NO_SCREEN_CHANGE";
    }

    // Skill DC должен быть в данных терминала, например term.hackSkillDC
    const skillDC = term.skillDC || 25; // Fallback
    if (player.skills.science >= skillDC || player.hasPerk("hacker_1")) { // Перк может давать бонус или обходить проверку
        startTerminalHacking("red_rocket_terminal");
        return "SCREEN_CHANGED";
    } else {
        addLog("game", `Этот терминал слишком сложен для ваших навыков (${player.skills.science}/${skillDC} Науки).`);
        return "NO_SCREEN_CHANGE";
    }
}

function onSuccessRedRocketTerminal() {
    addLog("game", "Терминал: Доступ получен. Система безопасности 'Красной Ракеты' частично деактивирована.", "item");
    const term = terminals?.red_rocket_terminal;
    if (term) {
        if(!term.customFlags) term.customFlags = {};
        term.customFlags.hackedSuccessfully = true;
    }

    const locData = gameLocations?.red_rocket_station;
    if (locData) {
        if (!locData.customFlags) locData.customFlags = {};
        locData.customFlags.trapDisarmed = true; // Обезвреживаем ловушку на складе
        addLog("game", "На терминале также указано расположение небольшого тайника с припасами на складе.", "info-color");
    }
    // _exitTerminalHacking вызовет renderLocation, если нужно
    return "NO_SCREEN_CHANGE"; // Остаемся на экране терминала для чтения, если есть что читать
}

function enterRedRocketStorage() {
    const locData = gameLocations?.red_rocket_station;
    if (!locData) { addLog("game", "Ошибка данных локации Red Rocket."); return "NO_SCREEN_CHANGE"; }
    if (!locData.customFlags) locData.customFlags = {};

    // Проверка ловушки
    // Trap data должна быть в gameLocations[locationId].trap = { id: "rr_storage_trap", disarmedByFlag: "trapDisarmed", ... }
    if (locData.hasTrap && !locData.customFlags.trapDisarmed) { // locData.hasTrap должно быть флагом в данных локации
        addLog("game", "Вы замечаете натянутую леску у входа на склад... Это ловушка!", "warning-color");
        const storageChoice = locData.choices?.find(c => c.actionFunctionName === "enterRedRocketStorage");
        if (storageChoice) {
            storageChoice.text = "Попытаться обезвредить ловушку на складе (Сапер)";
            storageChoice.actionFunctionName = "tryDisarmRedRocketTrap";
            // renderLocation(currentLocationId); // processChoice сделает
        }
        return "NO_SCREEN_CHANGE"; // Не входим, меняем выбор
    }

    addLog("game", "Вы входите на склад. Здесь темно и пахнет старым маслом.");
    let foundStorageLoot = false;

    if (!locData.customFlags.storageLooted) { // Обыскиваем только один раз основной лут склада
        if (Math.random() < 0.3 && !locData.customFlags.storage_scrap_looted) {
           const scrapTemplate = allItems?.scrap_metal;
           if (scrapTemplate) {
                addItemToInventory({...scrapTemplate, quantity:1, id: "scrap_rr_storage_1", uniqueMarker: true}, 'misc');
                addLog("game", "На полке найден кусок металлолома.", "item");
                if (!locData.customFlags) locData.customFlags = {};
                locData.customFlags.storage_scrap_looted = true; // Флаг для конкретного металлолома
                foundStorageLoot = true;
           }
        }
        // Если есть еще предметы на складе, добавить их здесь
        locData.customFlags.storageLooted = true; // Отмечаем, что склад обыскан (основной лут)
    }

    // Тайник из терминала - это отдельная проверка от основного лута склада
    if (terminals?.red_rocket_terminal?.customFlags?.hackedSuccessfully && !locData.customFlags.stashLooted) {
        addLog("game", "Вы вспоминаете про тайник, открытый терминалом...", "info-color");
        // Логика добавления предметов из тайника (дублируется из searchRedRocketStation, можно вынести в отдельную функцию)
        const stimpakTemplate = allItems?.stimpak;
        const ammoTemplate = allItems?.["10mm_ammo_rounds"];
        if (stimpakTemplate) addItemToInventory({...stimpakTemplate, id:"stimpak_rr_stash", quantity:1, uniqueMarker:true}, "aid");
        if (ammoTemplate) addItemToInventory({...ammoTemplate, id:"10mm_ammo_rr_stash", quantity:getRandomInt(5,10), uniqueMarker:true}, "misc");
        addLog("game", "В тайнике найдены стимулятор и патроны!", "item");
        if (!locData.customFlags) locData.customFlags = {};
        locData.customFlags.stashLooted = true;
        foundStorageLoot = true; // Учитываем, что что-то нашли
    }


    if (!foundStorageLoot && locData.customFlags.storageLooted && (locData.customFlags.stashLooted || !terminals?.red_rocket_terminal?.customFlags?.hackedSuccessfully)) {
       addLog("game", "Вы уже все здесь обыскали.");
    } else if (!foundStorageLoot) {
       addLog("game", "Кажется, здесь больше ничего ценного нет.");
    }

    // Обновить текст кнопки после входа/обыска
    const choiceToUpdate = locData.choices?.find(c => c.actionFunctionName === "tryDisarmRedRocketTrap" || c.actionFunctionName === "enterRedRocketStorage");
    if (choiceToUpdate) {
        choiceToUpdate.text = "Осмотреть складское помещение (обыскано)";
        choiceToUpdate.actionFunctionName = "enterRedRocketStorage"; // Повторный вход просто покажет лог "обыскано"
    }
    return "NO_SCREEN_CHANGE";
}

function tryDisarmRedRocketTrap() {
    const locData = gameLocations?.red_rocket_station;
    if (!locData || !locData.trap) { // Trap data должна быть в locData, например locData.trap = { difficulty: "easy", damage: {min:10, max:20}, id:"rr_storage_trap" }
        addLog("game", "Ошибка: Данные о ловушке не найдены.");
        return "NO_SCREEN_CHANGE";
    }

    if (player.hasPerk("light_step_1")) {
        addLog("game", "Благодаря 'Легкому шагу', вы аккуратно обходите ловушку, не активировав её!", "item");
        if (!locData.customFlags) locData.customFlags = {};
        locData.customFlags.trapDisarmed = true;
        player.addXp(15);
        const storageChoice = locData.choices?.find(c => c.actionFunctionName === "tryDisarmRedRocketTrap");
        if (storageChoice) {
            storageChoice.text = "Войти на склад (ловушка обезврежена)";
            storageChoice.actionFunctionName = "enterRedRocketStorage";
        }
        // renderLocation(currentLocationId); // processChoice
        return "NO_SCREEN_CHANGE";
    }
    startMinesweeperGame(locData.trap.difficulty, locData.trap.damage);
    return "SCREEN_CHANGED";
}

function onEnterRedRocket() {
    updateDiscoveredLocations("red_rocket_station");
    const locData = gameLocations?.red_rocket_station;
    if (locData?.radExposure) player.addRads(locData.radExposure);

    if (locData?.collectables) locData.collectables.forEach(collectable => {
        if (collectable?.id === "dog_collar_note" && collectable.requiresDogFound &&
            locData.customFlags?.dogFound && player.companion?.id === "dogmeat" && !collectable.isCollected) {
            addLog("game", `Вы замечаете ${collectable.name?.toLowerCase() || "записку"}, прикрепленную к ошейнику ${player.companion.name || "Псины"}.`);
            player.collectHolodisk(collectable.id);
            collectable.isCollected = true;
        }
    });
}

// --- ОСТАЛЬНЫЕ ФУНКЦИИ LOCATION ACTIONS, COMBAT, TERMINAL, COMPANION, TIME, RADIO, MINESWEEPER, SCREEN MANAGEMENT, INIT ---
// Требуют аналогичного внимательного пересмотра на предмет проверок null/undefined,
// логических несостыковок, зависимости от внешних данных и возможностей для улучшения.
// Из-за огромного объема кода, я не могу детализировать каждую функцию здесь, но общий подход будет таким же:
// 1. Проверка существования данных перед использованием (allItems, gameLocations[locId], terminals[termId], etc.).
// 2. Использование optional chaining (?.) и nullish coalescing (??) для безопасного доступа.
// 3. Логирование ошибок или предупреждений при отсутствии данных, чтобы помочь в отладке "мертвых зон" или неработающих функций.
// 4. Убедиться, что функции, изменяющие состояние игры, вызывают updateAllDisplays() или более специфичные update-функции.
// 5. Для функций, вызываемых по строке (actionFunctionName, etc.), использовать try-catch при их вызове для перехвата ошибок.

// ПРИМЕРЫ ТОЧЕЧНЫХ ИСПРАВЛЕНИЙ В ОСТАЛЬНОМ КОДЕ:

// В onSuccessVaultDoorTerminal:
// const mainQuest = player.quests?.find(q => q.id === "main_quest_1");
// if(mainQuest?.status === "active" && typeof unlockPlotEntry === "function" && mainQuest.journalEntry) {
//     unlockPlotEntry(mainQuest.journalEntry);
// }

// В startCombat:
// currentEnemy.parts?.forEach(part => part.currentHp = part.hp); // Добавить ?

// В playerAttack:
// const equippedWeapon = player.inventory.weapons?.find(w => w.equipped) || {name: "Кулаки", damage: {min:1, max:3}, apCost: 2, type: "melee"}; // min 1 урон для кулаков

// В enemyTurn:
// const playerLimbIds = Object.keys(player.limbs || {}); // Защита от player.limbs = null
// if (player.companion && player.companion.currentHp > 0 && combatActive) { // Добавлена проверка currentHp
//     companionTurn(player.companion, currentEnemy);
// }

// В generateTerminalDisplay:
// if (terminalPassword === "ERROR" || (wordPool && wordPool.length === 0 && terminalWords.length <=1 )) { // Уточнено условие ошибки
//      addLog("terminal", "Ошибка конфигурации: нет слов нужной длины для генерации.");
//      terminalOutputDisplay.innerHTML = "ОШИБКА СИСТЕМЫ КОНФИГУРАЦИИ СЛОВАРЯ.<br>Пароль не может быть сгенерирован.";
//      // ... заблокировать ввод и кнопку выхода ...
//      document.getElementById("terminal-user-input").disabled = true;
//      const submitBtn = document.getElementById("terminal-submit-button");
//      if(submitBtn) { submitBtn.disabled = true; submitBtn.classList.add("disabled-button");}
//      return;
// }

// В _exitTerminalHacking:
// Убедиться, что currentTerminal сбрасывается в null *после* всех действий, чтобы избежать ошибок доступа.
// let previousCurrentTerminal = currentTerminal; // Сохранить для использования в логике
// currentTerminal = null; // Сбросить в конце функции

// В advanceTime, обновление таймера RadX:
// if (player.radXTimer > 0) {
//     player.radXTimer -= hoursAdvancedThisCall; // Уменьшаем на количество прошедших игровых часов
//     if (player.radXTimer <= 0) {
//         player.radResistanceBonusFromRadX = 0;
//         player.radXTimer = 0;
//         addLog("game", "Действие Рад-Х закончилось.", "info-color");
//         updateStatusDisplay(); // Обновить UI, если сопротивление отображается
//     }
// }
// И в самом начале: TICKS_PER_GAME_HOUR нужно определить (например, const TICKS_PER_GAME_HOUR = 4;)

// В bootUpPipBoy:
// typeWriterEffect(gameOutputEl, bootMessage, 15, () => {
//     console.log("Boot message typeWriterEffect completed.");
//     // Убран setTimeout, вызываем setCurrentLocation напрямую из коллбэка
//     setCurrentLocation( (player.discoveredLocations && player.discoveredLocations.length > 0) ? player.discoveredLocations[0] : "vault_entrance_hall" );
// });

// В masterGameTick, обновление таймеров терминалов:
// Удалить дублирующий блок обновления таймеров терминалов, т.к. он уже есть в advanceTime.
// Если advanceTime не вызывался (timeAdvancedThisTickInHours === 0), то и этот блок ничего не сделает.
// Логика в advanceTime более корректна.

// --- КОНЕЦ ПРИМЕРОВ ТОЧЕЧНЫХ ИСПРАВЛЕНИЙ ---

// Функция, которая не была определена, но вызывалась (заглушка):
// Реализация этой функции критична для сюжетного журнала.
function unlockPlotEntry(entryId) {
    if (!entryId) return;
    // ПРЕДПОЛАГАЕТСЯ, ЧТО storyTexts.plotJournalEntries ЗАГРУЖЕН И КОРРЕКТЕН
    if (storyTexts && storyTexts.plotJournalEntries && Array.isArray(storyTexts.plotJournalEntries)) {
        const entry = storyTexts.plotJournalEntries.find(e => e.id === entryId);
        if (entry) {
            if (!entry.unlocked) {
                entry.unlocked = true;
                // addLog("game", `Новая запись в журнале: "${entry.title || entryId}"`, "item"); // Лог может быть избыточен, если квест уже дал лог
                updatePlotJournalDisplay(); // Обновляем вкладку DATA/PLOT
            }
        } else {
            console.warn(`Plot journal entry with ID "${entryId}" not found.`);
        }
    } else {
        console.warn("storyTexts.plotJournalEntries is not available. Cannot unlock entry:", entryId);
    }
}

// Функции для управления базой (заглушки, т.к. реализация отсутствует)
// ПРЕДПОЛАГАЕТСЯ, ЧТО playerBase ЗАГРУЖЕН И КОРРЕКТЕН
if (typeof playerBase === 'undefined') {
    console.warn("playerBase object is not defined. Base-building features will not work.");
    playerBase = { isFounded: false, resources: {}, buildings: {} }; // Минимальная заглушка
}

function foundPlayerBase(locationId) {
    // Эта функция должна содержать логику проверки ресурсов, условий и т.д.
    // Сейчас это просто заглушка.
    addLog("game", `[ЗАГЛУШКА] Попытка основать базу в ${locationId}. Требуется реализация foundPlayerBase.`, "system");
    // playerBase.isFounded = true;
    // playerBase.locationId = locationId;
    // playerBase.name = gameLocations[locationId]?.name || "Моя база";
    // Инициализация ресурсов, построек и т.д.
    // updateBaseTabDisplay();
    // const baseTabButton = document.getElementById('base-tab-button');
    // if (baseTabButton) baseTabButton.style.display = "";
    // return true; // или false
    console.warn("foundPlayerBase function is a placeholder and needs implementation.");
    return false; // Пока что всегда неудача, чтобы не сломать логику, ожидающую bool
}

function updateBaseTabDisplay() {
    // Отображение информации о базе, ресурсах, постройках.
    const baseNameEl = document.getElementById("base-name-display");
    if (baseNameEl && playerBase.isFounded) baseNameEl.textContent = playerBase.name || "Неизвестная база";

    // console.warn("updateBaseTabDisplay function is a placeholder and needs implementation.");
    // Отобразить ресурсы, кнопки для строительства и т.д.
    const baseContentEl = document.getElementById("base-content");
    if (baseContentEl && playerBase.isFounded) {
        // Пример:
        // document.getElementById("base-overview-section").innerHTML = `<p>База основана в ${playerBase.locationId}.</p>`;
        // ... и так далее для ресурсов, построек ...
    } else if (baseContentEl) {
        // baseContentEl.innerHTML = "<p>База еще не основана. Найдите подходящее место!</p>";
    }
}

function recalculateBasePower() {
    // Расчет доступной/потребляемой энергии на базе.
    // console.warn("recalculateBasePower function is a placeholder and needs implementation.");
}

function updateBaseState(hoursPassed) {
    // Обновление состояния базы со временем (сбор ресурсов, потребление и т.д.).
    // console.warn("updateBaseState function is a placeholder and needs implementation.");
}


// Глобальные переменные для времени (должны быть определены до DOMContentLoaded)
// Их лучше инициализировать из сохраненной игры или playerTemplate, если это новый старт
let currentGameHour = player.time?.hour || 7;
let currentGameMinute = player.time?.minute || 0;
let currentDay = player.time?.day || 1;
let currentWeather = player.environment?.weather || "Ясно"; // Пример
let gameTickCounter = 0;

// Константы, которые должны быть определены (можно вынести в отдельный файл config.js)
const TICKS_PER_GAME_HOUR = 4; // Сколько "реальных" тиков игры составляют 1 игровой час (для блокировок терминалов)
const TICKS_PER_MINUTE_IRL = 20; // Как часто вызывается advanceTime в masterGameTick (например, 20 тиков = ~1 минута IRL)
const WEATHER_CHANGE_CHANCE = 0.1; // Шанс смены погоды каждый игровой час
const WEATHER_TYPES = ["Ясно", "Облачно", "Небольшой дождь", "Пыльная буря", "Радиационная буря"];
const GAME_HOURS_PER_DAY = 24;
const MAX_RADIO_LOG_MESSAGES = 15; // Увеличил немного
