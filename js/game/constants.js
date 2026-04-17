// ─── Dimensions ──────────────────────────────────────────────────────────────
export const GAME_WIDTH   = 1280;
export const GAME_HEIGHT  = 720;
export const PANEL_WIDTH  = 320;             // right-side UI panel
export const HUD_HEIGHT   = 60;             // top HUD bar
export const FIELD_WIDTH  = GAME_WIDTH - PANEL_WIDTH;   // 960
export const FIELD_HEIGHT = GAME_HEIGHT - HUD_HEIGHT;   // 660

// ─── Grid ────────────────────────────────────────────────────────────────────
export const CELL_SIZE  = 80;
export const GRID_COLS  = FIELD_WIDTH  / CELL_SIZE;          // 12
export const GRID_ROWS  = Math.floor(FIELD_HEIGHT / CELL_SIZE); // 8

/** World pixel centre of a grid cell */
export function cellCenter(col, row) {
  return {
    x: col * CELL_SIZE + CELL_SIZE / 2,
    y: HUD_HEIGHT + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

// ─── Enemy Path ───────────────────────────────────────────────────────────────
// Z-shaped path through the grid (col, row pairs)
export const PATH_CELLS = [
  [0,3],[1,3],[2,3],[3,3],
  [3,2],[3,1],
  [4,1],[5,1],[6,1],
  [6,2],[6,3],[6,4],[6,5],
  [7,5],[8,5],[9,5],
  [9,4],[9,3],
  [10,3],[11,3],
];
export const PATH_CELL_SET = new Set(PATH_CELLS.map(([c, r]) => `${c},${r}`));

/** World-space waypoints that enemies follow (one per path-turn) */
export const PATH_WAYPOINTS = [
  { x: -50,  y: 340 },   // off-screen spawn
  { x:  40,  y: 340 },   // col 0, row 3
  { x: 280,  y: 340 },   // col 3, row 3
  { x: 280,  y: 180 },   // col 3, row 1
  { x: 520,  y: 180 },   // col 6, row 1
  { x: 520,  y: 500 },   // col 6, row 5
  { x: 760,  y: 500 },   // col 9, row 5
  { x: 760,  y: 340 },   // col 9, row 3
  { x: 1020, y: 340 },   // past barrier – triggers hit
];

export const BARRIER_X = FIELD_WIDTH; // 960

// ─── Heroes ───────────────────────────────────────────────────────────────────
export const HEROES = {
  borislava: {
    key: 'borislava',
    name: 'Borislava',
    title: 'Priestess of the Undying Flame',
    description:
      'Faith healer and protector. Barrier regenerates faster under her watch.\n' +
      'Her Sacred Pulse stuns all enemies and heals the Mausoleum.',
    color: 0x9966ff,
    textColor: '#cc88ff',
    barrierHPBonus:    50,
    barrierRegenBonus:  2,
    artifactCostMult:  1.0,
    ecstasyMax:        100,
    ultimateName: 'Sacred Pulse',
    ultimateDesc: 'Stuns all enemies for 2 s and heals barrier +30 HP',
  },
  nazar: {
    key: 'nazar',
    name: 'Nazar',
    title: 'Void Seer',
    description:
      'Master of arcane geometries. All artifacts cost 20 % less.\n' +
      'His Void Storm damages and slows every enemy on the field.',
    color: 0x00ccff,
    textColor: '#44ddff',
    barrierHPBonus:    0,
    barrierRegenBonus: 0,
    artifactCostMult:  0.8,
    ecstasyMax:        120,
    ultimateName: 'Void Storm',
    ultimateDesc: 'Deals 60 damage to all enemies and slows them for 3 s',
  },
  mar_ta: {
    key: 'mar_ta',
    name: 'Mar-ta',
    title: 'Iron Guardian',
    description:
      'Warrior of steel. Starts with +100 barrier HP.\n' +
      'Her Iron Rage crushes every enemy on screen for massive damage.',
    color: 0xff6633,
    textColor: '#ff8855',
    barrierHPBonus:    100,
    barrierRegenBonus:  0,
    artifactCostMult:  1.0,
    ecstasyMax:         80,
    ultimateName: 'Iron Rage',
    ultimateDesc: 'Deals 100 damage to ALL enemies currently on screen',
  },
};

// ─── Artifacts ───────────────────────────────────────────────────────────────
export const ARTIFACTS = [
  {
    id:          'faith_totem',
    name:        'Faith Totem',
    cost:         50,
    damage:       15,
    range:       160,
    fireRate:   1200,   // ms
    color:    0xaa55ff,
    description: 'Fires at nearest enemy. Reliable and affordable.',
    slow:          0,
    slowDuration:  0,
    healBarrier:   0,
  },
  {
    id:          'dark_sigil',
    name:        'Dark Sigil',
    cost:        100,
    damage:       40,
    range:       200,
    fireRate:   2500,
    color:    0x440066,
    description: 'High damage, slow fire rate. Great vs. bosses.',
    slow:          0,
    slowDuration:  0,
    healBarrier:   0,
  },
  {
    id:          'void_crystal',
    name:        'Void Crystal',
    cost:         80,
    damage:       12,
    range:       180,
    fireRate:   1500,
    color:    0x006688,
    description: 'Slows hit enemies by 50 % for 2 seconds.',
    slow:        0.5,
    slowDuration: 2000,
    healBarrier:   0,
  },
  {
    id:          'healing_rune',
    name:        'Healing Rune',
    cost:        120,
    damage:        8,
    range:       130,
    fireRate:   2000,
    color:    0xddaa00,
    description: 'Deals damage and repairs barrier +5 HP per hit.',
    slow:          0,
    slowDuration:  0,
    healBarrier:   5,
  },
];

export const ARTIFACT_BY_ID = Object.fromEntries(ARTIFACTS.map(a => [a.id, a]));

// ─── Enemy Types ──────────────────────────────────────────────────────────────
export const ENEMY_TYPES = {
  creature: {
    id: 'creature', label: 'Void Creature',
    hp: 60, speed: 80, damage: 10, reward: 10, ecstasyReward: 5,
    scale: 1.0, tint: 0xcc2200, sprite: 'enemy_creature',
  },
  fast: {
    id: 'fast', label: 'Shadow Wraith',
    hp: 30, speed: 160, damage: 5, reward: 8, ecstasyReward: 3,
    scale: 0.75, tint: 0xff6600, sprite: 'enemy_creature',
  },
  boss: {
    id: 'boss', label: 'Boss Crawler',
    hp: 400, speed: 45, damage: 40, reward: 60, ecstasyReward: 35,
    scale: 1.8, tint: 0x990000, sprite: 'enemy_boss_crawler',
  },
};

// ─── Wave Definitions ─────────────────────────────────────────────────────────
// Each element is a list of spawn groups: { type, count, interval (ms) }
export const WAVES = [
  [{ type: 'creature', count:  4, interval: 1500 }],
  [{ type: 'creature', count:  7, interval: 1200 }],
  [{ type: 'creature', count: 10, interval: 1000 }],
  [{ type: 'creature', count:  8, interval:  900 }, { type: 'fast', count: 3, interval: 700 }],
  [{ type: 'creature', count: 10, interval:  800 }, { type: 'fast', count: 5, interval: 600 }],
  [{ type: 'creature', count:  6, interval:  800 }, { type: 'boss', count: 1, interval: 0 }],
  [{ type: 'creature', count: 12, interval:  700 }, { type: 'fast', count: 4, interval: 600 }],
  [{ type: 'fast',     count: 10, interval:  600 }, { type: 'creature', count: 8, interval: 700 }],
  [{ type: 'creature', count: 15, interval:  700 }],
  [{ type: 'creature', count: 10, interval:  600 }, { type: 'boss', count: 1, interval: 0 },
   { type: 'fast',     count:  5, interval:  600 }],
  [{ type: 'fast',     count: 15, interval:  400 }, { type: 'creature', count: 10, interval: 600 }],
  [{ type: 'creature', count: 15, interval:  500 }, { type: 'fast', count: 10, interval: 400 },
   { type: 'boss',     count:  2, interval: 5000 }],
];

// ─── Mutations ────────────────────────────────────────────────────────────────
export const MUTATIONS = [
  { id: 'faith_surge',       name: 'Faith Surge',
    description: 'All totems fire 20 % faster',           effect: 'fireRateMult',    value: 0.8,  color: 0xaa55ff },
  { id: 'void_empowerment',  name: 'Void Empowerment',
    description: 'Dark Sigils deal 50 % more damage',     effect: 'darkDamageMult',  value: 1.5,  color: 0x440066 },
  { id: 'iron_skin',         name: 'Iron Skin',
    description: 'Barrier max HP + 50',                   effect: 'barrierMaxHPBonus', value: 50, color: 0xff6633 },
  { id: 'ecstasy_flow',      name: 'Ecstasy Flow',
    description: 'Ecstasy gain + 50 %',                   effect: 'ecstasyGainMult', value: 1.5,  color: 0x00ccff },
  { id: 'geometry_mastery',  name: 'Geometry Mastery',
    description: 'Adjacent-totem synergy + 30 %',         effect: 'synergyBuff',     value: 1.3,  color: 0xffcc00 },
  { id: 'blood_harvest',     name: 'Blood Harvest',
    description: 'Enemies drop 50 % more money',          effect: 'moneyGainMult',   value: 1.5,  color: 0xcc0000 },
  { id: 'crystalline_mind',  name: 'Crystalline Mind',
    description: 'All artifact ranges + 20 %',            effect: 'rangeMult',       value: 1.2,  color: 0x006688 },
  { id: 'undying_faith',     name: 'Undying Faith',
    description: 'Barrier regenerates 2 × faster',        effect: 'regenMult',       value: 2.0,  color: 0xddaa00 },
];

// ─── Balance Constants ────────────────────────────────────────────────────────
export const BASE_MONEY        = 150;
export const BASE_BARRIER_HP   = 200;
export const BASE_BARRIER_REGEN = 1;   // HP / second
export const ARTIFACT_SELL_RATIO = 0.6;
export const WAVE_PREP_TIME    = 12000; // ms between waves
export const MUTATION_AFTER_WAVES = new Set([3, 6, 9]);
