// Lumen Drift — every pixel the game draws: the starfield, the arena, the
// ships, the HUD and the title / pause / game-over screens. Canvas 2D only,
// with glow drawn through shadowBlur and layered gradients.
import { ARENA_WIDTH, ARENA_HEIGHT, PLAYER, COLORS, ENEMIES } from './config.js';
import { multiplier } from './world.js';

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

  for (const star of world.stars) {
    const drift = world.time * (2 + star.layer * 4);
    const x = (star.x + drift) % ARENA_WIDTH;
    const alpha = 0.35 + 0.3 * Math.sin(world.time * 1.5 + star.twinkle) + star.layer * 0.15;
    ctx.globalAlpha = Math.max(0.1, Math.min(1, alpha));
    ctx.fillStyle = '#cfe8ff';
    ctx.beginPath();
    ctx.arc(x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Arena frame.
  ctx.strokeStyle = 'rgba(87, 247, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, ARENA_WIDTH - 12, ARENA_HEIGHT - 12);
}

function drawPlayer(ctx, world) {
  const player = world.player;
  if (world.state === 'over' || world.state === 'title') return;
  const blink = player.invulnerable > 0 && Math.floor(world.time * 14) % 2 === 0;
  if (blink) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  glow(ctx, COLORS.player, 18);
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, 11);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-10, -11);
  ctx.closePath();
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
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
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
  for (const particle of world.particles) {
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
  for (const text of world.texts) {
    ctx.globalAlpha = Math.max(0, text.life / 0.9);
    ctx.font = `bold ${text.size}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, text.x, text.y);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, world) {
  ctx.textAlign = 'left';
  ctx.font = 'bold 26px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.text;
  glow(ctx, COLORS.player, 8);
  ctx.fillText(String(world.score).padStart(6, '0'), 22, 40);
  noGlow(ctx);
  ctx.font = '13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.dimText;
  ctx.fillText(`BEST ${Math.max(world.best, world.score)}`, 22, 60);
  const mult = multiplier(world);
  if (mult > 1) {
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = COLORS.shard;
    ctx.fillText(`x${mult}  COMBO ${world.combo}`, 22, 84);
  }

  // Wave, centered.
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`WAVE ${world.wave}`, ARENA_WIDTH / 2, 36);
  ctx.font = '13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.dimText;
  ctx.fillText(`${Math.max(0, world.enemies.length + world.waveQueue.length)} HOSTILES LEFT`, ARENA_WIDTH / 2, 56);

  // Hull hearts, top right.
  ctx.textAlign = 'right';
  for (let i = 0; i < PLAYER.maxHull; i += 1) {
    const x = ARENA_WIDTH - 28 - i * 30;
    const y = 32;
    ctx.fillStyle = i < world.player.hull ? '#ff5b7f' : 'rgba(255, 255, 255, 0.15)';
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-11, -2, -6, -10, 0, -4);
    ctx.bezierCurveTo(6, -10, 11, -2, 0, 8);
    ctx.fill();
    ctx.restore();
  }

  // Dash cooldown bar, bottom left.
  const dashReady = world.player.dashCooldown <= 0;
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = dashReady ? COLORS.player : COLORS.dimText;
  ctx.fillText(dashReady ? 'DASH READY [SPACE]' : 'DASH…', 22, ARENA_HEIGHT - 34);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(22, ARENA_HEIGHT - 28, 110, 8);
  const dashFill = dashReady ? 1 : 1 - world.player.dashCooldown / PLAYER.dashCooldown;
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(22, ARENA_HEIGHT - 28, 110 * dashFill, 8);

  // Nova charges, bottom right.
  ctx.textAlign = 'right';
  ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = world.player.nova > 0 ? COLORS.nova : COLORS.dimText;
  ctx.fillText(`NOVA [E]  ${'●'.repeat(world.player.nova)}${'○'.repeat(PLAYER.maxNova - world.player.nova)}`, ARENA_WIDTH - 22, ARENA_HEIGHT - 34);

  // Wave banner.
  if (world.bannerTimer > 0) {
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, world.bannerTimer);
    ctx.font = 'bold 34px "Segoe UI", system-ui, sans-serif';
    glow(ctx, COLORS.player, 16);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(world.banner, ARENA_WIDTH / 2, 120);
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
  ctx.fillStyle = 'rgba(4, 6, 16, 0.55)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  centerText(ctx, 'LUMEN DRIFT', 150, 'bold 72px "Segoe UI", system-ui, sans-serif', COLORS.text, COLORS.player);
  centerText(ctx, 'a neon arena survival — outlast the swarm, feed the light', 195, '18px "Segoe UI", system-ui, sans-serif', COLORS.dimText);
  const lines = [
    'WASD / ARROWS — steer the Lumen',
    'MOUSE — aim   ·   HOLD CLICK — fire',
    'SPACE — dash through danger   ·   E / RIGHT-CLICK — nova blast',
    'Chain kills to raise your multiplier. Three hull. No mercy.',
  ];
  lines.forEach((line, i) => {
    centerText(ctx, line, 268 + i * 30, '16px "Segoe UI", system-ui, sans-serif', COLORS.text);
  });
  const pulse = 0.72 + 0.28 * Math.sin(world.time * 3);
  ctx.globalAlpha = pulse;
  centerText(ctx, 'CLICK OR PRESS ENTER TO FLY', 440, 'bold 22px "Segoe UI", system-ui, sans-serif', COLORS.player, COLORS.player);
  ctx.globalAlpha = 1;
  if (world.best > 0) {
    centerText(ctx, `BEST SCORE  ${world.best}`, 485, '15px "Segoe UI", system-ui, sans-serif', COLORS.dimText);
  }
  centerText(ctx, 'P pause   ·   M mute   ·   R restart', 540, '13px "Segoe UI", system-ui, sans-serif', COLORS.dimText);
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(4, 6, 16, 0.6)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  centerText(ctx, 'PAUSED', 260, 'bold 54px "Segoe UI", system-ui, sans-serif', COLORS.text, COLORS.player);
  centerText(ctx, 'ESC / P to resume   ·   R to restart   ·   M to mute', 310, '17px "Segoe UI", system-ui, sans-serif', COLORS.dimText);
}

function drawGameOver(ctx, world) {
  ctx.fillStyle = 'rgba(10, 4, 12, 0.62)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  centerText(ctx, 'THE LIGHT FADES', 150, 'bold 56px "Segoe UI", system-ui, sans-serif', '#ff8fa3', '#ff4d8d');
  if (world.newBest) {
    centerText(ctx, '★ NEW BEST SCORE ★', 200, 'bold 20px "Segoe UI", system-ui, sans-serif', COLORS.shard, COLORS.shard);
  }
  centerText(ctx, `SCORE  ${world.score}`, 268, 'bold 40px "Segoe UI", system-ui, sans-serif', COLORS.text);
  centerText(ctx, `WAVE ${world.wave}  ·  BEST ${world.best}`, 312, '19px "Segoe UI", system-ui, sans-serif', COLORS.dimText);
  const pulse = 0.72 + 0.28 * Math.sin(world.time * 3);
  ctx.globalAlpha = pulse;
  centerText(ctx, 'PRESS R OR CLICK TO FLY AGAIN', 420, 'bold 22px "Segoe UI", system-ui, sans-serif', COLORS.player, COLORS.player);
  ctx.globalAlpha = 1;
}

export function render(ctx, world) {
  ctx.save();
  if (world.shake > 0) {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  drawStarfield(ctx, world);
  drawPickups(ctx, world);
  for (const enemy of world.enemies) drawEnemy(ctx, enemy);
  drawBullets(ctx, world);
  drawParticles(ctx, world);
  drawPlayer(ctx, world);
  drawTexts(ctx, world);
  ctx.restore();

  if (world.state === 'playing' || world.state === 'paused') drawHud(ctx, world);
  if (world.state === 'title') drawTitle(ctx, world);
  if (world.state === 'paused') drawPaused(ctx);
  if (world.state === 'over') drawGameOver(ctx, world);
}
