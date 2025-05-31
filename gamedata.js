// gamedata.js

const playerTemplate = {
    name: "Выживший",
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    perkPoints: 0,
    hp: 100,
    maxHpBase: 100,
    ap: 70,
    maxApBase: 70,
    apRegenRate: 0.25,
    rads: 0,
    radLevel: "Нет",
    caps: 25,
    stats: { s: 5, p: 5, e: 5, c: 5, i: 5, a: 5, l: 5 },
    skills: {
        speech: 25,
        barter: 25,
        lockpick: 20,
        science: 20,
        repair: 20,
        stealth: 25
    },
    limbs: {
        head: { name: "Голова", hp: 50, maxHp: 50, status: "Норма" },
        torso: { name: "Торс", hp: 100, maxHp: 100, status: "Норма" },
        left_arm: { name: "Левая Рука", hp: 75, maxHp: 75, status: "Норма" },
        right_arm: { name: "Правая Рука", hp: 75, maxHp: 75, status: "Норма" },
        left_leg: { name: "Левая Нога", hp: 75, maxHp: 75, status: "Норма" },
        right_leg: { name: "Правая Нога", hp: 75, maxHp: 75, status: "Норма" },
    },
    inventory: {
        weapons: [
            { id: "pipe_pistol", name: "Самопальный пистолет", quantity: 1, damage: {min: 5, max:10}, apCost: 3, type: "ranged", equipped: true, description: "Простой, но рабочий пистолет.", weight: 3 }
        ],
        apparel: [{id: "vault_suit", name: "Костюм Убежища 76", quantity: 1, equipped: true, bonus: {stealth: 5}, weight: 2}],
        aid: [
            { id: "stimpak", name: "Стимулятор", quantity: 2, description: "Восстанавливает 30% HP.", effectFunctionName: "useStimpakEffect", apCost: 2, weight: 0.1, category: "aid" },
            { id: "radaway", name: "Антирадин", quantity: 1, description: "Снижает радиацию на 250.", effectFunctionName: "useRadawayEffect", weight: 0.1, category: "aid" },
            { id: "purified_water", name: "Очищенная вода", quantity: 2, description: "Утоляет жажду.", effectFunctionName: "usePurifiedWaterEffect", weight: 0.5, category: "aid" },
            { id: "cram", name: "Консервы 'Крэм'", quantity: 1, description: "Утоляет голод.", effectFunctionName: "useCramEffect", weight: 0.3, category: "aid" }
        ],
        misc: [
             { id: "bobby_pin", name: "Заколка", quantity: 5, description: "Может пригодиться для взлома замков.", weight: 0.01, category: "misc" },
             { id: "scrap_metal", name: "Металлолом", quantity: 10, description: "Для ремонта и крафта.", weight: 0.5, category: "misc" },
             { id: "electronics_scrap", name: "Электроника", quantity: 3, description: "Для ремонта и крафта.", weight: 0.2, category: "misc" },
             { id: "wood", name: "Дерево", quantity: 5, description: "Строительный материал.", weight: 0.8, category: "misc" },
             { id: "fabric", name: "Ткань", quantity: 2, description: "Для одежды и кроватей.", weight: 0.1, category: "misc" }
        ]
    },
    quests: [
        { id: "main_quest_1", name: "Пробуждение в неизвестность", description: "Открыть дверь Убежища и выяснить, что произошло.", status: "active", journalEntry: "entry_001_awakening" }
    ],
    discoveredLocations: ["vault_entrance_hall"],
    activePerks: [],
    foundHolodisks: [],
    reputation: {
        settlers: 0,
        scavengers: 0,
        brotherhood_outpost: 0
    },
    needs: {
        hunger: 0,
        thirst: 0,
        fatigue: 0
    },
    companion: null,
    isStealthActive: false,
    diseases: [],
    addictions: []
};

const availablePerks = [
    { id: "strong_back_1", name: "Крепкий Хребет (1)", description: "+25 к максимальному весу.", cost: 1, requires: { level: 2, s: 4 } },
    { id: "life_giver_1", name: "Живчик (1)", description: "+20 к максимальному здоровью.", cost: 1, requires: { level: 3, e: 4 } },
    { id: "action_boy_1", name: "Живчик-энерджайзер (1)", description: "+10 к максимальным Очкам Действия. Ускоряет регенерацию ОД.", cost: 1, requires: { level: 4, a: 5 } },
    { id: "hacker_1", name: "Хакер (1)", description: "Позволяет взламывать терминалы средней сложности. +1 попытка при взломе.", cost: 1, requires: { level: 5, i: 4 } },
    { id: "awareness", name: "Осведомленность", description: "Показывает HP частей тела врага и их состояние.", cost: 1, requires: { level: 2, p: 3 } },
    { id: "bloody_mess_1", name: "Кровавая баня (1)", description: "+5% к наносимому урону в бою.", cost: 1, requires: { level: 6 } },
    { id: "scrounger_1", name: "Кладоискатель (1)", description: "Шанс найти дополнительные боеприпасы/припасы в контейнерах.", cost: 1, requires: {level: 3, l: 4} },
    { id: "sneak_1", name: "Скрытность (1)", description: "+10 к навыку Скрытности. Уменьшает шанс быть обнаруженным.", cost: 1, requires: { level: 2, a: 4 } },
    { id: "animal_friend_1", name: "Друг Животных (1)", description: "Животные (например, Псина) реже атакуют первыми и могут стать компаньонами.", cost: 1, requires: {level: 3, c: 5}} ,
    { id: "light_step_1", name: "Легкий шаг (1)", description: "Вы не активируете напольные ловушки. Повышает шанс обезвредить ловушку.", cost: 1, requires: {level: 4, a: 6, p: 5}}
];

const gameLocations = {
    "vault_entrance_hall": {
        name: "Убежище 76 (Холл)",
        description: () => storyTexts.locationDescriptions.getVaultEntranceHallDescription(gameLocations["vault_entrance_hall"].customFlags.isDoorOpen || false),
        customFlags: { isDoorOpen: false, overseerRoomUnlocked: false },
        choices: [
            { text: "Осмотреть дверь Убежища", actionFunctionName: "inspectVaultDoor" },
            {
                text: () => {
                    const term = terminals["vault_door_terminal"];
                    if (term.lockedOut) {
                        return `Терминал управления дверью (ЗАБЛОКИРОВАН ЕЩЕ ${Math.ceil(term.lockoutTimeLeft / TICKS_PER_GAME_HOUR)} ч.)`; // Используем TICKS_PER_GAME_HOUR
                    }
                    return "Подойти к терминалу управления дверью";
                },
                actionFunctionName: "approachVaultTerminal",
                conditionFunctionName: () => !terminals["vault_door_terminal"].lockedOut // Делаем неактивным, если lockedOut
            },
            {
                text: () => gameLocations["vault_entrance_hall"].customFlags.overseerRoomUnlocked ? "Войти в комнату Смотрителя" : "Осмотреть комнату Смотрителя (заперто)",
                conditionFunctionName: () => gameLocations["vault_entrance_hall"].customFlags.overseerRoomUnlocked || canPickOverseerLock(),
                onFailText: "Дверь в комнату Смотрителя заперта. Нужен ключ или умение вскрывать замки.",
                actionFunctionName: () => gameLocations["vault_entrance_hall"].customFlags.overseerRoomUnlocked ? setCurrentLocation("overseer_office") : tryPickOverseerLock()
            },
            { text: "Искать припасы в шкафчиках", actionFunctionName: "searchLockersVaultHall" }
        ],
        onEnterFunctionName: "onEnterVaultHall",
        collectables: [
            { id: "overseer_note_01", name: "Запись Смотрителя", type: "holodisk", isCollected: false }
        ],
        mapIcon: "⌂"
    },
    "overseer_office": {
        name: "Кабинет Смотрителя",
        description: () => "Кабинет Смотрителя. Пыль покрывает консоли и большой стол в центре. Похоже, отсюда спешно уходили. На столе стоит персональный терминал, а в углу – массивный стальной сейф.",
        customFlags: { deskSearched: false, safeOpened: false, keyCardFound: false },
        choices: [
            {
                text: () => {
                    const term = terminals["overseer_terminal"];
                    if (term.lockedOut) return `Терминал Смотрителя (ЗАБЛОКИРОВАН ЕЩЕ ${Math.ceil(term.lockoutTimeLeft / TICKS_PER_GAME_HOUR)} ч.)`;
                    return term.customFlags?.accessedAllEntries ? "Терминал Смотрителя (все записи прочитаны)" : "Осмотреть терминал Смотрителя";
                },
                actionFunctionName: "approachOverseerTerminal",
                conditionFunctionName: () => !terminals["overseer_terminal"].lockedOut || terminals["overseer_terminal"].customFlags?.accessedAllEntries // Можно посмотреть прочитанный терминал
            },
            {
                text: () => gameLocations["overseer_office"].customFlags.safeOpened ? "Сейф Смотрителя (пуст)" : "Попытаться вскрыть сейф Смотрителя",
                actionFunctionName: "tryPickOverseerSafe",
                conditionFunctionName: () => !gameLocations["overseer_office"].customFlags.safeOpened
            },
            {
                text: () => gameLocations["overseer_office"].customFlags.deskSearched ? "Стол и полки (обысканы)" : "Обыскать стол и полки",
                actionFunctionName: "searchOverseerDesk",
                conditionFunctionName: () => !gameLocations["overseer_office"].customFlags.deskSearched
            },
            { text: "Вернуться в холл Убежища", target: "vault_entrance_hall" }
        ],
        mapIcon: "⁂"
    },
    "wasteland_near_vault": {
        name: "Пустошь у Убежища",
        description: () => storyTexts.locationDescriptions.getWastelandNearVaultDescription(),
        choices: [
            { text: "Осмотреться", actionFunctionName: "lookAroundWasteland" },
            { text: "Двигаться к руинам городка Спрингвейл (Восток)", target: "ruined_town_outskirts" },
            { text: "Идти к заправке 'Красная Ракета' (Запад)", target: "red_rocket_station"},
            {
                text: "Вернуться в Убежище 76",
                conditionFunctionName: "canReturnToVault",
                onFailText: "Дверь Убежища снова запечатана.",
                target: "vault_entrance_hall"
            }
        ],
        onEnterFunctionName: "onEnterWastelandNearVault",
        radExposure: 2,
        mapIcon: "…"
    },
    "red_rocket_station": {
        name: "Заправка 'Красная Ракета'",
        description: () => storyTexts.locationDescriptions.getRedRocketDescription(gameLocations["red_rocket_station"].customFlags.dogFound || false, player),
        customFlags: { dogFound: false, terminalHacked: false, trapDisarmed: false, stashLooted: false, storageLooted: false, baseFoundedHere: false },
        canBeBase: true,
        choices: [
            { text: "Осмотреть заправку", actionFunctionName: "searchRedRocketStation" },
            {
                text: "Подойти к собаке",
                conditionFunctionName: "isDogAtRedRocketNotYetFriend",
                actionFunctionName: "approachDogAtRedRocket"
            },
            { text: () => terminals["red_rocket_terminal"].lockedOut ? `Терминал на стене (ЗАБЛОКИРОВАН ЕЩЕ ${Math.ceil(terminals["red_rocket_terminal"].lockoutTimeLeft / TICKS_PER_GAME_HOUR)} ч.)` : (terminals["red_rocket_terminal"].customFlags?.hackedSuccessfully ? "Терминал на стене (взломан)" : "Попытаться взломать терминал на стене"),
              conditionFunctionName: () => !terminals["red_rocket_terminal"].lockedOut && !terminals["red_rocket_terminal"].customFlags?.hackedSuccessfully,
              actionFunctionName: "approachRedRocketTerminal"
            },
            {
                text: "Осмотреть складское помещение (Осторожно!)",
                actionFunctionName: "enterRedRocketStorage"
            },
            {
                text: "Основать здесь базу",
                conditionFunctionName: "canFoundBaseAtRedRocket",
                actionFunctionName: "attemptToFoundBaseAtRedRocket"
            },
            { text: "Вернуться в Пустошь у Убежища", target: "wasteland_near_vault" }
        ],
        onEnterFunctionName: "onEnterRedRocket",
        radExposure: 1,
        collectables: [
            { id: "dog_collar_note", name: "Записка на ошейнике", type: "holodisk", isCollected: false, requiresDogFound: true }
        ],
        hasTrap: true,
        trap: { id: "rr_storage_trap", difficulty: "easy", disarmSkill: "repair", disarmDC: 30, damage: {min: 10, max: 20} },
        mapIcon: "⛽"
    },
    "ruined_town_outskirts": {
        name: "Окраины Спрингвейла",
        description: () => `Окраины разрушенного городка Спрингвейл. Дома развалены, повсюду мусор. В одном из полуразрушенных зданий, похоже, старый магазинчик, мерцает свет. Воздух здесь более радиоактивен.`,
        choices: [
            { text: "Осторожно подойти к магазину", target: "springvale_store_entrance" },
            { text: "Обыскать ближайшие руины", actionFunctionName: "searchSpringvaleRuins" },
            { text: "Попытаться прокрасться мимо руин", actionFunctionName: "trySneakPastSpringvaleRuins" },
            { text: "Вернуться в Пустошь у Убежища", target: "wasteland_near_vault" }
        ],
        onEnterFunctionName: "onEnterSpringvaleOutskirts",
        radExposure: 5,
        collectables: [
            { id: "scavenger_log_01", name: "Дневник Мусорщика", type: "holodisk", isCollected: false }
        ],
        mapIcon: "ավ"
    },
    "springvale_store_entrance": {
        name: "Супер-Дупер Март (Вход)",
        description: () => `Вы у входа в старый магазин "Супер-Дупер Март". Дверь слегка приоткрыта, изнутри доносится тихое бормотание и запах готовящейся пищи.`,
        choices: [
            { text: "Войти в магазин", actionFunctionName: "enterSpringvaleStore" },
            { text: "Попытаться заглянуть в окно", actionFunctionName: "peekSpringvaleStoreWindow" },
            { text: "Уйти", target: "ruined_town_outskirts"}
        ],
        onEnterFunctionName: "onEnterSpringvaleStoreEntrance",
        mapIcon: "🏪"
    },
    "springvale_store_interior": {
        name: "Супер-Дупер Март (Внутри)",
        description: () => {
            const joe = gameNpcData.settler_store;
            if (!joe) return "Ошибка: NPC Джо не найден.";
            const settlerAttitude = joe.attitude;
            if (settlerAttitude === "hostile") return "Поселенец враждебен и атакует!";
            return `${joe.name} (${storyTexts.npcDialogues.joeTheSettler.greeting})`;
        },
        choices: [
            { text: () => gameNpcData.settler_store.attitude === "hostile" ? "Защищаться!" : "[Спросить] Что это за место?", actionFunctionName: "askJoeAboutPlace" },
            { text: "[Торговать]", conditionFunctionName: "isJoeFriendly", actionFunctionName: "tradeWithJoe" },
            { text: () => `[Харизма ${player.stats.c >= 5 ? "<span style='color:#90ee90;'>УСПЕХ</span>" : "<span style='color:#ff6347;'>ПРОВАЛ</span>"}] Расскажи о Пустоши.`, conditionFunctionName: "isJoeFriendly", actionFunctionName: "askJoeAboutWasteland" },
            { text: "[Помочь Джо] У тебя есть какая-нибудь работа?", conditionFunctionName: "isJoeFriendlyAndQuestAvailable_FixAntenna", actionFunctionName: "startJoeQuest_FixAntenna", questId: "joe_fix_antenna" },
            // Добавить возможность спросить про сигнал бедствия после починки антенны
            { text: "[Спросить] Слышал что-нибудь необычное по радио?",
              conditionFunctionName: () => isJoeFriendly() && player.quests.find(q => q.id === "joe_fix_antenna" && q.status === "completed") && !player.quests.find(q => q.id === "distress_signal_investigation"),
              actionFunctionName: "askJoeAboutDistressSignal"
            },
            { text: "Уйти.", target: "springvale_store_entrance" }
        ],
        onEnterFunctionName: "onEnterSpringvaleStoreInterior",
        npcIds: ["joe_settler"],
        mapIcon: "🏪"
    }
};

const terminals = {
    "vault_door_terminal": {
        id: "vault_door_terminal",
        difficulty: "Легкий",
        passwordLength: 5,
        wordPool: ["ROBCO", "STEEL", "VAULT", "SECURE", "POWER", "ADMIN", "LOGIN", "WATER", "CLOSE", "ENTRY", "OPEN", "EXIT", "SAFE", "LOCK", "CODE", "DOOR"],
        attempts: 4,
        successMessageKey: "vaultDoorTerminal",
        onSuccessFunctionName: "onSuccessVaultDoorTerminal",
        onLockoutFunctionName: "onGenericTerminalLockout", // Общая функция для обработки блокировки
        lockoutTimeBase: 2, // в игровых часах
        lockoutTimeLeft: 0, // в игровых тиках (1 тик = ~15-30 мин)
        lockedOut: false,
        customFlags: {}
    },
    "red_rocket_terminal": {
        id: "red_rocket_terminal",
        difficulty: "Средний",
        passwordLength: 6,
        wordPool: ["ROCKET", "GARAGE", "SYSTEM", "ACCESS", "SECURE", "FUELUP", "REPAIR", "UNLOCK", "HIDDEN", "STASH"],
        attempts: 4,
        successMessageKey: "redRocketTerminal",
        onSuccessFunctionName: "onSuccessRedRocketTerminal",
        onLockoutFunctionName: "onGenericTerminalLockout",
        lockoutTimeBase: 4,
        lockoutTimeLeft: 0,
        lockedOut: false,
        requiresSkill: "science",
        skillDC: 35,
        customFlags: { hackedSuccessfully: false } // Для отметки успешного взлома
    },
    "overseer_terminal": {
        id: "overseer_terminal",
        difficulty: "Средний",
        passwordLength: 7,
        wordPool: ["OVERSEER", "PROJECT", "FAILURE", "EVACUATE", "PROTOCOL", "SURVIVAL", "HOPELESS", "MESSAGE", "RECLAMATION", "EMERGENCY"],
        attempts: 4,
        successMessageKey: "overseerTerminalAccess",
        onSuccessFunctionName: "onSuccessOverseerTerminal",
        onLockoutFunctionName: "onGenericTerminalLockout",
        lockoutTimeBase: 3,
        lockoutTimeLeft: 0,
        lockedOut: false,
        customFlags: { accessedAllEntries: false, personalLogRead: false, securityLogRead: false }, // Отслеживаем прочитанные записи
        entries: [ // Записи в терминале
            { id: "personal_log", name: "Личный Журнал Смотрителя", holodiskId: "overseer_terminal_log_personal" },
            { id: "security_protocols", name: "Протоколы Безопасности", holodiskId: "overseer_terminal_log_security" },
            { id: "external_data", name: "Данные о Внешнем Мире (Повреждены)", text: "Попытка доступа к внешним данным... ОШИБКА ЧТЕНИЯ. Файл поврежден. Удаленные сенсоры показывают повышенный уровень радиации... критический... рекомендация: ЗАПЕЧАТАТЬ УБЕЖИЩЕ."}
        ]
    }
};

const enemies = {
    "raider_scum": {
        name: "Рейдер-Отморозок", hp: 60, maxHp: 60, ap: 5, maxAp: 5, damage: {min: 4, max: 8}, accuracyBonus: 0, xpValue: 25,
        parts: [
            { id: "head", name: "Голова", hitChanceMod: -20, damageMod: 2.0, hp: 20, currentHp: 20, status: "normal" },
            { id: "torso", name: "Торс", hitChanceMod: +10, damageMod: 1.0, hp: 40, currentHp: 40, status: "normal" },
            { id: "left_arm", name: "Левая Рука", hitChanceMod: -5, damageMod: 0.8, hp: 25, currentHp: 25, status: "normal" },
            { id: "right_arm", name: "Правая Рука", hitChanceMod: -5, damageMod: 0.8, hp: 25, currentHp: 25, status: "normal" },
            { id: "left_leg", name: "Левая Нога", hitChanceMod: 0, damageMod: 0.7, hp: 30, currentHp: 30, status: "normal" },
            { id: "right_leg", name: "Правая Нога", hitChanceMod: 0, damageMod: 0.7, hp: 30, currentHp: 30, status: "normal" },
        ],
        lootTable: [
            { itemId: "pipe_pistol", chance: 0.3, quantity: 1, type: "weapons" },
            { itemId: "10mm_ammo_rounds", chance: 0.5, quantity: [3, 8], type: "misc" },
            { itemId: "stimpak", chance: 0.1, quantity: 1, type: "aid" },
            { itemId: "caps", chance: 0.7, quantity: [5, 20], type: "misc" }
        ]
    },
    "feral_ghoul": {
        name: "Дикий Гуль", hp: 80, maxHp: 80, ap: 7, maxAp: 7, damage: {min: 6, max: 12}, accuracyBonus: 5, xpValue: 40,
        parts: [
            { id: "head", name: "Голова", hitChanceMod: -10, damageMod: 1.8, hp: 25, currentHp: 25, status: "normal" },
            { id: "torso", name: "Торс", hitChanceMod: +5, damageMod: 1.0, hp: 50, currentHp: 50, status: "normal" },
            { id: "limbs", name: "Конечности", hitChanceMod: 0, damageMod: 0.9, hp: 35, currentHp: 35, status: "normal" }
        ],
        lootTable: [
            { itemId: "glowing_fungus", chance: 0.4, quantity: [1,2], type: "misc" },
            { itemId: "rad_x", chance: 0.1, quantity:1, type: "aid" }
        ]
    },
    "super_mutant_brute": {
        name: "Супермутант-Громила", hp: 150, maxHp: 150, ap: 4, maxAp: 4, damage: {min: 10, max: 20}, accuracyBonus: -5, xpValue: 75,
        parts: [
            { id: "head", name: "Голова", hitChanceMod: -25, damageMod: 2.5, hp: 40, currentHp: 40, status: "normal" },
            { id: "torso", name: "Торс", hitChanceMod: +15, damageMod: 1.0, hp: 100, currentHp: 100, status: "normal" },
            { id: "arms", name: "Руки", hitChanceMod: -10, damageMod: 0.8, hp: 60, currentHp: 60, status: "normal" },
            { id: "legs", name: "Ноги", hitChanceMod: -5, damageMod: 0.7, hp: 70, currentHp: 70, status: "normal" },
        ],
        lootTable: [
            { itemId: "hunting_rifle", chance: 0.2, quantity: 1, type: "weapons" },
            { itemId: "308_ammo_rounds", chance: 0.4, quantity: [5,10], type: "misc" },
            { itemId: "mutant_jerky", chance: 0.3, quantity:1, type: "aid"}
        ]
    }
};

const gameNpcData = {
    settler_store: {
        id: "joe_settler", name: "Джо", attitude: "neutral", dialogueKey: "joeTheSettler",
        questsGiven: [{id: "joe_fix_antenna", name:"Антенна для Джо", status:"not_started"}]
    },
    dogmeat_companion: {
        id: "dogmeat_npc", name: "Одинокая Собака", attitude: "neutral",
        canBeCompanion: true,
        companionDetails: {
            id: "dogmeat", name: "Псина", hp: 75, currentHp: 75, maxHp:75, attackDamage: {min:3, max:7},
            inventory: [], maxCarryWeight: 20, mood: "Нейтральное", isWaiting: false,
            onAttackFunctionName: "dogmeatAttackEffect",
            onSearchFunctionName: "dogmeatSearchEffect",
            commentsKey: "dogmeat"
        }
    }
};

const allItems = {
    // Weapons
    "pipe_pistol": { name: "Самопальный пистолет", damage: {min: 5, max:10}, apCost: 3, type: "ranged", weight: 3, category:"weapons" },
    "10mm_pistol": { name: "10мм Пистолет", damage: {min: 8, max:15}, apCost: 3, type: "ranged", weight: 2.5, category:"weapons" },
    "hunting_rifle": { name: "Охотничье ружье", damage: {min:12, max:20}, apCost: 5, type: "ranged", weight: 7, category:"weapons" },
    // Ammo (as misc)
    "10mm_ammo_rounds": { name: "10мм патроны", quantity:1, weight: 0.01, type:"ammo", category:"misc" },
    "308_ammo_rounds": { name: "Патроны .308", quantity:1, weight: 0.02, type:"ammo", category:"misc" },
    "shotgun_shells_ammo": { name: "Дробовые патроны", quantity:1, weight: 0.03, type:"ammo", category:"misc" },
    // Aid
    "stimpak": { name: "Стимулятор", description: "Восстанавливает 30% HP.", effectFunctionName: "useStimpakEffect", apCost: 2, weight: 0.1, category:"aid" },
    "radaway": { name: "Антирадин", description: "Снижает радиацию на 250.", effectFunctionName: "useRadawayEffect", weight: 0.1, category: "aid"},
    "purified_water": { name: "Очищенная вода", description: "Утоляет жажду.", effectFunctionName: "usePurifiedWaterEffect", weight: 0.5, category: "aid"},
    "water_dirty": { name: "Грязная вода", description: "Сильно утоляет жажду, но повышает радиацию.", effectFunctionName: "useDirtyWaterEffect", weight: 0.5, category: "aid"},
    "cram": { name: "Консервы 'Крэм'", description: "Утоляет голод.", effectFunctionName: "useCramEffect", weight: 0.3, category: "aid"},
    "rad_x": { name: "Рад-Х", description: "Временно повышает сопротивление радиации.", effectFunctionName: "useRadXEffect", weight: 0.1, category:"aid"},
    "mutant_jerky": { name: "Вяленое мясо мутанта", description: "Сомнительная еда. Немного утоляет голод, но добавляет радиации.", effectFunctionName:"useMutantJerkyEffect", weight:0.2, category:"aid"},
    // Misc
    "bobby_pin": { name: "Заколка", description: "Может пригодиться для взлома замков.", weight: 0.01, category:"misc" },
    "scrap_metal": { name: "Металлолом", description: "Для ремонта и крафта.", weight: 0.5, category:"misc" },
    "electronics_scrap": { name: "Электроника", description: "Для ремонта и крафта.", weight: 0.2, category:"misc" },
    "wood": { name: "Дерево", description: "Строительный материал.", weight: 0.8, category: "misc" },
    "fabric": { name: "Ткань", description: "Для одежды и кроватей.", weight: 0.1, category: "misc" },
    "leather": { name: "Кожа", description: "Для брони и ремней.", weight: 0.3, category: "misc" },
    "components_basic": { name: "Базовые компоненты", description: "Шестерни, пружины, болты и т.п.", weight: 0.1, category: "misc" },
    "fuel": { name: "Топливо", description: "Для генераторов и некоторых механизмов.", weight: 1.0, category: "misc" },
    "adhesive": { name: "Клей", description: "Важный компонент для многих модификаций.", weight: 0.1, category: "misc"},
    "oil": { name: "Масло", description: "Для смазки и некоторых механизмов.", weight: 0.2, category: "misc"},
    "spring": { name: "Пружина", description: "Компонент.", weight: 0.1, category: "misc"},
    "gear": { name: "Шестерня", description: "Компонент.", weight: 0.1, category: "misc"},
    "screw": { name: "Винт", description: "Компонент.", weight: 0.05, category: "misc"},
    "filter_unit": { name: "Фильтр", description: "Для очистки воды.", weight: 0.2, category: "misc"},
    "sensor_module": { name: "Сенсорный модуль", description: "Для турелей и электроники.", weight: 0.3, category: "misc"},
    "overseer_keycard": { name: "Ключ-карта Смотрителя", description: "Открывает некоторые двери в Убежище 76.", weight: 0.01, category: "misc", unique: true},
    "glowing_fungus": { name: "Светящийся гриб", description: "Слабо светится. Может использоваться в крафте.", weight: 0.1, category:"misc"},
    "caps": { name: "Крышки", quantity:1, weight:0, category:"misc" }
};

let gameTickCounter = 0;
const TICKS_PER_MINUTE_IRL = 2; // Сколько действий игрока ~= 15-30 мин игрового времени
const GAME_HOURS_PER_DAY = 24;
const TICKS_PER_GAME_HOUR = TICKS_PER_MINUTE_IRL * 2; // Примерно, если 1 тик = 30 мин, то 2 тика = 1 час
let currentGameHour = 8;
let currentGameMinute = 0;
let currentDay = 1;
const WEATHER_TYPES = ["Ясно", "Облачно", "Легкий дождь", "Сильный дождь", "Радиационная буря", "Пыльная буря"];
let currentWeather = "Ясно";
const WEATHER_CHANGE_CHANCE = 0.15;

// gamedata.js