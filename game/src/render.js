// Lumen Drift v2 — every pixel the game draws: the starfield, the arena,
// the ships, the HUD and the title / pause / game-over screens. Canvas 2D
// only, with glow drawn through shadowBlur and layered gradients. The main
// loop sets the devicePixelRatio transform before each render, so all
// drawing here works in logical arena pixels.
import { ARENA_WIDTH, ARENA_HEIGHT, PLAYER, COLORS, WEAPONS } from './config.js';
import { multiplier, comboFraction, weaponProgress } from './world.js';
import { shakeOffset } from './juice.js';
import { easeOutCubic, easeOutBack, clamp } from './random.js';

const FONT = '"Segoe UI", system-ui, sans-serif';

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx) {
  ctx.shadowBlur = 0;
}

function drawStarfield(ctx, world) {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Soft nebulae: three fixed radial gradients for depth.
  const nebulae = [
    { x: 180, y: 130, r: 220, color: 'rgba(64, 40, 140, 0.35)' },
    { x: 780, y: 430, r: 260, color: 'rgba(16, 90, 120, 0.32)' },
    { x: 560, y: 90, r: 170, color: 'rgba(140, 30, 90, 0.22)' },
  ];
  for (const nebula of nebulae) {
    const gradient = ctx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.r);
    gradient.addColorStop(0, nebula.color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  }

  // Stars drift with time and parallax against the player's position.
  for (const star of world.stars) {
    const drift = world.time * (2 + star.layer * 4);
    let x = (star.x + drift - world.player.x * 0.02 * star.layer) % ARENA_WIDTH;
    if (x < 0) x += ARENA_WIDTH;
    const y = (star.y - world.player.y * 0.01 * star.layer + ARENA_HEIGHT) % ARENA_HEIGHT;
    const alpha = 0.35 + 0.3 * Math.sin(world.time * 1.5 + star.twinkle) + star.layer * 0.15;
    ctx.globalAlpha = Math.max(0.1, Math.min(1, alpha));
    ctx.fillStyle = '#cfe8ff';
    ctx.beginPath();
    ctx.arc(x, y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Arena frame.
  ctx.strokeStyle = 'rgba(87, 247, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, ARENA_WIDTH - 12, ARENA_HEIGHT - 12);
}

function drawRings(ctx, world) {
  for (const ringItem of world.juice.rings) {
    const t = ringItem.life / ringItem.maxLife;
    ctx.globalAlpha = Math.max(0, t);
    ctx.strokeStyle = ringItem.color;
    ctx.lineWidth = Math.max(1, ringItem.width * t);
    glow(ctx, ringItem.color, 12);
    ctx.beginPath();
    ctx.arc(ringItem.x, ringItem.y, ringItem.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  noGlow(ctx);
}

function drawShipShape(ctx) {
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, 11);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-10, -11);
  ctx.closePath();
}

function drawGhosts(ctx, world) {
  for (const ghostItem of world.juice.ghosts) {
    ctx.save();
    ctx.translate(ghostItem.x, ghostItem.y);
    ctx.rotate(ghostItem.angle);
    ctx.globalAlpha = (ghostItem.life / ghostItem.maxLife) * 0.45;
    ctx.fillStyle = COLORS.player;
    drawShipShape(ctx);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(ctx, world) {
  const player = world.player;
  if (world.state === 'over' || world.state === 'title') return;
  const blink = player.invulnerable > 0 && Math.floor(world.time * 14) % 2 === 0;
  if (blink) return;

  // Soft halo so the ship reads at a glance against the starfield.
  const halo = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, 30);
  halo.addColorStop(0, 'rgba(87, 247, 255, 0.20)');
  halo.addColorStop(1, 'rgba(87, 247, 255, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 30, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  // Squash and stretch along the dash direction while dashing.
  if (player.dashTimer > 0) ctx.scale(1.28, 0.78);

  // Engine flame, flickering with the clock.
  if (player.thrust > 0.2) {
    const flicker = 0.8 + 0.4 * Math.sin(world.time * 42);
    const len = (10 + player.thrust * 12) * flicker;
    glow(ctx, '#ffb02e', 10);
    ctx.fillStyle = 'rgba(255, 176, 46, 0.9)';
    ctx.beginPath();
    ctx.moveTo(-10, 5);
    ctx.lineTo(-10 - len, 0);
    ctx.lineTo(-10, -5);
    ctx.closePath();
    ctx.fill();
  }

  glow(ctx, COLORS.player, 18);
  ctx.fillStyle = COLORS.player;
  drawShipShape(ctx);
  ctx.fill();
  noGlow(ctx);
  ctx.fillStyle = COLORS.playerCore;
  ctx.beginPath();
  ctx.arc(3, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(ctx, enemy) {
  const color = enemy.flash > 0 ? '#ffffff' : COLORS[enemy.kind];
  const pop = easeOutBack(clamp(enemy.spawnT / 0.25, 0, 1));
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.scale(pop, pop);
  glow(ctx, color, 14);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  if (enemy.kind === 'drifter') {
    ctx.rotate(enemy.angle);
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-11, 10);
    ctx.lineTo(-11, -10);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === 'weaver') {
    ctx.rotate(enemy.wobble);
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(11, 0);
    ctx.lineTo(0, 14);
    ctx.lineTo(-11, 0);
    ctx.closePath();
    ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = COLORS.background;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'splitter') {
    ctx.rotate(enemy.wobble * 0.5);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * 20;
      const py = Math.sin(a) * 20;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = COLORS.background;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'charger') {
    ctx.rotate(enemy.angle);
    if (enemy.mode === 'telegraph') {
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(enemy.modeTimer * 40);
      ctx.fillRect(10, -2, 220, 4);
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.moveTo(17, 0);
    ctx.lineTo(-8, 12);
    ctx.lineTo(-13, 0);
    ctx.lineTo(-8, -12);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === 'warden') {
    ctx.rotate(enemy.wobble * 0.3);
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? 48 : 26;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = COLORS.background;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 10 + 3 * Math.sin(enemy.wobble * 2), 0, Math.PI * 2);
    ctx.fill();
    // Health arc above the warden.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 54, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (enemy.hp / enemy.maxHp));
    ctx.stroke();
  }
  ctx.restore();
}

function drawBullets(ctx, world) {
  for (const bullet of world.bullets) {
    const color = bullet.friendly ? COLORS.bullet : COLORS.enemyBullet;
    // Trail: a short streak back along the velocity, so shots read as motion.
    const tailX = bullet.x - bullet.vx * 0.035;
    const tailY = bullet.y - bullet.vy * 0.035;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    glow(ctx, color, 10);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.friendly ? 4 : 5, 0, Math.PI * 2);
    ctx.fill();
  }
  noGlow(ctx);
}

function drawPickups(ctx, world) {
  for (const pickup of world.pickups) {
    const color = COLORS[pickup.kind];
    const pulse = 1 + 0.18 * Math.sin(world.time * 6 + pickup.x);
    // A shard near expiry blinks so the player knows to hurry.
    if (pickup.life < 2 && Math.floor(world.time * 8) % 2 === 0) continue;
    glow(ctx, color, 12);
    ctx.fillStyle = color;
    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    ctx.scale(pulse, pulse);
    if (pickup.kind === 'shard') {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
    } else if (pickup.kind === 'cell') {
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillRect(-8, -3, 16, 6);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.background;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  noGlow(ctx);
}

function drawParticles(ctx, world) {
  for (const particle of world.juice.particles) {
    if (!particle.active) continue;
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTexts(ctx, world) {
  ctx.textAlign = 'center';
  for (const text of world.juice.texts) {
    ctx.globalAlpha = Math.max(0, text.life / text.maxLife);
    ctx.font = `bold ${text.size}px ${FONT}`;
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, text.x, text.y);
  }
  ctx.globalAlpha = 1;
}

function drawVignette(ctx, world) {
  const hurt = world.juice.flash * 0.4;
  const lowHull = world.player.hull === 1 && (world.state === 'playing' || world.state === 'dying')
    ? 0.1 + 0.06 * Math.sin(world.time * 4)
    : 0;
  const alpha = Math.min(0.5, hurt + lowHull);
  if (alpha <= 0.01) return;
  const gradient = ctx.createRadialGradient(
    ARENA_WIDTH / 2, ARENA_HEIGHT / 2, ARENA_HEIGHT * 0.45,
    ARENA_WIDTH / 2, ARENA_HEIGHT / 2, ARENA_HEIGHT * 0.85,
  );
  gradient.addColorStop(0, 'rgba(255, 40, 70, 0)');
  gradient.addColorStop(1, `rgba(255, 40, 70, ${alpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
}

function drawHud(ctx, world, showBanner = true) {
  // Score, popping briefly on every gain.
  const pop = 1 + 0.22 * easeOutCubic(world.juice.scorePop);
  ctx.save();
  ctx.translate(22, 40);
  ctx.scale(pop, pop);
  ctx.textAlign = 'left';
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillStyle = COLORS.text;
  glow(ctx, COLORS.player, 8);
  ctx.fillText(String(world.score).padStart(6, '0'), 0, 0);
  ctx.restore();
  noGlow(ctx);
  ctx.textAlign = 'left';
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = COLORS.dimText;
  ctx.fillText(`BEST ${Math.max(world.best, world.score)}`, 22, 60);

  // Combo with its countdown bar.
  const mult = multiplier(world);
  if (mult > 1 || world.combo > 0) {
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillStyle = COLORS.shard;
    ctx.fillText(mult > 1 ? `x${mult}  COMBO ${world.combo}` : `COMBO ${world.combo}`, 22, 84);
    ctx.fillStyle = 'rgba(255, 224, 102, 0.25)';
    ctx.fillRect(22, 90, 120, 5);
    ctx.fillStyle = COLORS.shard;
    ctx.fillRect(22, 90, 120 * comboFraction(world), 5);
  }

  // Wave, centered.
  ctx.textAlign = 'center';
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`WAVE ${world.wave}`, ARENA_WIDTH / 2, 36);
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = COLORS.dimText;
  ctx.fillText(`${Math.max(0, world.enemies.length + world.waveQueue.length)} HOSTILES LEFT`, ARENA_WIDTH / 2, 56);

  // Boss bar while the Warden lives.
  const warden = world.enemies.find((e) => e.kind === 'warden');
  if (warden) {
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = COLORS.warden;
    ctx.fillText('THE WARDEN', ARENA_WIDTH / 2, 78);
    ctx.fillStyle = 'rgba(255, 122, 217, 0.25)';
    ctx.fillRect(ARENA_WIDTH / 2 - 150, 84, 300, 7);
    ctx.fillStyle = COLORS.warden;
    ctx.fillRect(ARENA_WIDTH / 2 - 150, 84, 300 * (warden.hp / warden.maxHp), 7);
  }

  // Hull hearts, top right. Empty hearts keep a white outline, so the
  // maximum is readable as well as the current hull.
  ctx.textAlign = 'right';
  for (let i = 0; i < PLAYER.maxHull; i += 1) {
    const x = ARENA_WIDTH - 28 - i * 30;
    const y = 32;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-11, -2, -6, -10, 0, -4);
    ctx.bezierCurveTo(6, -10, 11, -2, 0, 8);
    if (i < world.player.hull) {
      ctx.fillStyle = COLORS.danger;
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Dash cooldown bar, bottom left.
  const dashReady = world.player.dashCooldown <= 0;
  ctx.textAlign = 'left';
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillStyle = dashReady ? COLORS.player : COLORS.dimText;
  ctx.fillText(dashReady ? 'DASH READY [SPACE]' : 'DASH…', 22, ARENA_HEIGHT - 34);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(22, ARENA_HEIGHT - 28, 110, 8);
  const dashFill = dashReady ? 1 : 1 - world.player.dashCooldown / PLAYER.dashCooldown;
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(22, ARENA_HEIGHT - 28, 110 * dashFill, 8);

  // Weapon meter, bottom center: level name and shard pips to the next gun.
  const progress = weaponProgress(world);
  ctx.textAlign = 'center';
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillStyle = COLORS.shard;
  ctx.fillText(`GUN ${progress.name}${progress.needed === null ? ' — MAX' : ''}`, ARENA_WIDTH / 2, ARENA_HEIGHT - 34);
  if (progress.needed !== null) {
    const prevNeeded = progress.level === 0 ? 0 : WEAPONS[progress.level].shardsNeeded;
    const span = progress.needed - prevNeeded;
    const have = progress.shards - prevNeeded;
    for (let i = 0; i < span; i += 1) {
      const px = ARENA_WIDTH / 2 - (span - 1) * 7 + i * 14;
      const py = ARENA_HEIGHT - 20;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = i < have ? COLORS.shard : 'rgba(255, 224, 102, 0.25)';
      ctx.fillRect(-3.5, -3.5, 7, 7);
      ctx.restore();
    }
  }

  // Nova charges, bottom right.
  ctx.textAlign = 'right';
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillStyle = world.player.nova > 0 ? COLORS.nova : COLORS.dimText;
  ctx.fillText(`NOVA [E]  ${'●'.repeat(world.player.nova)}${'○'.repeat(PLAYER.maxNova - world.player.nova)}`, ARENA_WIDTH - 22, ARENA_HEIGHT - 34);

  // Wave banner, easing in with an overshoot. The title screen hides it so
  // it never collides with the title text.
  if (showBanner && world.bannerTimer > 0) {
    const age = 2.2 - world.bannerTimer;
    const scale = age < 0.35 ? easeOutBack(clamp(age / 0.35, 0, 1)) : 1;
    ctx.save();
    ctx.translate(ARENA_WIDTH / 2, 120);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, world.bannerTimer);
    ctx.font = `bold 34px ${FONT}`;
    glow(ctx, COLORS.player, 16);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(world.banner, 0, 0);
    ctx.restore();
    noGlow(ctx);
    ctx.globalAlpha = 1;
  }
}

function centerText(ctx, text, y, font, color, glowColor) {
  ctx.textAlign = 'center';
  ctx.font = font;
  if (glowColor) glow(ctx, glowColor, 18);
  ctx.fillStyle = color;
  ctx.fillText(text, ARENA_WIDTH / 2, y);
  noGlow(ctx);
}

function drawTitle(ctx, world) {
  // A vertical scrim: dark where the text sits, clear at the top and
  // bottom so the demo run and the HUD show through around it.
  const scrim = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
  scrim.addColorStop(0, 'rgba(4, 6, 16, 0)');
  scrim.addColorStop(0.13, 'rgba(4, 6, 16, 0)');
  scrim.addColorStop(0.22, 'rgba(4, 6, 16, 0.74)');
  scrim.addColorStop(0.78, 'rgba(4, 6, 16, 0.74)');
  scrim.addColorStop(0.88, 'rgba(4, 6, 16, 0)');
  scrim.addColorStop(1, 'rgba(4, 6, 16, 0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  centerText(ctx, 'LUMEN DRIFT', 150, `bold 72px ${FONT}`, COLORS.text, COLORS.player);
  centerText(ctx, 'a neon arena survival — outlast the swarm, feed the light', 195, `18px ${FONT}`, COLORS.dimText);
  centerText(ctx, 'Survive the waves. Beat the Warden every 5th wave. One run, no continues.', 232, `15px ${FONT}`, COLORS.shard);
  const lines = [
    'WASD / ARROWS — steer the Lumen',
    'MOUSE — aim   ·   HOLD CLICK — fire',
    'SPACE — dash through danger   ·   E / RIGHT-CLICK — nova blast',
    'Shards upgrade your gun. Chain kills to raise your multiplier.',
  ];
  lines.forEach((line, i) => {
    centerText(ctx, line, 278 + i * 30, `16px ${FONT}`, COLORS.text);
  });
  const pulse = 0.72 + 0.28 * Math.sin(world.time * 3);
  ctx.globalAlpha = pulse;
  centerText(ctx, 'CLICK OR PRESS ENTER TO FLY', 442, `bold 22px ${FONT}`, COLORS.player, COLORS.player);
  ctx.globalAlpha = 1;
  if (world.best > 0) {
    centerText(ctx, `BEST SCORE  ${world.best}`, 485, `15px ${FONT}`, COLORS.dimText);
  }
  centerText(ctx, 'P pause   ·   M mute   ·   R restart', 540, `13px ${FONT}`, COLORS.dimText);
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(4, 6, 16, 0.6)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  centerText(ctx, 'PAUSED', 240, `bold 54px ${FONT}`, COLORS.text, COLORS.player);
  centerText(ctx, 'WASD steer   ·   Mouse aim   ·   Hold click fire', 300, `17px ${FONT}`, COLORS.dimText);
  centerText(ctx, 'SPACE dash   ·   E nova   ·   M mute', 330, `17px ${FONT}`, COLORS.dimText);
  centerText(ctx, 'ESC / P to resume   ·   R to restart', 380, `bold 19px ${FONT}`, COLORS.text);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function drawGameOver(ctx, world) {
  ctx.fillStyle = 'rgba(10, 4, 12, 0.62)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  centerText(ctx, 'THE LIGHT FADES', 140, `bold 56px ${FONT}`, '#ff8fa3', '#ff4d8d');
  if (world.newBest) {
    centerText(ctx, '★ NEW BEST SCORE ★', 188, `bold 20px ${FONT}`, COLORS.shard, COLORS.shard);
  }
  centerText(ctx, `SCORE  ${world.score}`, 258, `bold 40px ${FONT}`, COLORS.text);
  centerText(ctx, `WAVE ${world.wave}  ·  KILLS ${world.kills}  ·  BEST COMBO x${world.maxCombo}`, 302, `19px ${FONT}`, COLORS.dimText);
  centerText(ctx, `SURVIVED ${formatTime(world.runTime)}  ·  BEST ${world.best}`, 332, `19px ${FONT}`, COLORS.dimText);
  const pulse = 0.72 + 0.28 * Math.sin(world.time * 3);
  ctx.globalAlpha = pulse;
  centerText(ctx, 'PRESS R OR CLICK TO FLY AGAIN', 430, `bold 22px ${FONT}`, COLORS.player, COLORS.player);
  ctx.globalAlpha = 1;
}

// mode 'title' draws the demo world with a dimmed HUD and the title screen
// over it; mode 'game' draws the run and its state overlays.
export function render(ctx, world, mode = 'game') {
  ctx.save();
  if (!world.reduceMotion) {
    const offset = shakeOffset(world.juice, world.time);
    ctx.translate(offset.x, offset.y);
  }
  drawStarfield(ctx, world);
  drawRings(ctx, world);
  drawPickups(ctx, world);
  for (const enemy of world.enemies) drawEnemy(ctx, enemy);
  drawBullets(ctx, world);
  drawGhosts(ctx, world);
  drawParticles(ctx, world);
  drawPlayer(ctx, world);
  drawTexts(ctx, world);
  ctx.restore();

  drawVignette(ctx, world);

  if (mode === 'title') {
    ctx.save();
    ctx.globalAlpha = 0.55;
    drawHud(ctx, world, false);
    ctx.restore();
    drawTitle(ctx, world);
    return;
  }

  if (world.state === 'playing' || world.state === 'paused' || world.state === 'dying') drawHud(ctx, world);
  if (world.state === 'paused') drawPaused(ctx);
  if (world.state === 'over') drawGameOver(ctx, world);
}
