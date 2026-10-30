import {
  TAU, clamp, damp, lerp, rand, randInt, choice, sign, distance,
  circleRect, formatTime, approach
} from './utils.js';

const PLAYER_MAX_HP = 5;
const SOUL_MAX = 99;
const BOSS_MAX_HP = 32;
const FOCUS_COST = 33;
const FOCUS_TIME = 0.82;

class Particle {
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    this.vx = opts.vx ?? 0;
    this.vy = opts.vy ?? 0;
    this.life = opts.life ?? 0.8;
    this.maxLife = this.life;
    this.size = opts.size ?? 3;
    this.color = opts.color ?? '#c7f7ec';
    this.type = opts.type ?? 'dust';
    this.gravity = opts.gravity ?? 0;
    this.drag = opts.drag ?? 0.985;
    this.rot = opts.rot ?? rand(0, TAU);
    this.spin = opts.spin ?? rand(-4, 4);
    this.alpha = opts.alpha ?? 1;
    this.floor = opts.floor ?? null;
    this.bounce = opts.bounce ?? 0;
    this.glow = opts.glow ?? false;
  }

  update(dt) {
    this.life -= dt;
    this.vy += this.gravity * dt;
    this.vx *= Math.pow(this.drag, dt * 60);
    this.vy *= Math.pow(this.drag, dt * 60);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.spin * dt;
    if (this.floor != null && this.y > this.floor && this.vy > 0) {
      this.y = this.floor;
      this.vy *= -this.bounce;
      this.vx *= 0.72;
      this.spin *= 0.7;
      if (Math.abs(this.vy) < 20) this.vy = 0;
    }
  }
}

class Player {
  constructor(game) {
    this.game = game;
    this.maxHp = PLAYER_MAX_HP;
    this.hp = this.maxHp;
    this.soul = 0;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = true;
    this.prevFeet = 0;
    this.coyote = 0;
    this.jumps = 0;
    this.jumpHeld = false;
    this.airDashUsed = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.attackDir = 'side';
    this.attackHitBoss = false;
    this.invuln = 0;
    this.hurtFlash = 0;
    this.focusTime = 0;
    this.focusing = false;
    this.focusBlip = 0;
    this.dead = false;
    this.deathTimer = 0;
    this.landSquash = 0;
    this.time = 0;
    this.afterimageTimer = 0;
    this.aimY = 0;
    this.moving = 0;
  }

  get s() { return this.game.s; }
  get hurtRadius() { return 14 * this.s; }
  get hurtY() { return this.y - 18 * this.s; }
  get nailDamage() { return 1; }

  reset(x, y) {
    this.hp = this.maxHp;
    this.soul = 0;
    this.x = x;
    this.y = y;
    this.prevFeet = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = true;
    this.coyote = 0;
    this.jumps = 0;
    this.airDashUsed = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.invuln = 0;
    this.hurtFlash = 0;
    this.focusTime = 0;
    this.focusing = false;
    this.dead = false;
    this.deathTimer = 0;
    this.landSquash = 0;
    this.time = 0;
  }

  update(dt) {
    const game = this.game;
    const input = game.input;
    const s = this.s;
    this.time += dt;
    this.prevFeet = this.y;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.landSquash = Math.max(0, this.landSquash - dt * 4);

    const axis = game.canControl ? input.axis() : { x: 0, y: 0, len: 0 };
    this.moving = Math.abs(axis.x);
    this.aimY = axis.y;
    if (axis.x !== 0 && this.dashTimer <= 0) this.facing = sign(axis.x);

    const jumpPressed = game.canControl && input.wasPressed('jump');
    const jumpHeld = game.canControl && input.isHeld('jump');
    this.jumpHeld = jumpHeld;

    if (game.canControl && input.wasPressed('dash')) this.tryDash();
    if (game.canControl && (input.wasPressed('attack') || input.isHeld('attack')) && this.attackCooldown <= 0 && this.dashTimer <= 0) {
      this.attack(axis);
    }

    const focusingNow = game.canControl && input.isHeld('focus');
    this.updateFocus(dt, focusingNow, axis);

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.vx = this.facing * 930 * s;
      this.vy = 0;
      this.afterimageTimer -= dt;
      if (this.afterimageTimer <= 0) {
        this.afterimageTimer = 0.028;
        game.afterimages.push({
          kind: 'player', x: this.x, y: this.y, facing: this.facing,
          life: 0.24, maxLife: 0.24, alpha: 0.4, pose: 'dash'
        });
      }
      if (this.dashTimer <= 0) {
        this.vx *= 0.45;
        this.dashCooldown = 0.55;
      }
    } else {
      const accel = this.onGround ? 3200 : 2500;
      const max = (this.focusing ? 105 : 355) * s;
      if (Math.abs(axis.x) > 0.12) {
        this.vx = approach(this.vx, axis.x * max, accel * s * dt);
      } else {
        this.vx = approach(this.vx, 0, (this.onGround ? 3600 : 1200) * s * dt);
      }
    }

    if (jumpPressed) {
      if (this.onGround || this.coyote > 0) {
        this.vy = -820 * s;
        this.onGround = false;
        this.coyote = 0;
        this.jumps = 1;
        this.landSquash = 0;
        game.audio.play('jump', this.pan());
        game.spawnDust(this.x, this.y, 7, 1);
      } else if (this.jumps < 2 && this.dashTimer <= 0) {
        this.vy = -720 * s;
        this.jumps = 2;
        game.audio.play('double', this.pan());
        game.spawnWingFlare(this.x, this.hurtY, this.facing);
      }
    }

    if (!jumpHeld && this.vy < -220 * s) {
      this.vy = approach(this.vy, -210 * s, 2300 * s * dt);
    }

    if (this.dashTimer <= 0) {
      this.vy += 2380 * s * dt;
      this.vy = Math.min(this.vy, 1500 * s);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    } else {
      this.x += this.vx * dt;
    }

    this.x = clamp(this.x, game.left + 16 * s, game.right - 16 * s);

    const wasAir = !this.onGround;
    this.onGround = false;
    if (this.y >= game.floor) {
      if (wasAir && this.vy > 350 * s) {
        this.landSquash = 1;
        game.spawnDust(this.x, game.floor, 9, 1.2);
        game.addShake(2.5);
      }
      this.y = game.floor;
      this.vy = 0;
      this.onGround = true;
      this.jumps = 0;
      this.airDashUsed = false;
      this.coyote = 0.1;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
    }

    if (this.focusing) {
      this.focusBlip -= dt;
      if (this.focusBlip <= 0) {
        this.focusBlip = 0.11;
        game.spawnFocusMote(this.x, this.hurtY);
      }
    }
  }

  tryDash() {
    if (this.dashCooldown > 0 || this.dashTimer > 0) return;
    if (!this.onGround && this.airDashUsed) return;
    this.dashTimer = 0.17;
    this.dashCooldown = 0.62;
    this.afterimageTimer = 0;
    this.invuln = Math.max(this.invuln, 0.22);
    if (!this.onGround) this.airDashUsed = true;
    this.focusTime = 0;
    this.game.audio.play('dash', this.pan());
    this.game.spawnDashMotes(this.x, this.hurtY, this.facing);
    this.game.addShake(1.6);
  }

  attack(axis) {
    let dir = 'side';
    if (axis.y < -0.46) dir = 'up';
    else if (axis.y > 0.46) dir = 'down';
    this.attackDir = dir;
    this.attackTimer = 0.24;
    this.attackCooldown = 0.255;
    this.attackHitBoss = false;
    this.attackHitShock = new Set();
    this.game.audio.play('slash', this.pan());
    this.game.spawnSlash(this.x, this.hurtY, this.facing, dir, false);
    this.game.resolvePlayerAttack(this);
  }

  getAttackCircle() {
    const s = this.s;
    if (this.attackDir === 'up') return { x: this.x, y: this.hurtY - 62 * s, r: 57 * s };
    if (this.attackDir === 'down') return { x: this.x, y: this.hurtY + 58 * s, r: 58 * s };
    return { x: this.x + this.facing * 61 * s, y: this.hurtY + 2 * s, r: 60 * s };
  }

  updateFocus(dt, held, axis) {
    if (!held || this.hp >= this.maxHp || this.soul < FOCUS_COST || !this.onGround || Math.abs(axis.x) > 0.35 || this.dashTimer > 0) {
      if (this.focusTime > 0 && this.focusTime < FOCUS_TIME) this.game.cancelFocusMotes(this.x, this.hurtY);
      this.focusTime = Math.max(0, this.focusTime - dt * 3.5);
      this.focusing = false;
      return;
    }
    const was = this.focusing;
    this.focusing = true;
    this.focusTime += dt;
    if (!was) this.game.audio.play('focus', this.pan());
    if (this.focusTime >= FOCUS_TIME) {
      this.focusTime = 0;
      this.soul = Math.max(0, this.soul - FOCUS_COST);
      this.hp = Math.min(this.maxHp, this.hp + 1);
      this.invuln = Math.max(this.invuln, 0.35);
      this.game.audio.play('heal', this.pan());
      this.game.spawnHealBurst(this.x, this.hurtY);
      this.game.addShake(2);
      this.game.maskGained = true;
    }
  }

  hurt(amount, sourceX, sourceY) {
    if (this.dead || this.invuln > 0 || this.dashTimer > 0) return false;
    const game = this.game;
    this.hp -= amount;
    this.invuln = 1.25;
    this.hurtFlash = 0.42;
    this.focusTime = 0;
    this.focusing = false;
    this.game.masksLost += amount;
    const dir = sign(this.x - sourceX || rand(-1, 1));
    this.vx = dir * 280 * this.s;
    this.vy = Math.min(this.vy, -330 * this.s);
    this.onGround = false;
    game.addShake(11);
    game.flash = Math.max(game.flash, 0.34);
    game.hitstop = Math.max(game.hitstop, 0.075);
    game.audio.play('hurt', this.pan());
    game.spawnHurtBurst(this.x, this.hurtY, dir);
    if (this.hp <= 0) game.startDying();
    return true;
  }

  pan() {
    return clamp((this.x / this.game.w - 0.5) * 2, -1, 1);
  }
}

class Boss {
  constructor(game) {
    this.game = game;
    this.maxHp = BOSS_MAX_HP;
    this.hp = BOSS_MAX_HP;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
    this.state = 'idle';
    this.stateTime = 0;
    this.duration = 0.8;
    this.phase = 1;
    this.hitFlash = 0;
    this.poise = 0;
    this.deathTimer = 0;
    this.attackData = {};
    this.echoTimer = 0;
    this.hover = 0;
    this.landed = false;
  }

  get s() { return this.game.s; }
  get halfWidth() { return 76 * this.s; }
  get bodyHeight() { return 208 * this.s; }
  get chestY() { return this.y - 140 * this.s; }

  reset(x, y) {
    this.hp = this.maxHp;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
    this.state = 'awaken';
    this.stateTime = 0;
    this.duration = 0.9;
    this.phase = 1;
    this.hitFlash = 0;
    this.poise = 0;
    this.deathTimer = 0;
    this.attackData = {};
    this.hover = 0;
    this.landed = false;
  }

  hurtRect() {
    const s = this.s;
    return {
      x: this.x - 52 * s,
      y: this.y - 154 * s,
      w: 104 * s,
      h: 154 * s
    };
  }

  update(dt) {
    const game = this.game;
    this.stateTime += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.hover = Math.sin(game.time * 2.1) * 3 * this.s;
    if (this.state === 'dead') {
      this.deathTimer += dt;
      if (this.deathTimer < 1.6 && Math.random() < dt * 24) {
        const t = Math.random();
        game.spawnSoulBurst(
          this.x + rand(-40, 40) * this.s,
          this.y - t * this.bodyHeight,
          rand(1, 3)
        );
      }
      return;
    }

    if (this.y < game.floor) {
      this.vy += 2450 * this.s * dt;
      this.y += this.vy * dt;
      if (this.y >= game.floor) {
        this.y = game.floor;
        this.vy = 0;
        if (this.state === 'leap') this.landSlam();
      }
    }

    switch (this.state) {
      case 'awaken':
        this.vx = 0;
        if (this.stateTime > this.duration) this.toIdle(0.55);
        break;

      case 'idle': {
        const dx = game.player.x - this.x;
        this.facing = sign(dx || this.facing);
        const dist = Math.abs(dx);
        const speed = (this.phase === 2 ? 115 : 78) * this.s;
        if (dist > 155 * this.s) this.vx = approach(this.vx, sign(dx) * speed, 500 * this.s * dt);
        else this.vx = approach(this.vx, 0, 760 * this.s * dt);
        this.x += this.vx * dt;
        if (this.stateTime > this.duration) this.chooseAttack();
        break;
      }

      case 'lungeWind':
        this.vx = 0;
        if (this.stateTime > this.duration) this.startLunge();
        break;

      case 'lunge':
        this.vx = this.facing * (this.phase === 2 ? 1120 : 930) * this.s;
        this.x += this.vx * dt;
        this.echoTimer -= dt;
        if (this.echoTimer <= 0) {
          this.echoTimer = 0.035;
          game.afterimages.push({
            kind: 'boss', x: this.x, y: this.y, facing: this.facing,
            life: 0.25, maxLife: 0.25, alpha: 0.28, pose: 'lunge', phase: this.phase
          });
        }
        if (this.stateTime > 0.34) this.recover(0.42);
        break;

      case 'leapWind':
        this.vx = 0;
        if (this.stateTime > this.duration) {
          this.state = 'leap';
          this.stateTime = 0;
          this.vy = -1030 * this.s;
          this.vx = (this.attackData.targetX - this.x) / 0.62;
          game.audio.play('dash', 0);
        }
        break;

      case 'leap':
        this.x += this.vx * dt;
        if (this.landed) this.landed = false;
        break;

      case 'slam':
        this.vx = 0;
        if (this.stateTime > 0.4) this.recover(0.1);
        break;

      case 'volleyWind':
        this.vx = 0;
        if (this.stateTime > this.duration) {
          this.fireVolley();
          this.state = 'volleyRecover';
          this.stateTime = 0;
          this.duration = 0.48;
        }
        break;

      case 'volleyRecover':
        this.vx = 0;
        if (this.stateTime > this.duration) this.toIdle(0.35);
        break;

      case 'spikeWind':
        this.vx = 0;
        if (!this.attackData.fired && this.stateTime > this.duration) {
          this.attackData.fired = true;
          this.fireSpikes();
        }
        if (this.stateTime > this.duration + 0.28) this.recover(0.12);
        break;

      case 'rainWind':
        this.vx = 0;
        if (!this.attackData.fired && this.stateTime > this.duration) {
          this.attackData.fired = true;
          this.fireRain();
        }
        if (this.stateTime > this.duration + 0.3) this.recover(0.18);
        break;

      case 'recover':
        this.vx = approach(this.vx, 0, 1500 * this.s * dt);
        if (this.stateTime > this.duration) this.toIdle(0.35);
        break;

      case 'stagger':
        this.vx = 0;
        if (this.stateTime > 1.18) {
          this.poise = 0;
          this.toIdle(0.25);
        }
        break;

      case 'phase': {
        this.vx = 0;
        if (this.stateTime > 1.65) {
          this.toIdle(0.3);
        }
        break;
      }
    }

    this.x = clamp(this.x, this.game.left + this.halfWidth, this.game.right - this.halfWidth);
    if (this.x <= this.game.left + this.halfWidth + 1) this.facing = Math.max(this.facing, 1);
    if (this.x >= this.game.right - this.halfWidth - 1) this.facing = Math.min(this.facing, -1);
  }

  toIdle(delay = 0.5) {
    this.state = 'idle';
    this.stateTime = 0;
    this.duration = delay + rand(0.25, 0.85) * (this.phase === 2 ? 0.68 : 1);
    this.vx *= 0.2;
  }

  recover(delay = 0.35) {
    this.state = 'recover';
    this.stateTime = 0;
    this.duration = delay;
    this.vx *= 0.25;
  }

  chooseAttack() {
    const game = this.game;
    const dist = Math.abs(game.player.x - this.x);
    const close = dist < 230 * this.s;
    let pool;
    if (this.phase === 1) {
      pool = ['lunge', 'lunge', 'leap', 'volley', 'spikes'];
      if (close) pool.push('leap', 'lunge');
    } else {
      pool = ['lunge', 'leap', 'volley', 'spikes', 'rain', 'rain'];
      if (close) pool.push('lunge', 'leap');
    }
    let pick = choice(pool);
    if (pick === this.attackData.last && Math.random() < 0.58) pick = choice(pool);
    this.attackData = { last: pick };
    this.facing = sign(game.player.x - this.x || this.facing);
    const fast = this.phase === 2 ? 0.74 : 1;

    if (pick === 'lunge') {
      this.state = 'lungeWind';
      this.stateTime = 0;
      this.duration = 0.48 * fast;
      this.echoTimer = 0;
      game.audio.play('focus', this.pan());
    } else if (pick === 'leap') {
      this.state = 'leapWind';
      this.stateTime = 0;
      this.duration = 0.36 * fast;
      this.attackData.targetX = game.player.x;
      game.audio.play('focus', this.pan());
    } else if (pick === 'volley') {
      this.state = 'volleyWind';
      this.stateTime = 0;
      this.duration = 0.48 * fast;
      this.attackData.count = this.phase === 2 ? 5 : 3;
      game.audio.play('focus', this.pan());
    } else if (pick === 'spikes') {
      this.state = 'spikeWind';
      this.stateTime = 0;
      this.duration = 0.68 * fast;
      this.attackData.fired = false;
      this.attackData.points = this.makeSpikePoints();
      for (const p of this.attackData.points) {
        game.telegraphs.push({ x: p, y: game.floor, life: this.duration + 0.3, maxLife: this.duration + 0.3, type: 'spike' });
      }
      game.audio.play('focus', this.pan());
    } else if (pick === 'rain') {
      this.state = 'rainWind';
      this.stateTime = 0;
      this.duration = 0.58 * fast;
      this.attackData.fired = false;
      this.attackData.points = this.makeRainPoints();
      for (const p of this.attackData.points) {
        game.telegraphs.push({ x: p, y: game.floor, life: this.duration + 0.4, maxLife: this.duration + 0.4, type: 'rain' });
      }
      game.audio.play('focus', this.pan());
    }
  }

  startLunge() {
    this.state = 'lunge';
    this.stateTime = 0;
    this.echoTimer = 0;
    this.game.audio.play('slash', this.pan());
    this.game.spawnBossSlash(this.x + this.facing * 98 * this.s, this.chestY, this.facing, this.phase);
    this.game.addShake(4);
  }

  landSlam() {
    const game = this.game;
    this.state = 'slam';
    this.stateTime = 0;
    this.landed = true;
    this.vx = 0;
    game.addShake(17);
    game.hitstop = Math.max(game.hitstop, 0.045);
    game.flash = Math.max(game.flash, 0.16);
    game.audio.play('shock', this.pan());
    game.spawnSlamBurst(this.x, game.floor, this.phase);
    game.shockwaves.push({ x: this.x, y: game.floor, dir: -1, speed: 690 * this.s, life: 1.5, maxLife: 1.5, width: 30 * this.s, height: 44 * this.s, hit: false });
    game.shockwaves.push({ x: this.x, y: game.floor, dir: 1, speed: 690 * this.s, life: 1.5, maxLife: 1.5, width: 30 * this.s, height: 44 * this.s, hit: false });
    game.addRing(this.x, game.floor, 170 * this.s, 0.55, this.phase === 2 ? '#ff8b69' : '#f0dfb4', 3, 0.22);
  }

  fireVolley() {
    const game = this.game;
    const originX = this.x;
    const originY = this.chestY;
    const dx = game.player.x - originX;
    const dy = (game.player.y - 24 * this.s) - originY;
    const base = Math.atan2(dy, dx);
    const count = this.attackData.count || 3;
    const spread = 0.17;
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * spread;
      game.projectiles.push({
        kind: 'orb',
        x: originX + Math.cos(a) * 52 * this.s,
        y: originY + Math.sin(a) * 52 * this.s,
        vx: Math.cos(a) * 430 * this.s,
        vy: Math.sin(a) * 430 * this.s,
        r: 11 * this.s,
        life: 4.5,
        maxLife: 4.5,
        spin: rand(0, TAU),
        phase: this.phase
      });
    }
    game.audio.play('spike', this.pan());
    game.spawnMuzzle(originX + this.facing * 40 * this.s, originY, this.phase);
    game.addShake(3);
  }

  makeSpikePoints() {
    const game = this.game;
    const p = game.player.x;
    const points = [p];
    const count = this.phase === 2 ? 4 : 2;
    for (let i = 0; i < count; i++) {
      let x = p + choice([-1, 1]) * rand(105, 245) * this.s;
      x = clamp(x, game.left + 30, game.right - 30);
      if (!points.some(v => Math.abs(v - x) < 65 * this.s)) points.push(x);
    }
    return points;
  }

  makeRainPoints() {
    const game = this.game;
    const p = game.player.x;
    const points = [p];
    const count = this.phase === 2 ? 7 : 5;
    for (let i = 0; i < count; i++) {
      let x = p + choice([-1, 1]) * rand(55, 360) * this.s;
      x = clamp(x, game.left + 22, game.right - 22);
      points.push(x);
    }
    return points;
  }

  fireSpikes() {
    const game = this.game;
    for (const x of this.attackData.points) {
      game.spikes.push({
        x, t: 0, delay: 0.06 + Math.random() * 0.16,
        life: 0.78, hit: false, height: 104 * this.s, width: 30 * this.s
      });
    }
    game.audio.play('spike', this.pan());
    game.addShake(5);
  }

  fireRain() {
    const game = this.game;
    for (const x of this.attackData.points) {
      game.projectiles.push({
        kind: 'nail',
        x: x + rand(-6, 6) * this.s,
        y: -40 - rand(0, 160) * this.s,
        vx: rand(-28, 28) * this.s,
        vy: rand(950, 1150) * this.s,
        r: 8 * this.s,
        life: 3,
        maxLife: 3,
        spin: Math.PI / 2,
        phase: this.phase
      });
    }
    game.audio.play('dash', 0);
    game.spawnMuzzle(game.player.x, game.floor - 180 * this.s, this.phase);
  }

  damage(amount, hitX, hitY) {
    if (this.state === 'dead' || this.state === 'phase' || this.state === 'awaken') return false;
    const game = this.game;
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlash = 0.16;
    this.poise += 1;
    game.audio.play('hit', this.pan());
    game.spawnBossHit(hitX, hitY, this.phase);
    game.hitstop = Math.max(game.hitstop, 0.055);
    game.addShake(6);
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.startPhaseTwo();
    } else if (this.poise >= 9 && this.state !== 'stagger') {
      this.state = 'stagger';
      this.stateTime = 0;
      this.vx = 0;
      this.poise = 0;
      game.audio.play('roar', this.pan());
      game.spawnStagger(this.x, this.chestY, this.phase);
      game.addShake(8);
    }
    return true;
  }

  startPhaseTwo() {
    const game = this.game;
    this.phase = 2;
    this.state = 'phase';
    this.stateTime = 0;
    this.vx = 0;
    this.poise = 0;
    game.clearHazards();
    game.flash = 0.8;
    game.addShake(20);
    game.hitstop = Math.max(game.hitstop, 0.16);
    game.audio.play('phase', 0);
    game.spawnPhaseBurst(this.x, this.chestY);
    game.bossPhaseTwo = true;
    game.events?.phaseTwo?.();
  }

  die() {
    const game = this.game;
    this.hp = 0;
    this.state = 'dead';
    this.stateTime = 0;
    this.deathTimer = 0;
    this.vx = 0;
    this.vy = 0;
    game.clearHazards();
    game.flash = 0.55;
    game.addShake(24);
    game.hitstop = Math.max(game.hitstop, 0.13);
    game.audio.play('death', 0);
    game.spawnBossDeath(this.x, this.chestY, this.phase);
    game.addRing(this.x, this.chestY, 300 * this.s, 1.1, '#e9fff8', 4, 0.6);
  }

  pan() {
    return clamp((this.x / this.game.w - 0.5) * 2, -1, 1);
  }
}

export class Game {
  constructor(canvas, input, audio, renderer) {
    this.canvas = canvas;
    this.input = input;
    this.audio = audio;
    this.renderer = renderer;
    this.state = 'menu';
    this.w = 1;
    this.h = 1;
    this.dpr = 1;
    this.s = 1;
    this.floor = 0;
    this.left = 0;
    this.right = 0;
    this.time = 0;
    this.menuTime = 0;
    this.fightTime = 0;
    this.hitstop = 0;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.flash = 0;
    this.player = new Player(this);
    this.boss = new Boss(this);
    this.particles = [];
    this.afterimages = [];
    this.rings = [];
    this.projectiles = [];
    this.shockwaves = [];
    this.spikes = [];
    this.telegraphs = [];
    this.dustTimer = 0;
    this.masksLost = 0;
    this.maskGained = false;
    this.bossPhaseTwo = false;
    this.deathTimer = 0;
    this.winTimer = 0;
    this.events = {};
    this.canControl = false;
    this.endStats = null;
    this.ambientDust = [];
    for (let i = 0; i < 38; i++) {
      this.ambientDust.push({
        x: Math.random(), y: Math.random(), z: rand(0.2, 1),
        v: rand(0.001, 0.008), p: rand(0, TAU), s: rand(0.6, 2)
      });
    }
    this.resize(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio || 1, 2));
    this.setMenuScene();
  }

  resize(w, h, dpr) {
    const oldW = this.w;
    const oldH = this.h;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.s = clamp(Math.min(w, h * 1.15) / 820, 0.68, 1.3);
    const portrait = h > w * 1.08;
    this.portrait = portrait;
    this.floor = Math.round(h * (portrait ? 0.712 : 0.805));
    this.left = Math.round(w * (portrait ? 0.035 : 0.055));
    this.right = Math.round(w - w * (portrait ? 0.035 : 0.055));
    this.renderer.resize(w, h, dpr, this);

    if (oldW > 1 && oldH > 1) {
      if (this.player) {
        this.player.x = clamp((this.player.x / oldW) * w, this.left + 20, this.right - 20);
        this.player.y = Math.min(this.player.y, this.floor);
        this.player.prevFeet = this.player.y;
      }
      if (this.boss) {
        this.boss.x = clamp((this.boss.x / oldW) * w, this.left + this.boss.halfWidth, this.right - this.boss.halfWidth);
        this.boss.y = this.boss.state === 'leap' ? Math.min(this.boss.y, this.floor) : this.floor;
      }
    }

    if (this.state === 'menu') this.setMenuScene();
  }

  setMenuScene() {
    this.canControl = false;
    this.player.reset(this.w * 0.43, this.floor);
    this.player.facing = 1;
    this.boss.reset(this.w * 0.61, this.floor);
    this.boss.state = 'idle';
    this.boss.stateTime = 0;
    this.boss.duration = 999;
    this.boss.facing = -1;
    this.clearHazards();
    this.particles.length = 0;
    this.afterimages.length = 0;
    this.rings.length = 0;
    this.masksLost = 0;
    this.bossPhaseTwo = false;
    this.endStats = null;
    this.fightTime = 0;
    this.hitstop = 0;
    this.flash = 0;
    this.shake = 0;
  }

  start() {
    this.player.reset(this.w * 0.28, this.floor);
    this.player.facing = 1;
    this.boss.reset(this.w * 0.68, this.floor);
    this.boss.state = 'awaken';
    this.boss.stateTime = 0;
    this.boss.facing = -1;
    this.clearHazards();
    this.particles.length = 0;
    this.afterimages.length = 0;
    this.rings.length = 0;
    this.fightTime = 0;
    this.masksLost = 0;
    this.maskGained = false;
    this.bossPhaseTwo = false;
    this.hitstop = 0;
    this.shake = 0;
    this.flash = 0;
    this.deathTimer = 0;
    this.winTimer = 0;
    this.state = 'playing';
    this.canControl = true;
    this.audio.play('roar', -0.15);
    this.events?.start?.();
    this.spawnAmbientSoul(10);
  }

  returnToMenu() {
    this.state = 'menu';
    this.setMenuScene();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.canControl = false;
    this.input.clear();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.canControl = true;
  }

  clearHazards() {
    this.projectiles.length = 0;
    this.shockwaves.length = 0;
    this.spikes.length = 0;
    this.telegraphs.length = 0;
  }

  update(rawDt) {
    const dt = Math.min(rawDt, 1 / 30);
    this.time += dt;
    this.menuTime += dt;
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.shake = Math.max(0, this.shake - dt * 28);
    const shake = this.shake * this.shake * 0.09;
    this.shakeX = rand(-shake, shake);
    this.shakeY = rand(-shake, shake) * 0.7;

    if (this.hitstop > 0) {
      this.hitstop -= rawDt;
      this.updateParticles(dt * 0.2);
      return;
    }

    if (this.state === 'menu') {
      this.canControl = false;
      this.boss.stateTime += dt;
      this.player.time += dt;
      this.player.facing = 1;
      this.updateAmbient(dt);
      this.updateParticles(dt);
      this.updateRings(dt);
      this.updateAfterimages(dt);
      return;
    }

    if (this.state === 'paused') return;

    if (this.state === 'playing') {
      this.fightTime += dt;
      this.player.update(dt);
      this.boss.update(dt);
      this.updateProjectiles(dt);
      this.updateShockwaves(dt);
      this.updateSpikes(dt);
      this.updateTelegraphs(dt);
      this.checkContacts();
      this.updateAmbient(dt);
      this.updateParticles(dt);
      this.updateRings(dt);
      this.updateAfterimages(dt);
      if (this.player.hp <= 0 && this.state === 'playing') this.startDying();
      if (this.boss.state === 'dead' && this.boss.deathTimer > 1.55 && this.state === 'playing') {
        this.state = 'winning';
        this.canControl = false;
        this.winTimer = 0;
        this.input.clear();
        this.audio.play('victory', 0);
      }
      return;
    }

    if (this.state === 'dying') {
      this.deathTimer += dt;
      this.boss.update(dt);
      this.player.deathTimer += dt;
      this.updateParticles(dt);
      this.updateRings(dt);
      this.updateAfterimages(dt);
      this.updateProjectiles(dt);
      if (this.deathTimer > 1.65) {
        this.state = 'defeat';
        this.finishStats(false);
        this.events?.defeat?.();
      }
      return;
    }

    if (this.state === 'winning') {
      this.winTimer += dt;
      this.player.update(dt);
      this.boss.update(dt);
      this.updateParticles(dt);
      this.updateRings(dt);
      this.updateAfterimages(dt);
      if (this.winTimer > 1.35) {
        this.state = 'victory';
        this.finishStats(true);
        this.events?.victory?.();
      }
      return;
    }

    if (this.state === 'victory' || this.state === 'defeat') {
      this.updateParticles(dt);
      this.updateRings(dt);
      this.updateAfterimages(dt);
      if (this.state === 'victory') this.boss.update(dt);
    }
  }

  finishStats(won) {
    this.endStats = {
      won,
      time: formatTime(this.fightTime),
      hits: this.masksLost,
      bossHp: this.boss.hp,
      bossMax: this.boss.maxHp
    };
    this.canControl = false;
  }

  updateAmbient(dt) {
    this.dustTimer -= dt;
    if (this.dustTimer <= 0) {
      this.dustTimer = rand(0.14, 0.34);
      const x = rand(this.left, this.right);
      this.particles.push(new Particle(x, rand(this.h * 0.18, this.floor - 10), {
        vx: rand(-5, 8), vy: rand(-7, -1), life: rand(2.5, 5.5), size: rand(0.6, 2.1),
        color: 'rgba(158, 227, 217, 0.55)', type: 'dust', drag: 0.999, alpha: rand(0.2, 0.55), glow: true
      }));
    }
    for (const d of this.ambientDust) {
      d.y -= d.v * dt;
      d.x += Math.sin(this.time * 0.2 + d.p) * 0.00005;
      if (d.y < -0.05) { d.y = 1.05; d.x = Math.random(); }
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
  }

  updateRings(dt) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      r.life -= dt;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
  }

  updateAfterimages(dt) {
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const a = this.afterimages[i];
      a.life -= dt;
      if (a.life <= 0) this.afterimages.splice(i, 1);
    }
    if (this.afterimages.length > 30) this.afterimages.splice(0, this.afterimages.length - 30);
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.spin += dt * 5;
      if (p.kind === 'nail') p.vy += 300 * this.s * dt;
      if (p.life <= 0 || p.x < -80 || p.x > this.w + 80 || p.y > this.floor + 30 || p.y < -180) {
        if (p.kind === 'nail' && p.y >= this.floor - 12) {
          this.spawnNailImpact(p.x, this.floor);
          this.audio.play('spike', clamp((p.x / this.w - 0.5) * 2, -1, 1) * 0.6);
        }
        this.projectiles.splice(i, 1);
        continue;
      }
      if (p.kind === 'nail' && p.y >= this.floor - 4) {
        p.y = this.floor - 4;
        this.spawnNailImpact(p.x, this.floor);
        this.audio.play('spike', clamp((p.x / this.w - 0.5) * 2, -1, 1) * 0.6);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (p.kind === 'orb' && Math.random() < dt * 36) {
        this.particles.push(new Particle(p.x, p.y, {
          vx: rand(-14, 14), vy: rand(-14, 14), life: rand(0.18, 0.36), size: rand(1, 2.4),
          color: p.phase === 2 ? '#ff9a78' : '#a9f8ec', type: 'soul', drag: 0.9, glow: true
        }));
      }
    }
  }

  updateShockwaves(dt) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.x += s.dir * s.speed * dt;
      s.life -= dt;
      if (s.life <= 0 || s.x < this.left - 40 || s.x > this.right + 40) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      if (Math.random() < dt * 48) {
        this.particles.push(new Particle(s.x + rand(-12, 12) * this.s, this.floor, {
          vx: rand(-45, 45) * this.s, vy: rand(-120, -30) * this.s, gravity: 420 * this.s,
          life: rand(0.25, 0.6), size: rand(1, 3) * this.s, color: s.dir > 0 ? '#e8d8b0' : '#c8ece4',
          type: 'debris', drag: 0.98, floor: this.floor, bounce: 0.25
        }));
      }
    }
  }

  updateSpikes(dt) {
    for (let i = this.spikes.length - 1; i >= 0; i--) {
      const sp = this.spikes[i];
      sp.t += dt;
      if (sp.t > sp.life) this.spikes.splice(i, 1);
    }
  }

  updateTelegraphs(dt) {
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.life -= dt;
      if (t.life <= 0) this.telegraphs.splice(i, 1);
    }
  }

  checkContacts() {
    const p = this.player;
    const b = this.boss;
    if (p.dead) return;

    const hr = b.hurtRect();
    if (circleRect(p.x, p.hurtY, p.hurtRadius, hr.x, hr.y, hr.w, hr.h)) {
      if (p.hurt(1, b.x, b.chestY)) {
        this.spawnBossContact(p.x, p.hurtY);
      }
    }

    for (const proj of this.projectiles) {
      if (distance(p.x, p.hurtY, proj.x, proj.y) < p.hurtRadius + proj.r * 0.8) {
        if (p.hurt(1, proj.x, proj.y)) {
          this.spawnProjectileBurst(proj.x, proj.y, proj.phase);
          proj.life = 0;
        }
      }
    }

    for (const s of this.shockwaves) {
      if (s.hit) continue;
      const playerFeet = p.y;
      if (playerFeet > this.floor - 26 * this.s &&
          Math.abs(p.x - s.x) < s.width * 0.62 + p.hurtRadius &&
          p.hurt(1, s.x, this.floor)) {
        s.hit = true;
        this.spawnProjectileBurst(s.x, this.floor - 20 * this.s, 1);
      }
    }

    for (const sp of this.spikes) {
      if (sp.hit || sp.t < sp.delay + 0.1 || sp.t > sp.delay + 0.55) continue;
      if (Math.abs(p.x - sp.x) < (sp.width * 0.5 + p.hurtRadius) && p.y > this.floor - sp.height) {
        if (p.hurt(1, sp.x, this.floor)) {
          sp.hit = true;
          this.spawnProjectileBurst(p.x, p.hurtY, 1);
        }
      }
    }
  }

  resolvePlayerAttack(player) {
    const c = player.getAttackCircle();
    const boss = this.boss;
    const hr = boss.hurtRect();
    if (!player.attackHitBoss && boss.state !== 'dead' && boss.state !== 'phase' &&
        circleRect(c.x, c.y, c.r, hr.x, hr.y, hr.w, hr.h)) {
      player.attackHitBoss = true;
      const hitX = clamp(c.x, hr.x, hr.x + hr.w);
      const hitY = clamp(c.y, hr.y, hr.y + hr.h);
      if (boss.damage(player.nailDamage, hitX, hitY)) {
        player.soul = Math.min(SOUL_MAX, player.soul + 9);
        this.spawnSoulBurst(hitX, hitY, 3);
        this.addRing(hitX, hitY, 52 * this.s, 0.28, '#e7fff8', 2, 1);
        if (player.attackDir === 'down') {
          player.vy = -575 * this.s;
          player.jumps = Math.min(player.jumps, 1);
        } else {
          player.vx = -player.facing * 165 * this.s;
        }
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (distance(c.x, c.y, p.x, p.y) < c.r + p.r * 0.7) {
        this.spawnProjectileBurst(p.x, p.y, p.phase);
        this.projectiles.splice(i, 1);
        player.soul = Math.min(SOUL_MAX, player.soul + 2);
        this.audio.play('deflect', player.pan());
        this.addRing(p.x, p.y, 36 * this.s, 0.24, '#bffff2', 2, 1);
        if (player.attackDir === 'down') {
          player.vy = -520 * this.s;
          player.jumps = Math.min(player.jumps, 1);
        }
      }
    }

    if (player.attackDir === 'down' && player.attackHitShock) {
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const s = this.shockwaves[i];
        if (player.attackHitShock.has(s)) continue;
        if (Math.abs(player.x - s.x) < s.width + c.r && Math.abs(player.y - this.floor) < 80 * this.s) {
          player.attackHitShock.add(s);
          this.shockwaves.splice(i, 1);
          this.spawnProjectileBurst(s.x, this.floor - 26 * this.s, 1);
          player.soul = Math.min(SOUL_MAX, player.soul + 3);
          player.vy = -600 * this.s;
          player.jumps = Math.min(player.jumps, 1);
          this.audio.play('deflect', player.pan());
          this.addShake(4);
        }
      }
    }
  }

  startDying() {
    if (this.state !== 'playing') return;
    this.state = 'dying';
    this.canControl = false;
    this.deathTimer = 0;
    this.player.dead = true;
    this.player.deathTimer = 0;
    this.input.clear();
    this.clearHazards();
    this.flash = Math.max(this.flash, 0.35);
    this.addShake(15);
    this.spawnHurtBurst(this.player.x, this.player.hurtY, 0);
    for (let i = 0; i < 24; i++) {
      this.particles.push(new Particle(this.player.x + rand(-18, 18) * this.s, this.player.hurtY + rand(-30, 30) * this.s, {
        vx: rand(-180, 180) * this.s, vy: rand(-260, 40) * this.s, gravity: 430 * this.s,
        life: rand(0.8, 2.2), size: rand(1, 3.4) * this.s, color: '#d6fff4', type: 'soul',
        drag: 0.96, glow: true, floor: this.floor, bounce: 0.1
      }));
    }
  }

  addShake(amount) {
    this.shake = Math.min(32, Math.max(this.shake, amount));
  }

  addRing(x, y, maxR, life, color, width, yScale) {
    this.rings.push({ x, y, r: 0, maxR, life, maxLife: life, color, width, yScale });
  }

  spawnDust(x, y, count = 6, power = 1) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x + rand(-10, 10) * this.s, y, {
        vx: rand(-110, 110) * this.s * power,
        vy: rand(-145, -25) * this.s * power,
        gravity: 330 * this.s,
        life: rand(0.3, 0.7),
        size: rand(0.8, 2.6) * this.s,
        color: 'rgba(164, 216, 207, 0.55)',
        type: 'dust',
        drag: 0.94,
        alpha: rand(0.3, 0.7)
      }));
    }
  }

  spawnDashMotes(x, y, facing) {
    for (let i = 0; i < 14; i++) {
      this.particles.push(new Particle(x - facing * rand(4, 30) * this.s, y + rand(-22, 22) * this.s, {
        vx: -facing * rand(80, 320) * this.s,
        vy: rand(-40, 40) * this.s,
        life: rand(0.18, 0.42),
        size: rand(0.7, 2.1) * this.s,
        color: '#bffcf1', type: 'spark', drag: 0.9, glow: true
      }));
    }
  }

  spawnWingFlare(x, y, facing) {
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1;
      this.particles.push(new Particle(x + side * rand(8, 35) * this.s, y + rand(-18, 8) * this.s, {
        vx: side * rand(40, 170) * this.s,
        vy: rand(-260, -70) * this.s,
        gravity: 240 * this.s,
        life: rand(0.3, 0.65),
        size: rand(0.8, 2.6) * this.s,
        color: '#d8fff7', type: 'spark', drag: 0.94, glow: true
      }));
    }
    this.addRing(x, y + 6 * this.s, 50 * this.s, 0.3, '#bdfcf0', 2, 0.7);
  }

  spawnSlash(x, y, facing, dir, boss) {
    this.rings.push({ x, y, r: 0, maxR: 60 * this.s, life: 0.18, maxLife: 0.18, color: '#d6fff8', width: 2.5, yScale: 1, slash: true, facing, dir });
  }

  spawnBossSlash(x, y, facing, phase) {
    this.rings.push({
      x, y, r: 0, maxR: 145 * this.s, life: 0.3, maxLife: 0.3,
      color: phase === 2 ? '#ffb09a' : '#f0e6c8', width: 4, yScale: 1,
      slash: true, facing, dir: 'side', boss: true
    });
  }

  spawnMuzzle(x, y, phase) {
    for (let i = 0; i < 12; i++) {
      this.particles.push(new Particle(x, y, {
        vx: rand(-120, 120) * this.s, vy: rand(-120, 120) * this.s,
        life: rand(0.2, 0.48), size: rand(1, 3) * this.s,
        color: phase === 2 ? '#ff9a78' : '#b9fff2', type: 'soul', drag: 0.9, glow: true
      }));
    }
  }

  spawnFocusMote(x, y) {
    const a = rand(0, TAU);
    const r = rand(35, 70) * this.s;
    this.particles.push(new Particle(x + Math.cos(a) * r, y + Math.sin(a) * r, {
      vx: -Math.cos(a) * 90 * this.s, vy: -Math.sin(a) * 90 * this.s,
      life: 0.35, size: rand(0.8, 2.2) * this.s, color: '#c4fff4', type: 'soul', glow: true, drag: 0.98
    }));
  }

  cancelFocusMotes(x, y) {
    for (let i = 0; i < 4; i++) {
      this.particles.push(new Particle(x + rand(-20, 20) * this.s, y + rand(-30, 20) * this.s, {
        vx: rand(-40, 40) * this.s, vy: rand(-60, 10) * this.s,
        life: rand(0.2, 0.4), size: rand(0.6, 1.6) * this.s,
        color: '#8dbdb6', type: 'dust', drag: 0.95
      }));
    }
  }

  spawnHealBurst(x, y) {
    this.addRing(x, y, 76 * this.s, 0.55, '#c9fff5', 3, 1);
    for (let i = 0; i < 26; i++) {
      const a = rand(0, TAU);
      const r = rand(8, 38) * this.s;
      this.particles.push(new Particle(x + Math.cos(a) * r, y + Math.sin(a) * r, {
        vx: Math.cos(a) * rand(15, 80) * this.s, vy: Math.sin(a) * rand(15, 80) * this.s - 30 * this.s,
        life: rand(0.45, 1), size: rand(0.8, 2.6) * this.s,
        color: '#e8fff9', type: 'soul', drag: 0.93, glow: true
      }));
    }
  }

  spawnHurtBurst(x, y, dir) {
    this.addRing(x, y, 70 * this.s, 0.4, '#ffd6c8', 2.5, 1);
    for (let i = 0; i < 22; i++) {
      this.particles.push(new Particle(x, y, {
        vx: rand(-220, 220) * this.s + dir * 80 * this.s,
        vy: rand(-260, 90) * this.s,
        gravity: 520 * this.s,
        life: rand(0.3, 0.9), size: rand(1, 3.4) * this.s,
        color: i % 3 ? '#ffd9ca' : '#bdfcf0', type: 'spark', drag: 0.95,
        floor: this.floor, bounce: 0.2, glow: true
      }));
    }
  }

  spawnSoulBurst(x, y, count = 4) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x + rand(-8, 8) * this.s, y + rand(-8, 8) * this.s, {
        vx: rand(-60, 60) * this.s, vy: rand(-160, -20) * this.s,
        life: rand(0.4, 0.9), size: rand(1, 2.6) * this.s,
        color: '#d8fff7', type: 'soul', drag: 0.96, glow: true
      }));
    }
  }

  spawnAmbientSoul(count = 1) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(rand(this.left, this.right), rand(this.h * 0.25, this.floor), {
        vx: rand(-8, 8), vy: rand(-24, -8), life: rand(2.5, 5), size: rand(0.6, 2),
        color: 'rgba(150, 235, 223, 0.6)', type: 'soul', drag: 0.999, glow: true
      }));
    }
  }

  spawnBossHit(x, y, phase) {
    this.addRing(x, y, 46 * this.s, 0.25, phase === 2 ? '#ffc0a8' : '#fff1c8', 2.5, 1);
    for (let i = 0; i < 16; i++) {
      this.particles.push(new Particle(x, y, {
        vx: rand(-230, 230) * this.s, vy: rand(-210, 120) * this.s,
        gravity: 440 * this.s, life: rand(0.25, 0.62), size: rand(0.9, 2.8) * this.s,
        color: i % 4 === 0 ? (phase === 2 ? '#ff9c7d' : '#fff2cb') : '#d8fff6',
        type: 'spark', drag: 0.94, glow: true
      }));
    }
    for (let i = 0; i < 5; i++) {
      this.particles.push(new Particle(x + rand(-16, 16) * this.s, y + rand(-12, 12) * this.s, {
        vx: rand(-30, 30) * this.s, vy: rand(-70, -20) * this.s,
        life: rand(0.5, 1.1), size: rand(0.8, 2) * this.s,
        color: '#d9fff7', type: 'soul', drag: 0.97, glow: true
      }));
    }
  }

  spawnBossContact(x, y) {
    for (let i = 0; i < 10; i++) {
      this.particles.push(new Particle(x, y, {
        vx: rand(-160, 160) * this.s, vy: rand(-160, 60) * this.s,
        life: rand(0.2, 0.5), size: rand(0.8, 2.2) * this.s,
        color: '#d8fff7', type: 'spark', drag: 0.93, glow: true
      }));
    }
  }

  spawnProjectileBurst(x, y, phase) {
    this.addRing(x, y, 40 * this.s, 0.25, phase === 2 ? '#ffbba4' : '#c6fff3', 2, 1);
    for (let i = 0; i < 12; i++) {
      this.particles.push(new Particle(x, y, {
        vx: rand(-150, 150) * this.s, vy: rand(-150, 150) * this.s,
        life: rand(0.2, 0.5), size: rand(0.7, 2.4) * this.s,
        color: phase === 2 ? '#ffb39a' : '#c8fff5', type: 'spark', drag: 0.9, glow: true
      }));
    }
  }

  spawnSlamBurst(x, y, phase) {
    this.addRing(x, y, 230 * this.s, 0.65, phase === 2 ? '#ffb198' : '#f0e1b9', 4, 0.24);
    for (let i = 0; i < 34; i++) {
      const dir = i % 2 ? 1 : -1;
      this.particles.push(new Particle(x + rand(-18, 18) * this.s, y - rand(0, 6) * this.s, {
        vx: dir * rand(50, 340) * this.s, vy: rand(-440, -90) * this.s,
        gravity: 980 * this.s, life: rand(0.35, 1.05), size: rand(1, 4) * this.s,
        color: i % 5 === 0 ? '#e9d7ac' : '#9fc3bb', type: 'debris', drag: 0.985,
        floor: y, bounce: 0.25
      }));
    }
    for (let i = 0; i < 22; i++) {
      this.particles.push(new Particle(x + rand(-30, 30) * this.s, y, {
        vx: rand(-120, 120) * this.s, vy: rand(-120, -20) * this.s,
        life: rand(0.3, 0.8), size: rand(0.8, 3) * this.s,
        color: 'rgba(173, 216, 205, 0.45)', type: 'dust', drag: 0.95
      }));
    }
  }

  spawnNailImpact(x, y) {
    for (let i = 0; i < 12; i++) {
      this.particles.push(new Particle(x + rand(-5, 5) * this.s, y, {
        vx: rand(-90, 90) * this.s, vy: rand(-170, -20) * this.s,
        gravity: 620 * this.s, life: rand(0.2, 0.55), size: rand(0.7, 2.2) * this.s,
        color: i % 3 === 0 ? '#ffe4c1' : '#c8fff5', type: 'spark', drag: 0.96,
        floor: y, bounce: 0.2, glow: true
      }));
    }
    this.addRing(x, y, 32 * this.s, 0.2, '#bffff2', 1.5, 0.3);
  }

  spawnStagger(x, y, phase) {
    this.addRing(x, y, 150 * this.s, 0.65, phase === 2 ? '#ff987b' : '#fff0c5', 3, 1);
    for (let i = 0; i < 28; i++) {
      this.particles.push(new Particle(x + rand(-44, 44) * this.s, y + rand(-70, 70) * this.s, {
        vx: rand(-80, 80) * this.s, vy: rand(-100, 40) * this.s,
        life: rand(0.5, 1.2), size: rand(0.8, 2.4) * this.s,
        color: phase === 2 ? '#ffb39c' : '#fff0c6', type: 'soul', drag: 0.96, glow: true
      }));
    }
  }

  spawnPhaseBurst(x, y) {
    this.addRing(x, y, 360 * this.s, 1.2, '#ffc2ab', 5, 0.55);
    this.addRing(x, y, 220 * this.s, 0.8, '#fff2d0', 3, 1);
    for (let i = 0; i < 60; i++) {
      const a = rand(0, TAU);
      const speed = rand(80, 520) * this.s;
      this.particles.push(new Particle(x, y, {
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        gravity: 240 * this.s, life: rand(0.45, 1.6), size: rand(0.9, 3.6) * this.s,
        color: i % 4 === 0 ? '#ffd0bb' : (i % 3 === 0 ? '#ff8e6e' : '#d6fff7'),
        type: i % 5 === 0 ? 'soul' : 'spark', drag: 0.96, glow: true
      }));
    }
  }

  spawnBossDeath(x, y, phase) {
    this.addRing(x, y, 420 * this.s, 1.8, phase === 2 ? '#ffb8a0' : '#fff2cf', 6, 1);
    for (let i = 0; i < 90; i++) {
      const a = rand(0, TAU);
      const speed = rand(60, 640) * this.s;
      this.particles.push(new Particle(x + rand(-30, 30) * this.s, y + rand(-100, 40) * this.s, {
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        gravity: 180 * this.s, life: rand(0.7, 2.6), size: rand(0.9, 4) * this.s,
        color: i % 3 === 0 ? (phase === 2 ? '#ffbea8' : '#f7e9c8') : '#d8fff8',
        type: i % 4 === 0 ? 'debris' : 'soul', drag: 0.97, glow: true,
        floor: this.floor, bounce: 0.1
      }));
    }
  }
}
