/* ============================================================
   IRON DAWN — arsenal and hand-authored campaign data
   ============================================================ */

export const WEAPONS = {
  pistol: {
    id: 'pistol', slot: 1, name: 'M1911', category: 'SIDEARM', flavor: 'Reliable. Deadly.',
    damage: 34, fireDelay: 0.235, magSize: 12, reserveMax: 120, reserveStart: 84,
    reloadTime: 1.12, spread: 0.012, pellets: 1, bulletSpeed: 1580, auto: false,
    recoil: 2.1, shake: 1.7, sound: 'pistol', tracer: '#ffdda0', muzzle: 13,
    unlockDesc: 'The sidearm you were born with.'
  },
  smg: {
    id: 'smg', slot: 2, name: 'MP5', category: 'SUBMACHINE GUN', flavor: 'Close quarters. No mercy.',
    damage: 16, fireDelay: 0.082, magSize: 30, reserveMax: 300, reserveStart: 210,
    reloadTime: 1.48, spread: 0.043, pellets: 1, bulletSpeed: 1450, auto: true,
    recoil: 1.35, shake: 1.1, sound: 'smg', tracer: '#ffe1a8', muzzle: 10,
    unlockDesc: 'High rate of fire. Close-quarters dominance.'
  },
  shotgun: {
    id: 'shotgun', slot: 3, name: 'M870', category: 'SHOTGUN', flavor: 'One pump. One problem solved.',
    damage: 15, fireDelay: 0.68, magSize: 7, reserveMax: 70, reserveStart: 42,
    reloadTime: 2.05, spread: 0.145, pellets: 9, bulletSpeed: 1240, auto: false,
    recoil: 6.5, shake: 5.4, sound: 'shotgun', tracer: '#ffc77a', muzzle: 21,
    unlockDesc: 'Nine pellets of very persuasive diplomacy.'
  },
  rifle: {
    id: 'rifle', slot: 4, name: 'M4A1', category: 'ASSAULT RIFLE', flavor: 'The professional’s choice.',
    damage: 28, fireDelay: 0.098, magSize: 30, reserveMax: 330, reserveStart: 240,
    reloadTime: 1.72, spread: 0.025, pellets: 1, bulletSpeed: 1900, auto: true,
    recoil: 2.2, shake: 1.8, sound: 'rifle', tracer: '#ffe6b5', muzzle: 12,
    unlockDesc: 'Precision, reach and full-auto fury.'
  },
  rocket: {
    id: 'rocket', slot: 5, name: 'RPG-7', category: 'ANTI-ARMOR', flavor: 'For when cover is a suggestion.',
    damage: 145, fireDelay: 1.12, magSize: 1, reserveMax: 12, reserveStart: 8,
    reloadTime: 2.1, spread: 0.005, pellets: 1, bulletSpeed: 820, auto: false,
    recoil: 7.5, shake: 6.2, sound: 'rocket', tracer: '#ffb15c', muzzle: 25,
    explosive: { radius: 126, damage: 115, shake: 17 },
    unlockDesc: 'Direct-fire demolition. Mind the backblast.'
  }
};

export const WEAPON_ORDER = ['pistol', 'smg', 'shotgun', 'rifle', 'rocket'];

const G = (x, w) => ({ x, y: 620, w, h: 160, kind: 'ground' });
const P = (x, y, w, kind = 'metal', h = 26) => ({ x, y, w, h, kind });
const C = (x, y) => ({ type: 'crate', x, y, w: 42, h: 40, hp: 36 });
const B = (x, y) => ({ type: 'barrel', x, y, w: 34, h: 46, hp: 28 });
const E = (type, x, y, extra = {}) => ({ type, x, y, ...extra });
const K = (x, y = 620) => ({ x, y });
const D = (type, x, y, extra = {}) => ({ type, x, y, ...extra });
const PU = (type, x, y) => ({ type, x, y });

const commonControls = [
  { keys: 'A D', action: 'MOVE' },
  { keys: 'SPACE', action: 'JUMP' },
  { keys: 'MOUSE', action: 'AIM / FIRE' },
  { keys: 'F', action: 'KNIFE' },
  { keys: 'G', action: 'GRENADE' }
];

export function createLevels() {
  return [
    // ============================================================
    // 01 — ASHFALL
    // ============================================================
    {
      id: 0,
      name: 'ASHFALL',
      location: 'HAVEN DISTRICT — DOWNTOWN',
      time: '18:42',
      weather: 'ash',
      unlock: 'smg',
      width: 4400,
      spawn: { x: 120, y: 558 },
      exit: { x: 4170, y: 516, w: 120, h: 104 },
      intro: 'THE CITY FELL IN SIX HOURS. YOU HAVE UNTIL DAWN TO TAKE IT BACK.',
      fieldTips: [
        'Shoot the red barrels. The blast does the rest.',
        'Crates carry ammo, grenades and field medicine.',
        'Press F to introduce them to your knife.',
        'Shift rolls through gunfire. Use it.'
      ],
      theme: {
        skyTop: '#131f2b', skyMid: '#845747', skyBottom: '#e49a58',
        sun: '#ffdda3', sunX: 0.71, sunY: 0.18,
        far: '#263138', mid: '#182227', near: '#0d1417',
        fog: 'rgba(223,139,79,.13)', haze: '#e8a566',
        accent: '#d8ad65', accentRGB: '216,173,101',
        groundTop: '#82735c', groundBase: '#34342f', groundDeep: '#1b1d1b',
        window: '#ffc97e', night: false, rain: false,
        fogDensity: 0.38
      },
      platforms: [
        G(0, 900), G(1000, 780), G(1880, 820), G(2800, 660), G(3550, 850),
        P(430, 512, 180), P(700, 435, 150), P(1090, 510, 190),
        P(1360, 428, 150), P(1590, 505, 160), P(2050, 510, 200, 'concrete'),
        P(2330, 430, 170), P(2570, 350, 140), P(2920, 505, 190),
        P(3190, 425, 160), P(3400, 345, 130), P(3660, 505, 200, 'concrete'),
        P(3920, 415, 170)
      ],
      platformsExtra: [],
      cover: [
        { x: 900, y: 575, w: 64, h: 45, kind: 'barrier' },
        { x: 2490, y: 575, w: 64, h: 45, kind: 'barrier' },
        { x: 3720, y: 575, w: 64, h: 45, kind: 'barrier' }
      ],
      enemies: [
        E('grunt', 760, 564), E('grunt', 1120, 564), E('grunt', 1410, 372, { patrol: 50 }),
        E('grunt', 1640, 564), E('grunt', 2100, 454, { patrol: 55 }),
        E('grunt', 2390, 374, { patrol: 45 }), E('grunt', 2960, 564),
        E('turret', 2990, 461), E('grunt', 3240, 369, { patrol: 45 }),
        E('grunt', 3730, 564), E('heavy', 4020, 554)
      ],
      destructibles: [
        C(460, 472), B(610, 574), C(780, 580), B(1050, 574), C(1145, 580),
        C(1390, 388), B(1540, 574), C(2070, 470), B(2200, 574), B(2370, 390),
        C(2590, 310), B(2970, 461), C(3070, 580), B(3245, 381), C(3700, 465),
        B(3840, 574), C(4060, 580)
      ],
      pickups: [PU('grenade', 930, 560), PU('health', 2500, 560)],
      checkpoints: [K(1530), K(2620), K(3510)],
      hazards: [],
      decorations: [
        D('wreck', 245, 620), D('lamp', 620, 620), D('sandbags', 850, 620),
        D('rubble', 1160, 620), D('car', 1700, 620), D('sign', 1830, 620, { text: 'EVAC →' }),
        D('lamp', 2140, 620), D('container', 2690, 620), D('rubble', 3070, 620),
        D('barrier', 3330, 620), D('sandbags', 3610, 620), D('flag', 3900, 620),
        D('wreck', 4010, 620), D('rubble', 4160, 620)
      ],
      skylineSeed: 7711
    },

    // ============================================================
    // 02 — RUSTYARD
    // ============================================================
    {
      id: 1,
      name: 'RUSTYARD',
      location: 'INDUSTRIAL BELT — DOCKS 7',
      time: '21:16',
      weather: 'rain',
      unlock: 'shotgun',
      width: 4700,
      spawn: { x: 110, y: 558 },
      exit: { x: 4450, y: 516, w: 120, h: 104 },
      intro: 'THEY MOVED THE WEAPONS THROUGH THE OLD STEEL MILL. FOLLOW THE RAIN.',
      fieldTips: [
        'Rain masks sound. It does not stop bullets.',
        'Shotgun crates are marked with three red stripes.',
        'Drones go down fast. Lead your shots.',
        'Use catwalks to flank entrenched positions.'
      ],
      theme: {
        skyTop: '#0b1720', skyMid: '#1e3d44', skyBottom: '#748b83',
        sun: '#b9d3ce', sunX: 0.25, sunY: 0.14,
        far: '#23363b', mid: '#16272c', near: '#0a1316',
        fog: 'rgba(105,148,150,.14)', haze: '#8eb3b0',
        accent: '#c2a46c', accentRGB: '194,164,108',
        groundTop: '#6e6c5e', groundBase: '#2e3535', groundDeep: '#141b1d',
        window: '#e9ba6f', night: true, rain: true,
        fogDensity: 0.32
      },
      platforms: [
        G(0, 760), G(850, 620), G(1570, 520), G(2200, 720), G(3020, 640), G(3770, 930),
        P(330, 520, 170), P(570, 438, 140), P(930, 500, 180),
        P(1200, 415, 150), P(1470, 505, 160), P(1770, 438, 160),
        P(2050, 520, 180), P(2350, 430, 160), P(2620, 350, 130),
        P(2860, 510, 170), P(3150, 430, 150), P(3420, 350, 140),
        P(3660, 500, 180), P(3970, 420, 160), P(4240, 500, 160)
      ],
      platformsExtra: [],
      cover: [
        { x: 790, y: 576, w: 62, h: 44, kind: 'barrier' },
        { x: 2130, y: 576, w: 62, h: 44, kind: 'barrier' },
        { x: 2930, y: 576, w: 62, h: 44, kind: 'barrier' },
        { x: 3660, y: 576, w: 62, h: 44, kind: 'barrier' }
      ],
      enemies: [
        E('grunt', 680, 564), E('heavy', 1010, 554), E('drone', 1340, 350, { amp: 38 }),
        E('grunt', 1740, 564, { patrol: 55 }), E('grunt', 1910, 382, { patrol: 45 }),
        E('turret', 2110, 476), E('heavy', 2470, 554), E('turret', 2690, 306),
        E('grunt', 2960, 564), E('drone', 3230, 310, { amp: 50 }),
        E('grunt', 3320, 374, { patrol: 40 }), E('grunt', 3590, 564),
        E('heavy', 3910, 554), E('grunt', 4140, 564), E('drone', 4320, 330, { amp: 45 })
      ],
      destructibles: [
        C(360, 480), B(530, 574), C(620, 580), B(870, 574), C(980, 580),
        B(1120, 574), C(1240, 375), B(1510, 574), C(1810, 580), B(2080, 480),
        C(2390, 390), B(2670, 574), C(2890, 470), B(3190, 390), C(3460, 310),
        B(3700, 574), C(4000, 380), B(4280, 460), C(4380, 580)
      ],
      pickups: [PU('armor', 500, 395), PU('grenade', 2280, 480), PU('health', 3550, 560)],
      checkpoints: [K(1630), K(2910), K(3900)],
      hazards: [
        { type: 'electric', x: 1450, y: 588, w: 72, h: 32, damage: 8, interval: 0.7 },
        { type: 'electric', x: 2860, y: 588, w: 80, h: 32, damage: 8, interval: 0.7 }
      ],
      decorations: [
        D('container', 220, 620, { tone: 'rust' }), D('pipe', 610, 620), D('crane', 930, 620),
        D('container', 1220, 620, { tone: 'green' }), D('barrier', 1530, 620),
        D('car', 1840, 620), D('pipe', 2210, 620), D('lamp', 2500, 620),
        D('container', 2770, 620, { tone: 'blue' }), D('generator', 3090, 620),
        D('pipe', 3380, 620), D('container', 3650, 620, { tone: 'rust' }),
        D('crane', 4010, 620), D('rubble', 4330, 620), D('lamp', 4490, 620)
      ],
      skylineSeed: 4922
    },

    // ============================================================
    // 03 — REDLINE
    // ============================================================
    {
      id: 2,
      name: 'REDLINE',
      location: 'SOUTH REFINERY — BURN ZONE',
      time: '23:58',
      weather: 'embers',
      unlock: 'rifle',
      width: 5000,
      spawn: { x: 110, y: 558 },
      exit: { x: 4780, y: 516, w: 120, h: 104 },
      intro: 'THE REFINERY IS STILL BURNING. SO IS EVERYTHING THEY TOUCHED.',
      fieldTips: [
        'Fire vents cycle. Watch the warning lamps.',
        'Chain barrels together for a very loud solution.',
        'Heavy troopers soak damage. Aim for the head.',
        'Armor absorbs half of incoming damage.'
      ],
      theme: {
        skyTop: '#190e12', skyMid: '#59201d', skyBottom: '#c55c31',
        sun: '#ffb06b', sunX: 0.82, sunY: 0.22,
        far: '#301a1a', mid: '#211010', near: '#100808',
        fog: 'rgba(220,92,45,.16)', haze: '#e47b3d',
        accent: '#d9a14f', accentRGB: '217,161,79',
        groundTop: '#72513c', groundBase: '#322521', groundDeep: '#191010',
        window: '#ff8b4b', night: true, rain: false,
        fogDensity: 0.46
      },
      platforms: [
        G(0, 850), G(940, 620), G(1650, 700), G(2440, 760), G(3290, 660), G(4040, 960),
        P(300, 520, 170), P(580, 430, 150), P(1000, 500, 180),
        P(1280, 410, 150), P(1500, 330, 140), P(1800, 505, 180),
        P(2080, 425, 160), P(2310, 345, 130), P(2550, 510, 170),
        P(2840, 430, 160), P(3120, 350, 140), P(3400, 505, 180),
        P(3680, 425, 160), P(3960, 345, 140), P(4200, 505, 180),
        P(4500, 420, 160)
      ],
      platformsExtra: [],
      cover: [
        { x: 900, y: 576, w: 62, h: 44, kind: 'barrier' },
        { x: 2390, y: 576, w: 62, h: 44, kind: 'barrier' },
        { x: 3230, y: 576, w: 62, h: 44, kind: 'barrier' },
        { x: 3980, y: 576, w: 62, h: 44, kind: 'barrier' }
      ],
      enemies: [
        E('grunt', 650, 564), E('heavy', 1080, 554), E('grunt', 1330, 354, { patrol: 40 }),
        E('grunt', 1720, 564), E('drone', 1950, 330, { amp: 44 }),
        E('grunt', 2150, 369, { patrol: 45 }), E('heavy', 2490, 554),
        E('grunt', 2630, 454, { patrol: 45 }), E('turret', 2890, 386),
        E('grunt', 3000, 564), E('drone', 3260, 300, { amp: 55 }),
        E('heavy', 3500, 554), E('grunt', 3730, 369, { patrol: 45 }),
        E('turret', 4000, 301), E('grunt', 4120, 564), E('heavy', 4320, 554),
        E('drone', 4520, 340, { amp: 42 }), E('grunt', 4700, 564)
      ],
      destructibles: [
        C(330, 480), B(500, 574), B(620, 574), C(1040, 460), B(1120, 574),
        C(1320, 370), B(1450, 574), B(1560, 574), C(1840, 465), B(2010, 574),
        B(2140, 574), C(2350, 305), B(2590, 470), B(2770, 574), C(2880, 390),
        B(3160, 310), C(3440, 465), B(3600, 574), B(3770, 574), C(4000, 305),
        B(4240, 465), C(4540, 380), B(4660, 574)
      ],
      pickups: [PU('health', 1390, 390), PU('grenade', 2590, 480), PU('armor', 3490, 390)],
      checkpoints: [K(1730), K(2820), K(3910)],
      hazards: [
        { type: 'fire', x: 900, y: 548, w: 46, h: 72, damage: 14, interval: 0.5 },
        { type: 'fire', x: 2320, y: 548, w: 46, h: 72, damage: 14, interval: 0.5 },
        { type: 'fire', x: 3900, y: 548, w: 46, h: 72, damage: 14, interval: 0.5 }
      ],
      decorations: [
        D('pipe', 250, 620), D('tank', 740, 620), D('barrier', 960, 620),
        D('tank', 1480, 620), D('rubble', 1700, 620), D('pipe', 2050, 620),
        D('tank', 2700, 620), D('generator', 3020, 620), D('rubble', 3300, 620),
        D('tank', 3820, 620), D('pipe', 4100, 620), D('barrier', 4380, 620),
        D('tank', 4630, 620), D('flag', 4820, 620)
      ],
      skylineSeed: 9016
    },

    // ============================================================
    // 04 — BLACKOUT
    // ============================================================
    {
      id: 3,
      name: 'BLACKOUT',
      location: 'FORTRESS APPROACH — GRID 9',
      time: '03:11',
      weather: 'storm',
      unlock: 'rocket',
      width: 5100,
      spawn: { x: 105, y: 558 },
      exit: { x: 4910, y: 516, w: 120, h: 104 },
      intro: 'THE POWER IS OUT. THEIR NIGHT VISION IS NOT. MAKE THE DARK YOURS.',
      fieldTips: [
        'Turrets track heat signatures. Break line of sight.',
        'Drones flare before they fire.',
        'Rocket crates glow amber. You will hear angels.',
        'The blade is always quiet. Always lethal.'
      ],
      theme: {
        skyTop: '#050b15', skyMid: '#101e32', skyBottom: '#263d50',
        sun: '#9bc8dc', sunX: 0.17, sunY: 0.12,
        far: '#172533', mid: '#0b1721', near: '#050a0e',
        fog: 'rgba(63,104,129,.13)', haze: '#7ba4b7',
        accent: '#b5c5c8', accentRGB: '181,197,200',
        groundTop: '#4e5657', groundBase: '#252c2e', groundDeep: '#11171a',
        window: '#7dc9d4', night: true, rain: true,
        fogDensity: 0.5
      },
      platforms: [
        G(0, 780), G(860, 600), G(1550, 690), G(2330, 670), G(3090, 710), G(3890, 1210),
        P(300, 520, 160), P(540, 435, 140), P(900, 500, 170),
        P(1160, 415, 150), P(1410, 505, 160), P(1700, 438, 160),
        P(1980, 520, 170), P(2260, 430, 160), P(2520, 350, 130),
        P(2780, 510, 170), P(3060, 430, 150), P(3330, 350, 140),
        P(3580, 500, 180), P(3880, 420, 160), P(4160, 500, 160),
        P(4440, 420, 160), P(4720, 500, 160)
      ],
      platformsExtra: [],
      cover: [
        { x: 820, y: 576, w: 62, h: 44, kind: 'barrier' },
        { x: 2280, y: 576, w: 62, h: 44, kind: 'barrier' },
        { x: 3040, y: 576, w: 62, h: 44, kind: 'barrier' },
        { x: 3840, y: 576, w: 62, h: 44, kind: 'barrier' }
      ],
      enemies: [
        E('grunt', 660, 564), E('turret', 860, 476), E('drone', 1120, 320, { amp: 48 }),
        E('heavy', 1260, 554), E('grunt', 1480, 564), E('grunt', 1760, 382, { patrol: 42 }),
        E('turret', 2040, 476), E('drone', 2200, 300, { amp: 55 }),
        E('grunt', 2420, 564), E('heavy', 2650, 554), E('grunt', 2880, 454, { patrol: 45 }),
        E('drone', 3150, 330, { amp: 48 }), E('turret', 3390, 306),
        E('grunt', 3500, 564), E('heavy', 3720, 554), E('grunt', 3960, 364, { patrol: 45 }),
        E('drone', 4300, 310, { amp: 52 }), E('grunt', 4410, 364, { patrol: 45 }),
        E('heavy', 4660, 554), E('turret', 4790, 456), E('grunt', 4950, 564)
      ],
      destructibles: [
        C(330, 480), B(550, 574), C(930, 460), B(1040, 574), B(1190, 574),
        C(1200, 375), B(1450, 574), C(1740, 382), B(2020, 480), B(2300, 574),
        C(2560, 310), B(2810, 574), C(3100, 390), B(3370, 310), C(3620, 460),
        B(3920, 380), B(4200, 460), C(4470, 380), B(4750, 460), C(4850, 580),
        B(4980, 574)
      ],
      pickups: [PU('grenade', 560, 395), PU('health', 2280, 480), PU('armor', 3900, 380)],
      checkpoints: [K(1610), K(2900), K(3950)],
      hazards: [
        { type: 'electric', x: 1460, y: 588, w: 82, h: 32, damage: 9, interval: 0.65 },
        { type: 'electric', x: 3000, y: 588, w: 82, h: 32, damage: 9, interval: 0.65 },
        { type: 'electric', x: 3800, y: 588, w: 82, h: 32, damage: 9, interval: 0.65 }
      ],
      decorations: [
        D('watchtower', 180, 620), D('barrier', 700, 620), D('container', 970, 620, { tone: 'blue' }),
        D('lamp', 1300, 620), D('generator', 1600, 620), D('watchtower', 2100, 620),
        D('barrier', 2450, 620), D('container', 3000, 620, { tone: 'rust' }),
        D('pipe', 3350, 620), D('watchtower', 3600, 620), D('lamp', 4000, 620),
        D('container', 4300, 620, { tone: 'green' }), D('generator', 4600, 620),
        D('barrier', 4800, 620)
      ],
      skylineSeed: 3388
    },

    // ============================================================
    // 05 — IRON DAWN
    // ============================================================
    {
      id: 4,
      name: 'IRON DAWN',
      location: 'VOLKOV FORTRESS — THE LAST WALL',
      time: '05:47',
      weather: 'dawn',
      unlock: null,
      width: 5400,
      spawn: { x: 100, y: 558 },
      exit: null,
      bossTrigger: 4290,
      gateX: 4230,
      boss: { x: 4990, y: 476, name: 'COLONEL VOLKOV', title: 'THE IRON WALL', hp: 1500 },
      intro: 'ONE WAY OUT. ONE LAST WALL. MAKE THE SUNRISE MEAN SOMETHING.',
      fieldTips: [
        'The gate seals behind you. No reinforcements.',
        'Volkov’s armor breaks at half health. Keep moving.',
        'Rockets stagger the old man. Use them.',
        'This is the last wall. Bring it down.'
      ],
      theme: {
        skyTop: '#171528', skyMid: '#7d4450', skyBottom: '#e8a566',
        sun: '#ffe6ad', sunX: 0.5, sunY: 0.31,
        far: '#3a2b32', mid: '#221a22', near: '#100d12',
        fog: 'rgba(233,157,93,.15)', haze: '#f0ae6d',
        accent: '#e4b56b', accentRGB: '228,181,107',
        groundTop: '#7a6653', groundBase: '#37322d', groundDeep: '#1c1918',
        window: '#ffc47a', night: false, rain: false,
        fogDensity: 0.3
      },
      platforms: [
        G(0, 1000), G(1100, 800), G(2000, 800), G(2900, 800), G(3800, 1600),
        P(300, 520, 170), P(560, 435, 150), P(900, 505, 180),
        P(1200, 420, 150), P(1450, 340, 140), P(1750, 505, 180),
        P(2050, 425, 160), P(2350, 345, 130), P(2600, 505, 170),
        P(2900, 430, 160), P(3180, 350, 140), P(3450, 505, 180),
        P(3730, 425, 160), P(4000, 350, 140),
        P(4420, 470, 170, 'concrete'), P(4780, 470, 190, 'concrete'), P(5120, 470, 150, 'concrete'),
        P(4640, 355, 120, 'metal'), P(4990, 355, 120, 'metal')
      ],
      platformsExtra: [],
      cover: [
        { x: 950, y: 576, w: 62, h: 44, kind: 'barrier' },
        { x: 1950, y: 576, w: 62, h: 44, kind: 'barrier' },
        { x: 2850, y: 576, w: 62, h: 44, kind: 'barrier' },
        { x: 3750, y: 576, w: 62, h: 44, kind: 'barrier' },
        { x: 4340, y: 576, w: 62, h: 44, kind: 'barrier' },
        { x: 4870, y: 576, w: 62, h: 44, kind: 'barrier' }
      ],
      enemies: [
        E('grunt', 700, 564), E('heavy', 1060, 554), E('grunt', 1300, 364, { patrol: 40 }),
        E('drone', 1500, 320, { amp: 50 }), E('grunt', 1800, 564), E('turret', 2100, 381),
        E('heavy', 2440, 554), E('grunt', 2700, 454, { patrol: 45 }),
        E('drone', 3000, 300, { amp: 55 }), E('grunt', 3300, 294, { patrol: 40 }),
        E('heavy', 3550, 554), E('grunt', 3800, 564), E('turret', 4050, 306),
        E('drone', 4160, 300, { amp: 50 }), E('heavy', 4200, 554)
      ],
      destructibles: [
        C(330, 480), B(500, 574), C(940, 460), B(1080, 574), B(1240, 574),
        C(1240, 380), B(1490, 574), C(1790, 465), B(2090, 574), C(2390, 305),
        B(2640, 470), B(2830, 574), C(2940, 390), B(3220, 310), C(3490, 465),
        B(3630, 574), B(3770, 574), C(4040, 310), B(4290, 574), C(4380, 530),
        C(4900, 530), B(5120, 574), C(5220, 580)
      ],
      pickups: [PU('health', 1260, 380), PU('armor', 2250, 480), PU('grenade', 3580, 380), PU('health', 4430, 430)],
      checkpoints: [K(1150), K(2050), K(2950), K(4130)],
      hazards: [
        { type: 'fire', x: 1950, y: 548, w: 46, h: 72, damage: 14, interval: 0.5 },
        { type: 'fire', x: 2850, y: 548, w: 46, h: 72, damage: 14, interval: 0.5 }
      ],
      decorations: [
        D('flag', 190, 620), D('tank', 820, 620), D('barrier', 1140, 620),
        D('watchtower', 1500, 620), D('container', 1900, 620, { tone: 'green' }),
        D('tank', 2600, 620), D('rubble', 2950, 620), D('watchtower', 3350, 620),
        D('barrier', 3700, 620), D('tank', 4050, 620), D('flag', 4320, 620),
        D('container', 4550, 620, { tone: 'rust' }), D('rubble', 5330, 620)
      ],
      skylineSeed: 6620
    }
  ];
}

export const CAMPAIGN = createLevels();
export { commonControls };
