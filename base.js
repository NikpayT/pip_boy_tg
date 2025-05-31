// base.js

const playerBase = {
    name: "Укрытие Выжившего",
    isFounded: false,
    locationId: null,
    level: 0,
    description: "Небольшое, еще не обустроенное место, которое может стать домом.",
    slots: {
        core: 1,
        production: 0,
        crafting: 0,
        defense: 0,
        support: 0,
        housing: 0
    },
    buildings: [],
    resources: {
        scrap_metal: 0,
        wood: 0,
        electronics_scrap: 0,
        fabric: 0,
        food_raw: 0,
        water_dirty: 0,
        components_basic: 0,
        fuel: 0,
    },
    blueprintsOwned: ["command_center", "scrap_storage_small", "makeshift_bed", "water_collector_basic", "workbench_basic", "barricade_scrap", "generator_junk"],
    settlers: [],
    defense: {
        baseHp: 100,
        rating: 0,
        log: []
    },
    power: {
        produced: 0,
        consumed: 0
    },
    dailyNeeds: {
        food: 0,
        water: 0
    },
    nextEventTick: 0,
    constructionQueue: []
};

const baseBlueprints = {
    // --- CORE ---
    "command_center": {
        id: "command_center",
        name: "Командный Центр",
        category: "core",
        maxLevel: 3,
        levels: [
            {
                level: 1,
                description: "Простейшее укрытие. Обеспечивает базовую кровать и небольшой ящик для ресурсов.",
                buildCost: [{ item: "scrap_metal", quantity: 30 }, { item: "wood", quantity: 15 }],
                buildTime: 4,
                hp: 100,
                provides: ["Сон (базовый)", "Склад ресурсов (малый)"],
                powerConsumed: 0,
                slotsProvided: { production: 1, crafting: 1, defense: 1, support: 1, housing: 1 }
            },
            {
                level: 2,
                description: "Укрепленный пункт с радиостанцией для связи и картой окрестностей.",
                upgradeCost: [{ item: "scrap_metal", quantity: 50 }, { item: "electronics_scrap", quantity: 10 }, { item: "fabric", quantity: 5 }],
                upgradeTime: 8,
                hp: 200,
                provides: ["Сон (улучшенный)", "Склад ресурсов (средний)", "Радиостанция (базовая)", "Карта региона"],
                requiresBuildingLevel: { "command_center": 1 },
                powerConsumed: 1,
                slotsProvided: { production: 1, crafting: 0, defense: 1, support: 0, housing: 0 }
            },
            {
                level: 3,
                description: "Малый бункер с базовым медпунктом и улучшенной связью.",
                upgradeCost: [{ item: "scrap_metal", quantity: 100 }, { item: "electronics_scrap", quantity: 25 }, { item: "components_basic", quantity: 10 }],
                upgradeTime: 12,
                hp: 350,
                provides: ["Сон (комфортный)", "Склад ресурсов (большой)", "Радиостанция (улучшенная)", "Медпункт (базовый)"],
                requiresBuildingLevel: { "command_center": 2 },
                powerConsumed: 2,
                slotsProvided: { production: 1, crafting: 1, defense: 1, support: 1, housing: 1 }
            }
        ]
    },
    // --- STORAGE ---
    "scrap_storage_small": {
        id: "scrap_storage_small",
        name: "Малый Склад Хлама",
        category: "support",
        maxLevel: 3,
        levels: [
            {
                level: 1,
                description: "Несколько ящиков и полок для хранения базовых ресурсов.",
                buildCost: [{ item: "wood", quantity: 20 }, { item: "scrap_metal", quantity: 5 }],
                buildTime: 2,
                hp: 50,
                providesStorage: { scrap_metal: 200, wood: 100, fabric: 50, electronics_scrap: 50, components_basic: 20 },
                powerConsumed: 0
            },
            {
                level: 2,
                description: "Увеличенный склад с лучшей организацией.",
                upgradeCost: [{ item: "wood", quantity: 30 }, { item: "scrap_metal", quantity: 15 }],
                upgradeTime: 3,
                hp: 100,
                providesStorage: { scrap_metal: 400, wood: 200, fabric: 100, electronics_scrap: 100, components_basic: 50 },
                powerConsumed: 0
            },
            {
                level: 3,
                description: "Большой склад с укрепленными контейнерами.",
                upgradeCost: [{ item: "scrap_metal", quantity: 50 }, { item: "components_basic", quantity: 10 }],
                upgradeTime: 5,
                hp: 150,
                providesStorage: { scrap_metal: 800, wood: 400, fabric: 200, electronics_scrap: 200, components_basic: 100 },
                powerConsumed: 0
            }
        ]
    },
    // --- HOUSING ---
    "makeshift_bed": {
        id: "makeshift_bed",
        name: "Самодельная Кровать",
        category: "housing",
        maxLevel: 1,
        levels: [
            {
                level: 1,
                description: "Простая кровать для одного поселенца.",
                buildCost: [{ item: "wood", quantity: 5 }, { item: "fabric", quantity: 3 }],
                buildTime: 1,
                hp: 20,
                providesSettlerSpace: 1,
                powerConsumed: 0
            }
        ]
    },
    // --- PRODUCTION ---
    "water_collector_basic": {
        id: "water_collector_basic",
        name: "Сборщик Воды",
        category: "production",
        maxLevel: 2,
        levels: [
            {
                level: 1,
                description: "Простая система для сбора дождевой или конденсатной воды. Производит грязную воду.",
                buildCost: [{ item: "scrap_metal", quantity: 15 }, { item: "fabric", quantity: 5 }],
                buildTime: 3,
                hp: 60,
                produces: { item: "water_dirty", quantity: 2, perHours: 4 },
                powerConsumed: 0
            },
            {
                level: 2,
                description: "Улучшенный сборщик с фильтром. Производит немного чистой воды.",
                upgradeCost: [{ item: "scrap_metal", quantity: 20 }, { item: "electronics_scrap", quantity: 3 }, {item: "filter_unit", quantity: 1}],
                upgradeTime: 4,
                hp: 100,
                produces: { item: "purified_water", quantity: 1, perHours: 6 },
                requiresBuildingLevel: { "water_collector_basic": 1 },
                powerConsumed: 1
            }
        ]
    },
    "generator_junk": {
        id: "generator_junk",
        name: "Генератор из Хлама",
        category: "production",
        maxLevel: 2,
        levels: [
            {
                level: 1,
                description: "Шумный и ненадежный генератор, работающий на топливе. Производит немного энергии.",
                buildCost: [{ item: "scrap_metal", quantity: 25 }, { item: "electronics_scrap", quantity: 8 }, {item: "components_basic", quantity: 5}],
                buildTime: 6,
                hp: 80,
                producesPower: 5,
                consumesFuel: { item: "fuel", quantity: 1, perHours: 2},
                powerConsumed: 0
            },
            {
                level: 2,
                description: "Более эффективный и менее шумный генератор.",
                upgradeCost: [{ item: "scrap_metal", quantity: 40 }, { item: "electronics_scrap", quantity: 15 }, {item: "components_basic", quantity: 10}],
                upgradeTime: 8,
                hp: 120,
                producesPower: 10,
                consumesFuel: { item: "fuel", quantity: 1, perHours: 3},
                powerConsumed: 0
            }
        ]
    },
     // --- CRAFTING ---
    "workbench_basic": {
        id: "workbench_basic",
        name: "Базовый Верстак",
        category: "crafting",
        maxLevel: 2,
        levels: [
            {
                level: 1,
                description: "Позволяет разбирать хлам на компоненты и создавать простые предметы.",
                buildCost: [{ item: "wood", quantity: 15 }, { item: "scrap_metal", quantity: 10 }],
                buildTime: 3,
                hp: 70,
                provides: ["Разборка хлама", "Крафт (базовый)"],
                powerConsumed: 0
            },
            {
                level: 2,
                description: "Улучшенный верстак с дополнительными инструментами.",
                upgradeCost: [{ item: "scrap_metal", quantity: 25 }, { item: "components_basic", quantity: 5 }, { item: "gear", quantity: 3}],
                upgradeTime: 5,
                hp: 100,
                provides: ["Разборка хлама (эффективнее)", "Крафт (средний)"],
                powerConsumed: 0
            }
        ]
    },
    // --- DEFENSE ---
    "barricade_scrap": {
        id: "barricade_scrap",
        name: "Баррикада из Хлама",
        category: "defense",
        maxLevel: 1,
        levels: [
            {
                level: 1,
                description: "Невысокая стена из металлолома и мусора. Дает минимальную защиту.",
                buildCost: [{ item: "scrap_metal", quantity: 20 }, { item: "wood", quantity: 5 }],
                buildTime: 2,
                hp: 150,
                defenseBonus: 5,
                powerConsumed: 0
            }
        ]
    }
};

function foundPlayerBase(locationIdToFound) {
    if (playerBase.isFounded) {
        addLog("game", "У вас уже есть база!", "system");
        return false;
    }
    const locData = gameLocations[locationIdToFound];
    if (!locData || !locData.canBeBase) {
        addLog("game", "Это место не подходит для основания базы.", "system");
        return false;
    }

    // Проверяем начальные ресурсы ИГРОКА (а не базы, т.к. база еще не существует)
    const initialBuildCosts = baseBlueprints["command_center"].levels[0].buildCost;
    let canAffordInitial = true;
    for (const cost of initialBuildCosts) {
        let playerItemCount = 0;
        for (const category of ['misc', 'aid', 'weapons', 'apparel']) { // Ищем по всем категориям инвентаря
            const item = player.inventory[category].find(i => i.id === cost.item);
            if (item) {
                playerItemCount = item.quantity;
                break;
            }
        }
        if (playerItemCount < cost.quantity) {
            canAffordInitial = false;
            addLog("game", `Недостаточно ${allItems[cost.item]?.name || cost.item} (нужно ${cost.quantity}, есть ${playerItemCount}) для основания базы.`, "warning-color");
            break;
        }
    }

    if (!canAffordInitial) {
        return false;
    }

    // Тратим ресурсы игрока на первоначальную постройку КЦ
    initialBuildCosts.forEach(cost => {
        for (const category of ['misc', 'aid', 'weapons', 'apparel']) {
            const item = player.inventory[category].find(i => i.id === cost.item);
            if (item) {
                item.quantity -= cost.quantity;
                if (item.quantity <= 0) {
                    player.inventory[category] = player.inventory[category].filter(i => i.id !== cost.item);
                }
                break;
            }
        }
    });
    updateInventoryDisplay(); // Обновляем инвентарь игрока

    playerBase.isFounded = true;
    playerBase.locationId = locationIdToFound;
    playerBase.description = `Обустроенное укрытие в локации "${locData.name}".`;
    addLog("game", `Вы основали базу в локации: ${locData.name}! Ресурсы на Командный Центр Ур.1 взяты из вашего инвентаря.`, "item");

    if (playerBase.blueprintsOwned.includes("command_center")) {
        const ccBlueprint = baseBlueprints["command_center"];
        const ccLevel1 = ccBlueprint.levels[0];
        const newBuildingId = `command_center_instance_${Date.now()}`;
        playerBase.buildings.push({
            id: newBuildingId,
            blueprintId: "command_center",
            name: `${ccBlueprint.name} Ур.1`,
            level: 1,
            hp: ccLevel1.hp,
            maxHp: ccLevel1.hp,
            status: "operational",
            category: ccBlueprint.category,
            assignedWorkerId: null,
            constructionTimeLeft: 0
        });
        playerBase.slots.core--;
        Object.keys(ccLevel1.slotsProvided).forEach(cat => {
            playerBase.slots[cat] = (playerBase.slots[cat] || 0) + ccLevel1.slotsProvided[cat];
        });
         addLog("game", `${ccBlueprint.name} Ур.1 автоматически установлен.`, "system");
    }

    const baseTabButton = document.getElementById('base-tab-button');
    if(baseTabButton) {
        baseTabButton.style.display = "";
        if (!baseTabButton.dataset.listenerAttached) {
            baseTabButton.addEventListener("click", () => showTab("base"));
            baseTabButton.dataset.listenerAttached = "true";
        }
    }
    updateBaseTabDisplay();
    recalculateBasePower();
    return true;
}

function canPlayerAffordBuildOrUpgrade(blueprintId, levelIndex = 0) {
    const blueprint = baseBlueprints[blueprintId];
    if (!blueprint || !blueprint.levels[levelIndex]) return false;

    const costArray = levelIndex === 0 ? blueprint.levels[levelIndex].buildCost : blueprint.levels[levelIndex].upgradeCost;
    if (!costArray) return false;

    for (const cost of costArray) {
        if ((playerBase.resources[cost.item] || 0) < cost.quantity) {
            return false;
        }
    }
    return true;
}

function spendBaseResourcesForBuildOrUpgrade(blueprintId, levelIndex = 0) {
    const blueprint = baseBlueprints[blueprintId];
    if (!blueprint || !blueprint.levels[levelIndex]) return;
    const costArray = levelIndex === 0 ? blueprint.levels[levelIndex].buildCost : blueprint.levels[levelIndex].upgradeCost;
    if (!costArray) return;

    costArray.forEach(cost => {
        playerBase.resources[cost.item] -= cost.quantity;
    });
}

function startBuildingProcess(blueprintId, existingBuildingInstanceId = null) {
    if (!playerBase.isFounded) {
        addLog("game", "Сначала нужно основать базу!", "system");
        return;
    }

    const blueprint = baseBlueprints[blueprintId];
    if (!blueprint) {
        addLog("game", `Чертеж ${blueprintId} не найден.`, "system");
        return;
    }

    let targetLevelIndex = 0;
    let existingBuilding = null;
    let buildTime;
    let buildingName = blueprint.name;
    let isUpgrade = false;

    if (existingBuildingInstanceId) {
        existingBuilding = playerBase.buildings.find(b => b.id === existingBuildingInstanceId);
        if (!existingBuilding || existingBuilding.blueprintId !== blueprintId) {
            addLog("game", "Ошибка улучшения: здание не найдено или неверный чертеж.", "system");
            return;
        }
        if (playerBase.constructionQueue.find(q => q.buildingId === existingBuildingInstanceId)) {
             addLog("game", `${existingBuilding.name} уже в очереди на улучшение.`, "system"); return;
        }
        isUpgrade = true;
        targetLevelIndex = existingBuilding.level;
        if ((targetLevelIndex + 1) > blueprint.maxLevel) {
            addLog("game", `${blueprint.name} уже максимального уровня.`, "system");
            return;
        }
        if (!blueprint.levels[targetLevelIndex] || !blueprint.levels[targetLevelIndex].upgradeCost) {
             addLog("game", `Для ${blueprint.name} Ур.${targetLevelIndex + 1} не определена стоимость улучшения.`, "system");
             return;
        }
        buildTime = blueprint.levels[targetLevelIndex].upgradeTime;
        buildingName = `${blueprint.name} Ур.${targetLevelIndex + 1}`;
    } else {
        if (playerBase.constructionQueue.find(q => q.blueprintId === blueprintId && !q.buildingId)) {
            addLog("game", `Здание по чертежу ${blueprint.name} уже в очереди на постройку.`, "system"); return;
        }
        if (blueprint.category !== "core" && playerBase.slots[blueprint.category] <= 0) {
            addLog("game", `Нет свободных слотов для постройки типа "${blueprint.category}".`, "system");
            return;
        }
        buildTime = blueprint.levels[0].buildTime;
    }

    if (!canPlayerAffordBuildOrUpgrade(blueprintId, targetLevelIndex)) {
        addLog("game", `Недостаточно ресурсов на складе базы для ${isUpgrade ? 'улучшения' : 'постройки'} ${buildingName}.`, "system");
        return;
    }

    spendBaseResourcesForBuildOrUpgrade(blueprintId, targetLevelIndex);
    addLog("game", `Начато ${isUpgrade ? 'улучшение' : 'строительство'} ${buildingName}. Время: ${buildTime} ч.`, "system");

    if (isUpgrade) {
        playerBase.constructionQueue.push({
            buildingId: existingBuildingInstanceId,
            blueprintId: blueprintId,
            targetLevelIndex: targetLevelIndex,
            timeLeft: buildTime
        });
        existingBuilding.status = "upgrading";
    } else {
        const newBuildingInstanceId = `${blueprintId}_instance_${Date.now()}`;
        const newBuildingData = {
            id: newBuildingInstanceId,
            blueprintId: blueprintId,
            name: blueprint.name,
            level: 0,
            hp: blueprint.levels[0].hp / 2,
            maxHp: blueprint.levels[0].hp,
            status: "constructing",
            category: blueprint.category,
            assignedWorkerId: null,
        };
        playerBase.buildings.push(newBuildingData);

        playerBase.constructionQueue.push({
            buildingId: newBuildingInstanceId,
            blueprintId: blueprintId,
            targetLevelIndex: 0,
            timeLeft: buildTime
        });
        if (blueprint.category !== "core") playerBase.slots[blueprint.category]--;
    }
    updateBaseTabDisplay();
}

function updateBaseState(hoursPassed = 0) {
    if (!playerBase.isFounded || hoursPassed === 0) return;

    let somethingChanged = false;

    for (let i = playerBase.constructionQueue.length - 1; i >= 0; i--) {
        const job = playerBase.constructionQueue[i];
        job.timeLeft -= hoursPassed;
        somethingChanged = true;

        if (job.timeLeft <= 0) {
            const building = playerBase.buildings.find(b => b.id === job.buildingId);
            if (building) {
                const blueprint = baseBlueprints[building.blueprintId];
                const targetLevelData = blueprint.levels[job.targetLevelIndex];

                building.level = targetLevelData.level;
                building.name = `${blueprint.name} Ур.${building.level}`;
                building.hp = targetLevelData.hp;
                building.maxHp = targetLevelData.hp;
                building.status = "operational";

                addLog("game", `Строительство/улучшение ${building.name} завершено!`, "item");

                if (targetLevelData.slotsProvided && building.blueprintId === "command_center") { // Слоты дает только КЦ при улучшении
                    Object.keys(targetLevelData.slotsProvided).forEach(cat => {
                        playerBase.slots[cat] = (playerBase.slots[cat] || 0) + targetLevelData.slotsProvided[cat];
                    });
                }
                recalculateBasePower();
            }
            playerBase.constructionQueue.splice(i, 1);
        }
    }

    playerBase.buildings.forEach(building => {
        if (building.status === "operational" && building.level > 0) {
            const blueprint = baseBlueprints[building.blueprintId];
            const levelData = blueprint.levels[building.level - 1];

            if (levelData.consumesFuel) {
                const fuelNeededThisTick = (hoursPassed / (levelData.consumesFuel.perHours || 1)) * levelData.consumesFuel.quantity;
                if ((playerBase.resources[levelData.consumesFuel.item] || 0) >= fuelNeededThisTick) {
                    playerBase.resources[levelData.consumesFuel.item] -= fuelNeededThisTick;
                } else {
                    // Недостаточно топлива, генератор не производит (это учтется в recalculateBasePower)
                }
                somethingChanged = true;
            }

            let buildingHasPower = true;
            if (levelData.powerConsumed > 0) {
                buildingHasPower = playerBase.power.produced >= playerBase.power.consumed; // Упрощенная проверка общей энергии
            }
            // Для генераторов: они производят энергию, если есть топливо (проверено выше), независимо от общего баланса
            const isGenerator = levelData.producesPower > 0;


            if (levelData.produces && (buildingHasPower || isGenerator)) {
                const itemsToProduceThisTick = Math.floor((hoursPassed / (levelData.produces.perHours || 1)) * levelData.produces.quantity);
                if (itemsToProduceThisTick > 0) {
                    const producedItem = levelData.produces.item;
                    playerBase.resources[producedItem] = (playerBase.resources[producedItem] || 0) + itemsToProduceThisTick;
                    somethingChanged = true;
                }
            }
        }
    });
    recalculateBasePower();

    if (somethingChanged && currentActiveScreenContentId === "base-content") {
        updateBaseTabDisplay();
    }
}

function recalculateBasePower() {
    let produced = 0;
    let consumed = 0;
    playerBase.buildings.forEach(building => {
        if (building.status === "operational" && building.level > 0) {
            const blueprint = baseBlueprints[building.blueprintId];
            const levelData = blueprint.levels[building.level - 1];
            if (levelData.producesPower) {
                let generatorWorks = true;
                if (levelData.consumesFuel && (playerBase.resources[levelData.consumesFuel.item] || 0) <= 0) {
                    generatorWorks = false;
                }
                if(generatorWorks) produced += levelData.producesPower;
            }
            if (levelData.powerConsumed) {
                consumed += levelData.powerConsumed;
            }
        }
    });
    playerBase.power.produced = produced;
    playerBase.power.consumed = consumed;
}

function updateBaseTabDisplay() {
    const baseContentEl = document.getElementById("base-content");
    if (!baseContentEl) {
        console.warn("Base content element not found during updateBaseTabDisplay. Attempting to create.");
        createBaseContentDiv(); // Попробуем создать, если его нет
        if (!document.getElementById("base-content")) { // Если все еще нет, выходим
            console.error("Failed to create base content element.");
            return;
        }
    }


    if (!playerBase.isFounded) {
        baseContentEl.innerHTML = `<h2>УПРАВЛЕНИЕ БАЗОЙ</h2>
                                 <p>База еще не основана. Найдите подходящее место!</p>
                                 <p>(Например, локация "Заправка 'Красная Ракета' может стать вашей базой после выполнения определенных условий).</p>`;
        return;
    }

    const baseNameDisplay = document.getElementById("base-name-display");
    if (baseNameDisplay) baseNameDisplay.textContent = playerBase.name;


    const overviewSection = document.getElementById("base-overview-section");
    if (overviewSection) {
        overviewSection.innerHTML = `<h3>Обзор</h3>
                                    <p>Местоположение: ${gameLocations[playerBase.locationId]?.name || "Неизвестно"}</p>
                                    <p>Уровень базы: ${playerBase.level}</p>
                                    <p>Описание: ${playerBase.description}</p>
                                    <p>Энергия: <span style="color:${playerBase.power.produced >= playerBase.power.consumed ? 'var(--pipboy-green-medium)' : 'var(--danger-color)'}">${playerBase.power.produced} / ${playerBase.power.consumed}</span></p>
                                    <p>Свободные слоты:
                                        Ядро: ${playerBase.slots.core},
                                        Произв.: ${playerBase.slots.production},
                                        Крафт: ${playerBase.slots.crafting},
                                        Оборона: ${playerBase.slots.defense},
                                        Поддержка: ${playerBase.slots.support},
                                        Жилье: ${playerBase.slots.housing}
                                    </p>`;
    }

    const resourcesSection = document.getElementById("base-resources-section");
    if (resourcesSection) {
        let resourcesHtml = "<h3>Ресурсы на складе</h3><ul>";
        let hasResources = false;
        for (const resId in playerBase.resources) {
            if (playerBase.resources[resId] > 0) {
                const itemName = allItems[resId]?.name || resId.replace(/_/g, " ");
                resourcesHtml += `<li>${itemName}: ${Math.floor(playerBase.resources[resId])}</li>`;
                hasResources = true;
            }
        }
        if (!hasResources) resourcesHtml += "<li>Склад пуст.</li>";
        resourcesHtml += "</ul>";
        resourcesSection.innerHTML = resourcesHtml;
    }

    const buildingsSection = document.getElementById("base-buildings-section");
    if (buildingsSection) {
        let buildingsHtml = "<h3>Построенные Здания</h3>";
        if (playerBase.buildings.length === 0) {
            buildingsHtml += "<p>Нет построенных зданий.</p>";
        } else {
            buildingsHtml += "<ul>";
            playerBase.buildings.forEach(b => {
                const blueprint = baseBlueprints[b.blueprintId];
                let statusText = b.status;
                const jobInQueue = playerBase.constructionQueue.find(q => q.buildingId === b.id);
                if (jobInQueue) {
                    statusText = `${b.status === "constructing" ? "Строится" : "Улучшается"}, ${Math.ceil(jobInQueue.timeLeft || 0)}ч.`;
                } else if (b.status === "constructing" || b.status === "upgrading") { // Если в очереди нет, но статус такой (ошибка?)
                    statusText = `${b.status} (ожидает завершения)`;
                }


                buildingsHtml += `<li><b>${b.name}</b> (Состояние: ${statusText}) `;
                if (b.status === "operational" && blueprint && b.level < blueprint.maxLevel) {
                    const nextLevelIndex = b.level;
                    const canAfford = canPlayerAffordBuildOrUpgrade(b.blueprintId, nextLevelIndex);
                    buildingsHtml += `<button class="main-button small-button ${canAfford ? '' : 'disabled-button'}"
                                              onclick="startBuildingProcess('${b.blueprintId}', '${b.id}')"
                                              ${canAfford ? '' : 'disabled'}>
                                          Улучшить до Ур.${nextLevelIndex + 1}
                                      </button>`;
                }
                buildingsHtml += `</li>`;
            });
            buildingsHtml += "</ul>";
        }
        buildingsSection.innerHTML = buildingsHtml;
    }

    const constructionSection = document.getElementById("base-construction-section");
    if (constructionSection) {
        let constructionHtml = "<h3>Доступные Чертежи для Постройки</h3><ul>";
        let canBuildSomething = false;
        playerBase.blueprintsOwned.forEach(bpId => {
            const blueprint = baseBlueprints[bpId];
            if (blueprint) {
                const existingBuildingOfThisType = playerBase.buildings.find(b => b.blueprintId === bpId);
                const isCoreAndExists = blueprint.category === "core" && existingBuildingOfThisType;
                const isAlreadyInQueueForNew = playerBase.constructionQueue.find(q=> q.blueprintId === bpId && !playerBase.buildings.find(b => b.id === q.buildingId && b.blueprintId === bpId));

                if (!isCoreAndExists && playerBase.slots[blueprint.category] > 0 && !isAlreadyInQueueForNew) {
                     const canAfford = canPlayerAffordBuildOrUpgrade(bpId, 0);
                     constructionHtml += `<li>${blueprint.name} Ур.1
                                         <button class="main-button small-button ${canAfford ? '' : 'disabled-button'}"
                                                 onclick="startBuildingProcess('${bpId}')"
                                                 ${canAfford ? '' : 'disabled'}>
                                             Построить
                                         </button>
                                         <small>(Требует: ${blueprint.levels[0].buildCost.map(c => `${allItems[c.item]?.name || c.item} x${c.quantity}`).join(', ')})</small>
                                      </li>`;
                    canBuildSomething = true;
                }
            }
        });
        if (!canBuildSomething && playerBase.buildings.length > 0) constructionHtml += "<li>Нет доступных для постройки чертежей или свободных слотов.</li>";
        else if (!canBuildSomething && playerBase.buildings.length === 0 && playerBase.slots.core === 0) constructionHtml += "<li>Нет доступных для постройки чертежей или свободных слотов.</li>";
        else if (playerBase.slots.core > 0 && playerBase.blueprintsOwned.includes("command_center") && !canBuildSomething && !playerBase.buildings.find(b=>b.blueprintId === "command_center")) {
            const canAffordCC = canPlayerAffordBuildOrUpgrade("command_center", 0);
            constructionHtml += `<li>Командный Центр Ур.1
                                         <button class="main-button small-button ${canAffordCC ? '' : 'disabled-button'}"
                                                 onclick="startBuildingProcess('command_center')"
                                                 ${canAffordCC ? '' : 'disabled'}>
                                             Построить КЦ
                                         </button>
                                         <small>(Требует: ${baseBlueprints["command_center"].levels[0].buildCost.map(c => `${allItems[c.item]?.name || c.item} x${c.quantity}`).join(', ')})</small>
                                      </li>`;
        }


        constructionHtml += "</ul>";
        constructionSection.innerHTML = constructionHtml;
    }

    const settlersSection = document.getElementById("base-settlers-section");
    if (settlersSection) settlersSection.innerHTML = "<h3>Поселенцы</h3><p>(Не реализовано)</p>";
    const defenseSection = document.getElementById("base-defense-section");
    if (defenseSection) defenseSection.innerHTML = "<h3>Оборона</h3><p>(Не реализовано)</p>";

    recalculateBasePower();
    const overviewSectionRecheck = document.getElementById("base-overview-section"); // Перепроверяем, если он был создан динамически
    if (overviewSectionRecheck) {
        const overviewPowerEl = overviewSectionRecheck.querySelector("p > span");
        if (overviewPowerEl) {
            overviewPowerEl.innerHTML = `${playerBase.power.produced} / ${playerBase.power.consumed}`;
            overviewPowerEl.style.color = playerBase.power.produced >= playerBase.power.consumed ? 'var(--pipboy-green-medium)' : 'var(--danger-color)';
        }
    }
}
// base.js