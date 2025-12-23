/**
 * SlayWare - Web adaptation of Slay
 * Final Version: Rules.txt Sync (Movement, Timing, Visuals)
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const logContainer = document.getElementById('event-log');
const playerIndicator = document.getElementById('player-indicator');

// --- Constants & Config ---
const HEX_SIZE = 28;
const PLAYER_COLORS = {
    0: { border: '#444', fill: '#2d333b', name: 'Neutral', bg: '#2d333b' },
    1: { border: '#991b1b', fill: '#f87171', name: 'Red', bg: '#7f1d1d' },
    2: { border: '#1e40af', fill: '#60a5fa', name: 'Blue', bg: '#1e3a8a' },
    3: { border: '#166534', fill: '#4ade80', name: 'Green', bg: '#14532d' },
    4: { border: '#854d0e', fill: '#facc15', name: 'Yellow', bg: '#713f12' },
    5: { border: '#581c87', fill: '#c084fc', name: 'Purple', bg: '#581c87' },
    6: { border: '#7c2d12', fill: '#fb923c', name: 'Orange', bg: '#7c2d12' }
};

const UNIT_COSTS = { peasant: 10, spearman: 20, knight: 30, baron: 40, castle: 15 };
const WAGES = { peasant: 2, spearman: 6, knight: 18, baron: 54 };
const STRENGTHS = { peasant: 1, spearman: 2, knight: 3, baron: 4, castle: 2, capital: 1 };
const MERGE_MAP = {
    'peasant+peasant': 'spearman', 'peasant+spearman': 'knight', 'spearman+peasant': 'knight',
    'spearman+spearman': 'baron', 'peasant+knight': 'baron', 'knight+peasant': 'baron'
};

class Hex {
    constructor(q, r) { this.q = q; this.r = r; }
    get s() { return -this.q - this.r; }
    add(other) { return new Hex(this.q + other.q, this.r + other.r); }
    toString() { return `${this.q},${this.r}`; }
    static directions = [new Hex(1, 0), new Hex(1, -1), new Hex(0, -1), new Hex(-1, 0), new Hex(-1, 1), new Hex(0, 1)];
    toPixel() {
        return {
            x: HEX_SIZE * (3 / 2 * this.q),
            y: HEX_SIZE * (Math.sqrt(3) / 2 * this.q + Math.sqrt(3) * this.r)
        };
    }
    getNeighbors() { return Hex.directions.map(dir => this.add(dir)); }
}

class MapCell {
    constructor(hex, playerId = 0) {
        this.hex = hex; this.playerId = playerId;
        this.unit = null; this.building = null; this.tree = null;
        this.hasMoved = false; this.isGravestone = false;
        this.oldTerritoryId = null; this.territoryId = null;
    }
    getStrength() {
        if (this.unit) return STRENGTHS[this.unit];
        if (this.building === 'castle') return STRENGTHS.castle;
        if (this.building === 'capital') return STRENGTHS.capital;
        return 0;
    }
}

class Territory {
    constructor(id, playerId) { this.id = id; this.playerId = playerId; this.cells = []; this.money = 0; }
    getIncome() { return this.cells.filter(c => !c.tree && !c.isGravestone).length; }
    getWages() { return this.cells.reduce((sum, c) => sum + (c.unit ? WAGES[c.unit] : 0), 0); }
    getNet() { return this.getIncome() - this.getWages(); }
}

const state = {
    grid: new Map(), players: [], currentPlayerIdx: 0,
    camera: { x: 0, y: 0 }, territories: new Map(),
    selectedCell: null, activeTerritoryId: null, shopSelected: null,
    turn: 1, gameStarted: false, gameOver: false
};

// --- Initialization & Setup ---
function setup() {
    let humanCount = 1; let totalCount = 4;
    const countBtns = document.querySelectorAll('.count-btn');
    const totalBtns = document.querySelectorAll('.total-btn');
    countBtns.forEach(btn => btn.addEventListener('click', () => {
        countBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active'); humanCount = parseInt(btn.dataset.humans);
    }));
    totalBtns.forEach(btn => btn.addEventListener('click', () => {
        totalBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active'); totalCount = parseInt(btn.dataset.total);
    }));
    document.getElementById('start-game-btn').addEventListener('click', () => {
        if (humanCount > totalCount) { alert("Humans cannot exceed total players!"); return; }
        startGame(humanCount, totalCount);
    });
}

function startGame(humans, total) {
    state.players = [];
    for (let i = 1; i <= total; i++) state.players.push({ id: i, type: i <= humans ? 'human' : 'ai' });
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');

    // Initial Resize to set correct dimensions including DPI
    handleResize();

    generateIsland(total);
    refreshTerritories();
    centerCamera();
    setupGameEvents();
    initLeaderboard();

    state.gameStarted = true; startTurn(); render(); updateUI();
}

function initLeaderboard() {
    const container = document.getElementById('players-container');
    container.innerHTML = '';
    state.players.forEach(p => {
        const row = document.createElement('div');
        row.className = `player-row player-row-${p.id}`;
        row.id = `p-row-${p.id}`;

        const icon = document.createElement('div');
        icon.className = 'player-icon';
        icon.style.setProperty('--player-color', PLAYER_COLORS[p.id].fill);
        icon.style.setProperty('--player-bg', PLAYER_COLORS[p.id].bg);
        icon.innerHTML = p.type === 'human' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

        const barContainer = document.createElement('div');
        barContainer.className = 'wealth-bar-container';

        const bar = document.createElement('div');
        bar.className = 'wealth-bar';
        bar.id = `p-bar-${p.id}`;
        bar.style.setProperty('--player-color', PLAYER_COLORS[p.id].fill);

        barContainer.appendChild(bar);
        row.appendChild(icon);
        row.appendChild(barContainer);
        container.appendChild(row);
    });
}

function setupGameEvents() {
    window.addEventListener('resize', handleResize);
    document.getElementById('end-turn-btn').addEventListener('click', endTurn);
    canvas.addEventListener('mousedown', handleMouseDown);
    // ... rest of events
    canvas.addEventListener('mousedown', handleMouseDown);
    // ... rest of events
    const modal = document.getElementById('help-modal');
    const gameOverModal = document.getElementById('game-over-modal');
    document.getElementById('help-btn').addEventListener('click', () => modal.classList.remove('hidden'));
    document.querySelector('.close-modal').addEventListener('click', () => modal.classList.add('hidden'));
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    document.getElementById('restart-btn').addEventListener('click', restartGame);

    // Shop Button Logic
    document.querySelectorAll('.shop-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (state.players[state.currentPlayerIdx].type !== 'human') return;
            const unit = btn.dataset.unit;

            // Toggle logic
            if (state.shopSelected === unit) {
                resetShopSelection();
                logEvent("Action canceled.");
            } else {
                // Select new
                document.querySelectorAll('.shop-item').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                state.shopSelected = unit;
                state.selectedCell = null;

                // Update Cursor Follower
                const cursorFollower = document.getElementById('cursor-follower');
                cursorFollower.style.display = 'block';
                // Map unit to icon
                const icons = { peasant: '👨', spearman: '🛡️', knight: '🏇', baron: '👑', castle: '🏰' };
                cursorFollower.textContent = icons[unit] || '❓';
                // Initial position
                cursorFollower.style.left = `${e.clientX}px`;
                cursorFollower.style.top = `${e.clientY}px`;

                logEvent(`Selected ${state.shopSelected}. Click your territory to place.`);
            }
        });
    });
}

function resetShopSelection() {
    state.shopSelected = null;
    document.querySelectorAll('.shop-item').forEach(b => b.classList.remove('selected'));
    document.getElementById('cursor-follower').style.display = 'none';
}

function handleResize() {
    const parent = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    // Set actual size in memory (scaled to account for extra pixel density)
    canvas.width = parent.offsetWidth * dpr;
    canvas.height = parent.offsetHeight * dpr;

    // Normalize coordinate system to use css pixels
    ctx.scale(dpr, dpr);

    // Maintain CSS size
    canvas.style.width = `${parent.offsetWidth}px`;
    canvas.style.height = `${parent.offsetHeight}px`;

    centerCamera();
    render();
}

function generateIsland(totalPlayers) {
    const size = 7;
    const allHexes = [];
    for (let q = -size; q <= size; q++) {
        for (let r = -size; r <= size; r++) {
            if (Math.abs(q + r) <= size) allHexes.push(new Hex(q, r));
        }
    }

    // 1. Calculate fair quotas
    const totalCells = allHexes.length;
    const tilesPerPlayer = Math.floor(totalCells / totalPlayers);
    const treesPerPlayer = Math.floor(tilesPerPlayer * 0.2); // 20% trees
    const remainder = totalCells % totalPlayers;

    // 2. Create a "Deck" of fairness
    let deck = [];
    for (let p = 1; p <= totalPlayers; p++) {
        for (let i = 0; i < tilesPerPlayer; i++) {
            deck.push({ playerId: p, tree: i < treesPerPlayer ? 'pine' : null });
        }
    }

    // 3. Handle remainders
    for (let i = 0; i < remainder; i++) {
        const p = (i % totalPlayers) + 1;
        deck.push({ playerId: p, tree: null });
    }

    // 4. Shuffle hexes
    for (let i = allHexes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allHexes[i], allHexes[j]] = [allHexes[j], allHexes[i]];
    }

    // 5. Assign
    allHexes.forEach((hex, index) => {
        if (index < deck.length) {
            const info = deck[index];
            const cell = new MapCell(hex, info.playerId);
            cell.tree = info.tree;
            state.grid.set(hex.toString(), cell);
        }
    });
}

// --- Territory Logic ---
function refreshTerritories() {
    // 1. Snapshot Old State
    const oldTerritoryStats = new Map();
    state.territories.forEach(t => oldTerritoryStats.set(t.id, { money: t.money, playerId: t.playerId, size: t.cells.length }));

    const cellOldTerritory = new Map();
    state.grid.forEach(c => {
        if (c.territoryId) cellOldTerritory.set(c.hex.toString(), c.territoryId);
    });

    // 2. Generate New Territories
    const visited = new Set();
    const newTerritories = new Map();
    let nextId = 1;

    state.grid.forEach(cell => {
        if (cell.playerId !== 0 && !visited.has(cell.hex.toString())) {
            const territory = new Territory(nextId++, cell.playerId);
            const queue = [cell];
            visited.add(cell.hex.toString());

            while (queue.length > 0) {
                const current = queue.shift();
                current.territoryId = territory.id;
                territory.cells.push(current);

                current.hex.getNeighbors().forEach(nHex => {
                    const neighbor = state.grid.get(nHex.toString());
                    if (neighbor && neighbor.playerId === cell.playerId && !visited.has(nHex.toString())) {
                        visited.add(nHex.toString());
                        queue.push(neighbor);
                    }
                });
            }
            newTerritories.set(territory.id, territory);
        }
    });

    // 3. Distribute Money
    const oldToNewMap = new Map();
    newTerritories.forEach(nt => {
        nt.cells.forEach(cell => {
            const oldId = cellOldTerritory.get(cell.hex.toString());
            if (oldId) {
                const oldStats = oldTerritoryStats.get(oldId);
                // Only inherit if player matches
                if (oldStats && oldStats.playerId === nt.playerId) {
                    if (!oldToNewMap.has(oldId)) oldToNewMap.set(oldId, new Set());
                    oldToNewMap.get(oldId).add(nt.id);
                }
            }
        });
    });

    // Reset money for accumulation
    newTerritories.forEach(nt => nt.money = 0);
    const moneySources = new Map(); // Track if a NT received money to determine "New Land" bonus

    oldToNewMap.forEach((newIds, oldId) => {
        const oldData = oldTerritoryStats.get(oldId);
        // Only consider targets that are large enough to have a capital (>= 2 cells)
        const targets = Array.from(newIds)
            .map(nid => newTerritories.get(nid))
            .filter(t => t.cells.length >= 2);

        if (targets.length > 0) {
            // Calculate total size of valid successors
            const totalSize = targets.reduce((sum, t) => sum + t.cells.length, 0);

            targets.forEach(t => {
                const share = Math.floor(oldData.money * (t.cells.length / totalSize));
                t.money += share;
                moneySources.set(t.id, true);
            });
        }
    });

    // 4. Handle Capitals & Finalize
    newTerritories.forEach(nt => {
        // If "Brand New" (e.g. formed from neutral), give starter cash
        if (!moneySources.has(nt.id) && nt.cells.length >= 2) nt.money = 10;
        // Single tile territories cannot hold money
        if (nt.cells.length < 2) nt.money = 0;

        // Resolve Capitals
        const capitalCells = nt.cells.filter(c => c.building === 'capital');

        if (capitalCells.length > 1) {
            // Merge scenario: Keep capital from largest OLD territory
            let winner = capitalCells[0];
            let maxSize = -1;

            capitalCells.forEach(c => {
                const oldId = cellOldTerritory.get(c.hex.toString());
                const oldSize = (oldId && oldTerritoryStats.get(oldId)) ? oldTerritoryStats.get(oldId).size : 0;
                if (oldSize > maxSize) {
                    maxSize = oldSize;
                    winner = c;
                }
            });
            // Remove losers
            capitalCells.forEach(c => { if (c !== winner) c.building = null; });
        }

        const hasExistingCapital = nt.cells.some(c => c.building === 'capital');

        if (!hasExistingCapital && nt.cells.length >= 2) {
            // Spawn new capital
            // Score candidates to find optimal capital spot
            // 0: Empty (Best)
            // 1: Tree or Gravestone
            // 2: Castle (Expensive loss)
            // 3: Unit (Sacrifice)

            let bestSpot = nt.cells[0];
            let bestScore = 99;

            for (const cell of nt.cells) {
                let score = 3;
                if (cell.unit) score = 3;
                else if (cell.building === 'castle') score = 2;
                else if (cell.tree || cell.isGravestone) score = 1;
                else score = 0; // Ideally empty

                if (score < bestScore) {
                    bestScore = score;
                    bestSpot = cell;
                    if (bestScore === 0) break; // Found perfect spot
                }
            }

            // Enforce clearing of the chosen spot
            // "Replace that entity" -> We destroy whatever was there.
            if (bestSpot.unit) logEvent(`Capital replaced a ${bestSpot.unit}!`, "system");

            bestSpot.unit = null;
            bestSpot.tree = null;
            bestSpot.building = 'capital';
            bestSpot.isGravestone = false;

            // Clear any other capitals just in case
            nt.cells.forEach(c => { if (c !== bestSpot && c.building === 'capital') c.building = null; });
        } else if (nt.cells.length < 2) {
            // Remove capital if shrank too small and replace with tree
            nt.cells.forEach(c => {
                if (c.building === 'capital') {
                    c.building = null;
                    c.tree = 'pine';
                }
            });
        }
    });

    state.territories = newTerritories;
}

// --- Interaction Logic ---
function handleMouseDown(e) {
    if (state.gameOver || state.players[state.currentPlayerIdx].type !== 'human') return;
    const rect = canvas.getBoundingClientRect();
    const hex = pixelToHex(e.clientX - rect.left, e.clientY - rect.top);
    const cell = state.grid.get(hex.toString());
    if (!cell) return;

    const pIdx = state.players[state.currentPlayerIdx].id;

    if (state.shopSelected && state.activeTerritoryId) {
        const t = state.territories.get(state.activeTerritoryId);
        if (!t || t.playerId !== pIdx) {
            logEvent("Select one of your territories first!", "system");
            resetShopSelection(); return;
        }
        const hasCapital = t.cells.some(c => c.building === 'capital');
        if (!hasCapital) {
            logEvent("This territory is too small (no capital).", "system");
            resetShopSelection(); return;
        }
        if (t.money < UNIT_COSTS[state.shopSelected]) {
            logEvent(`Not enough money (${UNIT_COSTS[state.shopSelected]}c needed).`, "system");
            resetShopSelection(); return;
        }

        const isInternal = cell.territoryId === t.id;
        const isAdjacent = !isInternal && t.cells.some(ownCell => Hex.directions.some(d => ownCell.hex.add(d).toString() === cell.hex.toString()));

        const unitType = state.shopSelected;
        if (unitType !== 'castle') { // Buying a Unit (Peasant, Spear, Knight, Baron)
            const cost = UNIT_COSTS[unitType];
            if (isInternal) {
                if (cell.unit) {
                    // Merging Logic (Active Unit + Existing Unit)
                    // Note: Order in MERGE_MAP keys matters if not symmetric.
                    // We check both orderings or assume symmetric keys exist.
                    // Existing keys are: 'peasant+peasant', 'peasant+spearman', 'spearman+peasant', etc.

                    let combo = `${unitType}+${cell.unit}`;
                    // Try reverse if not found? MERGE_MAP seems to cover permutations for relevant ones.

                    if (MERGE_MAP[combo]) {
                        cell.unit = MERGE_MAP[combo];
                        // Do NOT set hasMoved = true. Upgraded unit keeps its turn.
                        const oldBal = t.money;
                        t.money -= cost; resetShopSelection();
                        logEvent(`Upgraded to ${cell.unit}: ${oldBal} - ${cost} = ${t.money}`, "system");
                    } else {
                        logEvent(`Cannot merge ${unitType} with ${cell.unit}.`, "system");
                    }
                } else if (!cell.building) {
                    if (cell.tree) { cell.tree = null; cell.hasMoved = true; logEvent("Tree chopped!", "system"); }
                    const oldBal = t.money;
                    cell.unit = unitType; t.money -= cost; resetShopSelection();
                    logEvent(`${unitType} bought: ${oldBal} - ${cost} = ${t.money} remaining`, "system");
                } else {
                    logEvent("Cannot place unit on a building.", "system");
                }
            } else if (isAdjacent && cell.playerId !== pIdx) {
                if (checkAttack(STRENGTHS[unitType], cell)) {
                    const oldBal = t.money;
                    t.money -= cost; // Deduct BEFORE capture
                    captureTile(cell, pIdx, unitType);
                    resetShopSelection();
                    logEvent(`${unitType} captured tile: ${oldBal} - ${cost} = ${t.money} remaining`, "system");
                } else {
                    logEvent(`Enemy defense too strong for a ${unitType}.`, "system");
                }
            } else if (!isInternal && !isAdjacent) {
                logEvent("Can only place units inside territory or on adjacent enemies.", "system");
            }
        } else if (state.shopSelected === 'castle') {
            if (isInternal) {
                if (!cell.unit && !cell.building && !cell.tree) {
                    const oldBal = t.money;
                    cell.building = 'castle'; t.money -= 15; resetShopSelection();
                    logEvent(`Castle built: ${oldBal} - 15 = ${t.money} remaining`, "system");
                } else {
                    logEvent("Tile must be empty to build a Castle.", "system");
                }
            } else {
                // Invalid move (too far, etc)
                logEvent("Invalid move.", "system");
            }
        }
    } else if (state.selectedCell) {
        // Selected a different cell (switch selection or deselect)
        // Ensure cursor is hidden from previous selection
        const cursorFollower = document.getElementById('cursor-follower');
        if (cursorFollower) cursorFollower.style.display = 'none';

        if (canMoveUnit(state.selectedCell, cell)) {
            executeMove(state.selectedCell, cell);
            state.selectedCell = null;
            const cursorFollower = document.getElementById('cursor-follower');
            if (cursorFollower) cursorFollower.style.display = 'none';
        } else {
            // Explain why movement failed
            // Explain why movement failed
            const t = state.territories.get(state.selectedCell.territoryId);
            const isAdj = t && t.cells.some(c => {
                const dist = Math.max(Math.abs(c.hex.q - cell.hex.q), Math.abs(c.hex.r - cell.hex.r), Math.abs(c.hex.s - cell.hex.s));
                return dist === 1;
            });

            if (state.selectedCell.territoryId !== cell.territoryId && !isAdj) {
                logEvent("Target is too far away!", "system");
            } else if (state.selectedCell.playerId !== cell.playerId && !checkAttack(STRENGTHS[state.selectedCell.unit], cell)) {
                logEvent("Enemy too strong!", "system");
            } else if (state.selectedCell.playerId === cell.playerId && cell.unit && !MERGE_MAP[`${state.selectedCell.unit}+${cell.unit}`]) {
                logEvent(`Cannot merge ${state.selectedCell.unit} with ${cell.unit}.`, "system");
            } else if (cell.building && cell.territoryId === state.selectedCell.territoryId) {
                logEvent("Cannot move onto infrastructure!", "system");
            } else {
                logEvent("Invalid move.", "system");
            }

            state.selectedCell = null; // Clear selection
            const cursorFollower = document.getElementById('cursor-follower');
            if (cursorFollower) cursorFollower.style.display = 'none';
        }
    } else {
        if (cell.unit && cell.playerId === pIdx && !cell.hasMoved) {
            state.selectedCell = cell; state.shopSelected = null;
            logEvent(`${cell.unit} selected. Click adjacent tile to move/attack.`);

            // Show cursor follower for drag
            const cursorFollower = document.getElementById('cursor-follower');
            if (cursorFollower) {
                cursorFollower.style.display = 'block';
                const icons = { peasant: '👨', spearman: '🛡️', knight: '🏇', baron: '👑' };
                cursorFollower.textContent = icons[cell.unit] || '❓';
                // Snap to mouse immediately if possible, or wait for move
                cursorFollower.style.left = `${e.clientX}px`;
                cursorFollower.style.top = `${e.clientY}px`;
            }
        } else {
            if (state.selectedCell) {
                // Deselecting
                const cursorFollower = document.getElementById('cursor-follower');
                if (cursorFollower) cursorFollower.style.display = 'none';
            }
            state.selectedCell = null; state.shopSelected = null;
        }
    }
    state.activeTerritoryId = cell.territoryId; updateUI();
}

function checkAttack(strength, to) {
    let defense = to.getStrength();
    to.hex.getNeighbors().forEach(h => {
        const n = state.grid.get(h.toString());
        if (n && n.playerId === to.playerId && n.territoryId === to.territoryId) defense = Math.max(defense, n.getStrength());
    });
    return strength > defense;
}

function captureTile(cell, newPlayerId, unit = null) {
    if (cell.building === 'capital') {
        logEvent(`Capital captured! Treasury lost.`, "system");
        const t = state.territories.get(cell.territoryId);
        if (t) t.money = 0;
    }
    cell.playerId = newPlayerId; cell.unit = unit; cell.building = null; cell.tree = null; cell.hasMoved = true; cell.isGravestone = false;
    refreshTerritories(); checkWin();
}

function canMoveUnit(from, to) {
    if (from === to) return false;

    // Internal movement: Any distance within same territory
    if (from.territoryId === to.territoryId) {
        if (to.building) return false; // Cannot move onto own buildings (Capital/Castle)
        return true;
    }

    // External movement/Attack:
    // Allowed if 'to' is adjacent to ANY cell in 'from's territory.
    const t = state.territories.get(from.territoryId);
    if (!t) return false;

    const isAdjacentToTerritory = t.cells.some(c => {
        const dist = Math.max(Math.abs(c.hex.q - to.hex.q), Math.abs(c.hex.r - to.hex.r), Math.abs(c.hex.s - to.hex.s));
        return dist === 1;
    });

    if (!isAdjacentToTerritory) return false;

    if (from.playerId !== to.playerId) return checkAttack(STRENGTHS[from.unit], to);
    return true; // Adjacent friendly blob
}

function executeMove(from, to) {
    const isInternal = from.territoryId === to.territoryId;
    if (isInternal) {
        if (to.unit) {
            const combo = `${from.unit}+${to.unit}`;
            // Merge: Do NOT consume 'to' unit's action
            if (MERGE_MAP[combo]) { to.unit = MERGE_MAP[combo]; from.unit = null; }
        } else if (to.tree) { to.tree = null; to.unit = from.unit; from.unit = null; to.hasMoved = true; }
        else { to.unit = from.unit; from.unit = null; } // Moving to empty space internal
    } else {
        if (from.playerId === to.playerId) { // Merge blobs
            if (to.unit) {
                const combo = `${from.unit}+${to.unit}`;
                // Merge external: Do NOT consume 'to' unit's action
                if (MERGE_MAP[combo]) { to.unit = MERGE_MAP[combo]; from.unit = null; }
            } else { to.unit = from.unit; from.unit = null; to.hasMoved = true; }
        } else { // Attack
            captureTile(to, from.playerId, from.unit); from.unit = null;
        }
    }
    refreshTerritories(); updateUI();
}

// --- Turn Management ---
function startTurn() {
    const p = state.players[state.currentPlayerIdx];
    // 1. Nature Growth & Gravestones
    state.grid.forEach(c => {
        if (c.playerId === p.id) {
            c.hasMoved = false;
            if (c.isGravestone) { c.isGravestone = false; c.tree = 'pine'; }
            if (!c.unit && !c.building && !c.tree && !c.isGravestone) {
                const ns = c.hex.getNeighbors().map(h => state.grid.get(h.toString())).filter(n => n);
                const pines = ns.filter(n => n.tree === 'pine').length;
                const palms = ns.filter(n => n.tree === 'palm').length;
                const isCoast = ns.length < 6;
                if (pines >= 2 && Math.random() < 0.2) c.tree = 'pine';
                else if (isCoast && palms >= 1 && Math.random() < 0.2) c.tree = 'palm';
                else if (Math.random() < 0.01) c.tree = 'pine';
            }
        }
    });

    // 2. Economy
    state.territories.forEach(t => {
        if (t.playerId === p.id) {
            const hasCap = t.cells.some(c => c.building === 'capital');
            if (hasCap) {
                t.money += t.getNet();
                if (t.money < 0) {
                    t.cells.forEach(c => { if (c.unit) { c.unit = null; c.isGravestone = true; } });
                    t.money = 0; logEvent(`${PLAYER_COLORS[p.id].name} bankrupt!`, "system");
                }
            } else t.money = 0;
        }
    });
    updateUI();
    if (p.type === 'ai') setTimeout(runAITurn, 600);
}


function hasAvailableActions(playerId) {
    // 1. Check for unmoved units
    const hasUnmovedUnits = Array.from(state.grid.values()).some(c => c.playerId === playerId && c.unit && !c.hasMoved);
    if (hasUnmovedUnits) return true;

    // 2. Check for ability to buy units (Capital exists + Money >= 10)
    // We check purely for capacity to spend, not board space (as space is almost always available if you have land)
    const hasMoneyToSpend = Array.from(state.territories.values())
        .filter(t => t.playerId === playerId)
        .some(t => t.cells.some(c => c.building === 'capital') && t.money >= 10);

    return hasMoneyToSpend;
}

function endTurn() {
    const pId = state.players[state.currentPlayerIdx].id;
    if (state.players[state.currentPlayerIdx].type === 'human') {
        if (hasAvailableActions(pId)) {
            if (!confirm("You still have actions available (Units to move or Money to spend).\nAre you sure you want to end your turn?")) return;
        }
    }

    state.currentPlayerIdx = (state.currentPlayerIdx + 1) % state.players.length;
    state.turn++; state.selectedCell = null; state.shopSelected = null;
    startTurn();
}

function checkWin() {
    const playersAlive = new Set();
    state.grid.forEach(c => { if (c.playerId !== 0) playersAlive.add(c.playerId); });
    if (playersAlive.size === 1) {
        state.gameOver = true;
        const winnerId = Array.from(playersAlive)[0];
        const winner = PLAYER_COLORS[winnerId].name;
        logEvent(`${winner} has conquered the island!`, "system");
        showGameOver(winnerId, winner);
    }
}

function showGameOver(winnerId, winnerName) {
    const modal = document.getElementById('game-over-modal');
    const announce = document.getElementById('winner-announce');
    const stats = document.getElementById('game-over-stats');

    modal.classList.remove('hidden');
    announce.textContent = `${winnerName} Wins!`;
    announce.style.color = PLAYER_COLORS[winnerId].fill;

    // Calculate Stats
    let totalLand = 0; state.grid.forEach(c => { if (c.playerId === winnerId) totalLand++; });

    stats.innerHTML = `
        <div class="stat-item">
            <span class="label">Total Turns</span>
            <span class="value">${state.turn}</span>
        </div>
        <div class="stat-item">
            <span class="label">Territory</span>
            <span class="value">${totalLand} Tiles</span>
        </div>
    `;
}

function restartGame() {
    document.getElementById('game-over-modal').classList.add('hidden');
    document.getElementById('game-ui').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
    state.gameStarted = false;
    state.gameOver = false;
    state.turn = 1;
    state.grid = new Map();
    state.players = [];
    state.territories = new Map();
    logContainer.innerHTML = '';
}

// --- AI Logic ---
function runAITurn() {
    const pId = state.players[state.currentPlayerIdx].id;
    const ts = Array.from(state.territories.values()).filter(t => t.playerId === pId);
    ts.forEach(t => {
        const hasCap = t.cells.some(c => c.building === 'capital');
        while (hasCap && t.money >= 10) {
            const spot = t.cells.find(c => !c.unit && !c.building && !c.tree);
            if (!spot) break; spot.unit = 'peasant'; t.money -= 10;
        }
        t.cells.filter(c => c.unit && !c.hasMoved).forEach(cell => {
            const ns = cell.hex.getNeighbors().map(h => state.grid.get(h.toString())).filter(n => n);
            const targets = ns.filter(n => n.playerId !== pId && checkAttack(STRENGTHS[cell.unit], n));
            if (targets.length > 0) executeMove(cell, targets[0]);
            else {
                const own = ns.filter(n => n.playerId === pId);
                if (own.length > 0) executeMove(cell, own[Math.floor(Math.random() * own.length)]);
            }
        });
    });
    setTimeout(endTurn, 500);
}

// --- Rendering & UI ---
function updateUI() {
    const p = state.players[state.currentPlayerIdx];
    // Update active territory stats if selected, else current player's aggregate or first territory
    const t = state.territories.get(state.activeTerritoryId) || Array.from(state.territories.values()).find(t => t.playerId === p.id);
    if (t) {
        document.getElementById('stat-land').textContent = t.cells.length;
        document.getElementById('stat-income').textContent = `+${t.getIncome()}`;
        document.getElementById('stat-wages').textContent = `-${t.getWages()}`;
        document.getElementById('stat-balance').textContent = t.money;

        // Dim shop buttons based on balance AND ownership
        document.querySelectorAll('.shop-item').forEach(btn => {
            const cost = UNIT_COSTS[btn.dataset.unit];
            // Disable if: 
            // 1. Not your territory (inspecting enemy)
            // 2. Not enough money
            if (t.playerId !== p.id || t.money < cost) {
                btn.classList.add('disabled');
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.classList.remove('disabled');
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        });
    } else {
        // Reset shop if no territory active
        document.querySelectorAll('.shop-item').forEach(btn => {
            btn.classList.remove('disabled'); btn.style.opacity = '1'; btn.style.cursor = 'pointer';
        });
    }

    // End Turn Suggestion using helper
    const btn = document.getElementById('end-turn-btn');
    if (state.players[state.currentPlayerIdx].type === 'human') {
        const hasActions = hasAvailableActions(p.id);
        if (!hasActions) btn.classList.add('suggest-end-turn');
        else btn.classList.remove('suggest-end-turn');
    } else {
        btn.classList.remove('suggest-end-turn');
    }

    updateLeaderboard();
}

function updateLeaderboard() {
    // 1. Calculate Total Land (Tiles) per Player
    const landMap = new Map();
    state.players.forEach(p => landMap.set(p.id, 0));

    state.grid.forEach(c => {
        if (c.playerId !== 0 && landMap.has(c.playerId)) {
            const current = landMap.get(c.playerId);
            landMap.set(c.playerId, current + 1);
        }
    });

    // 2. Find Max Land
    let maxLand = 0;
    for (const count of landMap.values()) {
        if (count > maxLand) maxLand = count;
    }
    const divisor = maxLand > 0 ? maxLand : 1;

    // 3. Update Bars
    state.players.forEach(p => {
        const row = document.getElementById(`p-row-${p.id}`);
        const bar = document.getElementById(`p-bar-${p.id}`);
        if (row && bar) {
            // Outline active turn
            if (p.id === state.players[state.currentPlayerIdx].id) row.classList.add('active-turn');
            else row.classList.remove('active-turn');

            // Update bar width
            const count = landMap.get(p.id);
            const pct = (count / divisor) * 100;
            bar.style.width = `${pct}%`;
        }
    });
}

function logEvent(msg, type = '') {
    const e = document.createElement('p'); e.className = `log-entry ${type}`;
    e.textContent = msg; logContainer.prepend(e);
}

function drawHex(ctx, x, y, size, cell) {
    const color = PLAYER_COLORS[cell.playerId];
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(x + size * Math.cos(a), y + size * Math.sin(a)); }
    ctx.closePath();
    ctx.fillStyle = (state.selectedCell === cell) ? '#fff' : (state.activeTerritoryId === cell.territoryId && cell.playerId !== 0) ? color.fill : color.bg;
    ctx.fill(); ctx.strokeStyle = color.fill; ctx.stroke();
    if (cell.building === 'capital') {
        drawIcon(ctx, x, y, '🏠');
        const t = state.territories.get(cell.territoryId);
        const isCurrentPlayer = cell.playerId === state.players[state.currentPlayerIdx].id;
        if (isCurrentPlayer && t && t.money >= 10 && Math.sin(Date.now() / 200) > 0) drawPulse(ctx, x, y);
    }
    if (cell.building === 'castle') drawIcon(ctx, x, y, '🏰');
    if (cell.unit) {
        drawIcon(ctx, x, y, { peasant: '👨', spearman: '🛡️', knight: '🏇', baron: '👑' }[cell.unit]);
        const isCurrentPlayer = cell.playerId === state.players[state.currentPlayerIdx].id;
        if (cell.hasMoved) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill(); }
        else if (isCurrentPlayer && Math.sin(Date.now() / 200) > 0) drawPulse(ctx, x, y);
    }
    if (cell.tree) drawIcon(ctx, x, y, cell.tree === 'pine' ? '🌲' : '🌴');
    if (cell.isGravestone) drawIcon(ctx, x, y, '🪦');
}

function drawIcon(ctx, x, y, emoji) { ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(emoji, x, y); }
function drawPulse(ctx, x, y) { ctx.fillStyle = 'rgba(255, 0, 0, 0.6)'; ctx.beginPath(); ctx.arc(x, y + 10, 4, 0, Math.PI * 2); ctx.fill(); }

function pixelToHex(x, y) {
    const q = (2 / 3 * (x - state.camera.x)) / HEX_SIZE;
    const r = (-1 / 3 * (x - state.camera.x) + Math.sqrt(3) / 3 * (y - state.camera.y)) / HEX_SIZE;
    let rx = Math.round(q), rz = Math.round(r), ry = Math.round(-q - r);
    if (Math.abs(rx - q) > Math.abs(ry - (-q - r)) && Math.abs(rx - q) > Math.abs(rz - r)) rx = -ry - rz;
    else if (Math.abs(ry - (-q - r)) > Math.abs(rz - r)) ry = -rx - rz;
    else rz = -rx - ry;
    return new Hex(rx, rz);
}

function centerCamera() {
    state.camera.x = canvas.parentElement.offsetWidth / 2;
    state.camera.y = canvas.parentElement.offsetHeight / 2;
}
function render() {
    if (!state.gameStarted) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.translate(state.camera.x, state.camera.y);
    state.grid.forEach(cell => { const pos = cell.hex.toPixel(); drawHex(ctx, pos.x, pos.y, HEX_SIZE - 1, cell); });
    ctx.restore(); requestAnimationFrame(render);
}

setup();

// Global Cursor Follower Logic
// Global Cursor Follower Logic
window.addEventListener('mousemove', (e) => {
    const cursorFollower = document.getElementById('cursor-follower');
    if (cursorFollower) {
        // Condition 1: Shop Item Selected
        if (state.shopSelected) {
            cursorFollower.style.left = `${e.clientX}px`;
            cursorFollower.style.top = `${e.clientY}px`;
        }
        // Condition 2: Board Unit Selected (Drag)
        else if (state.selectedCell && state.selectedCell.unit) {
            cursorFollower.style.left = `${e.clientX}px`;
            cursorFollower.style.top = `${e.clientY}px`;
        }
    }
});
