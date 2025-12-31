// Ball Blast - Ultimate Edition with Currency & Upgrades

class BallBlast {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.loadGameData();

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.init();
        this.setupControls();
        this.setupUI();

        this.gameLoop();
        this.checkDailyReward();
    }

    loadGameData() {
        const saved = localStorage.getItem('ballBlastData');
        if (saved) {
            const data = JSON.parse(saved);
            this.coins = data.coins || 0;
            this.highScore = data.highScore || 0;
            this.bestLevel = data.bestLevel || 1;
            this.totalGames = data.totalGames || 0;
            this.lastDaily = data.lastDaily || 0;
            this.dailyStreak = data.dailyStreak || 0;
            this.achievements = data.achievements || {};
            // Upgrades
            this.upgrades = data.upgrades || {
                fireRate: 1,
                ballCount: 1,
                ballPower: 1,
                cannonSpeed: 1
            };
        } else {
            this.coins = 0;
            this.highScore = 0;
            this.bestLevel = 1;
            this.totalGames = 0;
            this.lastDaily = 0;
            this.dailyStreak = 0;
            this.achievements = {};
            this.upgrades = { fireRate: 1, ballCount: 1, ballPower: 1, cannonSpeed: 1 };
        }
    }

    saveGameData() {
        const data = {
            coins: this.coins,
            highScore: this.highScore,
            bestLevel: this.bestLevel,
            totalGames: this.totalGames,
            lastDaily: this.lastDaily,
            dailyStreak: this.dailyStreak,
            achievements: this.achievements,
            upgrades: this.upgrades
        };
        localStorage.setItem('ballBlastData', JSON.stringify(data));
    }

    checkDailyReward() {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const lastDate = new Date(this.lastDaily).setHours(0,0,0,0);
        const today = new Date(now).setHours(0,0,0,0);

        if (today > lastDate) {
            if (today - lastDate <= dayMs * 2) {
                this.dailyStreak++;
            } else {
                this.dailyStreak = 1;
            }

            const rewards = [40, 60, 80, 120, 160, 250, 400];
            const reward = rewards[Math.min(this.dailyStreak - 1, rewards.length - 1)];

            this.coins += reward;
            this.lastDaily = now;
            this.saveGameData();

            setTimeout(() => this.showDailyReward(reward, this.dailyStreak), 500);
        }
    }

    showDailyReward(amount, streak) {
        const popup = document.createElement('div');
        popup.className = 'daily-popup';
        popup.innerHTML = `
            <h2>DAILY REWARD!</h2>
            <p class="streak">Day ${streak} Streak!</p>
            <p class="reward">+${amount} coins</p>
            <button onclick="this.parentElement.remove()">COLLECT</button>
        `;
        document.body.appendChild(popup);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.groundY = this.canvas.height - 100;
    }

    init() {
        this.score = 0;
        this.level = 1;
        this.gameState = 'start';
        this.sessionCoins = 0;

        // Cannon - affected by upgrades
        this.cannon = {
            x: this.canvas.width / 2,
            y: this.groundY + 30,
            width: 60,
            height: 50,
            targetX: this.canvas.width / 2
        };

        // Balls - affected by upgrades
        this.balls = [];
        this.maxBalls = 2 + this.upgrades.ballCount;
        this.ballSpeed = 12;
        this.fireRate = Math.max(3, 10 - this.upgrades.fireRate);
        this.ballPower = this.upgrades.ballPower;
        this.fireCounter = 0;

        // Blocks
        this.blocks = [];
        this.blockSpeed = 0.3;

        // Particles & effects
        this.particles = [];
        this.powerUps = [];
        this.coinPopups = [];

        this.spawnWave();

        document.getElementById('highScore').textContent = `Best: ${this.highScore}`;
        this.updateCoinsDisplay();
    }

    setupControls() {
        let touching = false;

        const handleMove = (clientX) => {
            if (this.gameState !== 'playing') return;
            this.cannon.targetX = clientX;
        };

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            touching = true;
            handleMove(e.touches[0].clientX);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (touching) {
                handleMove(e.touches[0].clientX);
            }
        });

        this.canvas.addEventListener('touchend', () => {
            touching = false;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            handleMove(e.clientX);
        });
    }

    setupUI() {
        document.getElementById('startBtn').addEventListener('click', () => {
            this.startGame();
        });

        document.getElementById('restartBtn').addEventListener('click', () => {
            this.init();
            this.startGame();
        });

        document.getElementById('shopBtn').addEventListener('click', () => {
            this.openShop();
        });

        document.getElementById('closeShop').addEventListener('click', () => {
            this.closeShop();
        });
    }

    openShop() {
        document.getElementById('shop-screen').classList.remove('hidden');
        this.renderShop();
    }

    closeShop() {
        document.getElementById('shop-screen').classList.add('hidden');
    }

    renderShop() {
        const container = document.getElementById('shop-items');
        const upgradeDefs = [
            { id: 'fireRate', name: 'Fire Rate', desc: 'Shoot faster', basePrice: 100, max: 10 },
            { id: 'ballCount', name: 'Ball Count', desc: '+1 max balls', basePrice: 150, max: 8 },
            { id: 'ballPower', name: 'Ball Power', desc: '+1 damage', basePrice: 200, max: 10 },
            { id: 'cannonSpeed', name: 'Cannon Speed', desc: 'Move faster', basePrice: 80, max: 5 }
        ];

        let html = '<h3>UPGRADES</h3><div class="shop-grid">';
        for (const u of upgradeDefs) {
            const level = this.upgrades[u.id];
            const price = u.basePrice * level;
            const maxed = level >= u.max;

            html += `
                <div class="shop-item upgrade" onclick="game.buyUpgrade('${u.id}', ${price}, ${u.max})">
                    <p class="upgrade-name">${u.name}</p>
                    <p class="upgrade-desc">${u.desc}</p>
                    <div class="upgrade-bar">
                        <div class="upgrade-fill" style="width: ${(level / u.max) * 100}%"></div>
                    </div>
                    <p class="level">Lv. ${level}/${u.max}</p>
                    <p class="price">${maxed ? 'MAXED' : price + ' coins'}</p>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
        document.getElementById('shop-coins-display').textContent = this.coins;
    }

    buyUpgrade(id, price, max) {
        if (this.upgrades[id] >= max) {
            this.showNotification('Already maxed!');
            return;
        }

        if (this.coins >= price) {
            this.coins -= price;
            this.upgrades[id]++;
            this.saveGameData();
            this.updateCoinsDisplay();
            this.renderShop();
            this.showNotification('Upgraded!');
        } else {
            this.showNotification('Not enough coins!');
        }
    }

    showNotification(text) {
        const notif = document.createElement('div');
        notif.className = 'notification';
        notif.textContent = text;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 2000);
    }

    startGame() {
        this.gameState = 'playing';
        this.totalGames++;

        // Apply upgrades
        this.maxBalls = 2 + this.upgrades.ballCount;
        this.fireRate = Math.max(3, 10 - this.upgrades.fireRate);
        this.ballPower = this.upgrades.ballPower;

        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('game-over').classList.add('hidden');
        this.saveGameData();
    }

    spawnWave() {
        const cols = Math.floor(this.canvas.width / 80);
        const blockSize = 70;
        const spacing = (this.canvas.width - cols * blockSize) / (cols + 1);

        for (let i = 0; i < cols; i++) {
            if (Math.random() > 0.35) {
                const hp = Math.floor(15 + this.level * 8 + Math.random() * this.level * 15);
                this.blocks.push({
                    x: spacing + i * (blockSize + spacing),
                    y: -blockSize - Math.random() * 100,
                    width: blockSize,
                    height: blockSize,
                    hp: hp,
                    maxHp: hp,
                    color: this.getBlockColor(hp)
                });
            }
        }
    }

    getBlockColor(hp) {
        if (hp < 30) return '#4ecdc4';
        if (hp < 80) return '#45b7d1';
        if (hp < 150) return '#96c93d';
        if (hp < 300) return '#f9ca24';
        if (hp < 600) return '#ff9f43';
        if (hp < 1000) return '#ee5a24';
        return '#b71540';
    }

    fireBall() {
        if (this.balls.length < this.maxBalls) {
            const spread = (Math.random() - 0.5) * 0.4;
            this.balls.push({
                x: this.cannon.x,
                y: this.cannon.y - 30,
                radius: 8,
                vx: spread * this.ballSpeed,
                vy: -this.ballSpeed,
                color: '#fff',
                power: this.ballPower
            });
        }
    }

    addCoins(amount) {
        this.sessionCoins += amount;
        this.coins += amount;
        this.coinPopups.push({
            x: this.canvas.width - 80,
            y: 60,
            amount: amount,
            life: 1
        });
    }

    update() {
        if (this.gameState !== 'playing') return;

        // Move cannon with upgrade speed
        const moveSpeed = 0.1 + this.upgrades.cannonSpeed * 0.03;
        const dx = this.cannon.targetX - this.cannon.x;
        this.cannon.x += dx * moveSpeed;
        this.cannon.x = Math.max(this.cannon.width / 2, Math.min(this.canvas.width - this.cannon.width / 2, this.cannon.x));

        // Fire balls
        this.fireCounter++;
        if (this.fireCounter >= this.fireRate) {
            this.fireBall();
            this.fireCounter = 0;
        }

        // Update balls
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];
            ball.x += ball.vx;
            ball.y += ball.vy;

            // Wall bounce
            if (ball.x - ball.radius < 0 || ball.x + ball.radius > this.canvas.width) {
                ball.vx *= -1;
                ball.x = Math.max(ball.radius, Math.min(this.canvas.width - ball.radius, ball.x));
            }

            // Ceiling bounce
            if (ball.y - ball.radius < 0) {
                ball.vy *= -1;
                ball.y = ball.radius;
            }

            // Ground - remove ball
            if (ball.y > this.groundY) {
                this.balls.splice(i, 1);
                continue;
            }

            // Block collision
            for (let j = this.blocks.length - 1; j >= 0; j--) {
                const block = this.blocks[j];
                if (this.ballBlockCollision(ball, block)) {
                    // Damage block with ball power
                    block.hp -= ball.power;
                    block.color = this.getBlockColor(block.hp);
                    this.score += ball.power;

                    // Reflect ball
                    ball.vy *= -1;
                    ball.y += ball.vy * 2;

                    this.spawnParticles(ball.x, ball.y, block.color, 3);

                    // Destroy block
                    if (block.hp <= 0) {
                        this.spawnParticles(block.x + block.width / 2, block.y + block.height / 2, block.color, 15);
                        this.blocks.splice(j, 1);
                        this.score += 10;
                        this.addCoins(1);

                        // Power-up chance
                        if (Math.random() < 0.12) {
                            this.spawnPowerUp(block.x + block.width / 2, block.y + block.height / 2);
                        }
                    }
                    break;
                }
            }
        }

        // Update blocks - HARDER speed
        const speedMultiplier = 1 + this.level * 0.08;
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            const block = this.blocks[i];
            block.y += this.blockSpeed * speedMultiplier;

            // Game over check
            if (block.y + block.height > this.groundY) {
                this.gameOver();
                return;
            }
        }

        // Spawn new wave
        if (this.blocks.length === 0 || (this.blocks.every(b => b.y > 150) && Math.random() < 0.025)) {
            this.level++;
            this.blockSpeed = Math.min(2.5, 0.3 + this.level * 0.08);
            this.spawnWave();
        }

        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3;
            p.life--;
            return p.life > 0;
        });

        // Update power-ups
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const pu = this.powerUps[i];
            pu.y += 2;

            if (Math.abs(pu.x - this.cannon.x) < 40 && Math.abs(pu.y - this.cannon.y) < 40) {
                this.applyPowerUp(pu.type);
                this.powerUps.splice(i, 1);
                continue;
            }

            if (pu.y > this.canvas.height) {
                this.powerUps.splice(i, 1);
            }
        }

        // Coin popups
        this.coinPopups = this.coinPopups.filter(c => {
            c.y -= 1;
            c.life -= 0.03;
            return c.life > 0;
        });

        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = `Level ${this.level}`;
    }

    ballBlockCollision(ball, block) {
        const closestX = Math.max(block.x, Math.min(ball.x, block.x + block.width));
        const closestY = Math.max(block.y, Math.min(ball.y, block.y + block.height));
        const dx = ball.x - closestX;
        const dy = ball.y - closestY;
        return (dx * dx + dy * dy) < (ball.radius * ball.radius);
    }

    spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                radius: Math.random() * 4 + 2,
                color: color,
                life: 30
            });
        }
    }

    spawnPowerUp(x, y) {
        const types = ['multiball', 'speed', 'power', 'coins'];
        this.powerUps.push({
            x: x,
            y: y,
            type: types[Math.floor(Math.random() * types.length)],
            radius: 15
        });
    }

    applyPowerUp(type) {
        switch (type) {
            case 'multiball':
                this.maxBalls = Math.min(20, this.maxBalls + 3);
                break;
            case 'speed':
                this.fireRate = Math.max(2, this.fireRate - 2);
                break;
            case 'power':
                this.balls.forEach(b => b.power += 2);
                this.ballPower += 1;
                break;
            case 'coins':
                this.addCoins(10);
                break;
        }
        this.spawnParticles(this.cannon.x, this.cannon.y, '#ffd700', 20);
        this.showNotification(type.toUpperCase() + '!');
    }

    gameOver() {
        this.gameState = 'gameover';

        if (this.score > this.highScore) {
            this.highScore = this.score;
        }

        if (this.level > this.bestLevel) {
            this.bestLevel = this.level;
        }

        this.checkAchievements();
        this.saveGameData();

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('bestScore').textContent = this.highScore;
        document.getElementById('session-coins').textContent = `+${this.sessionCoins} coins`;
        document.getElementById('game-over').classList.remove('hidden');
    }

    checkAchievements() {
        const checks = [
            { id: 'first_game', cond: this.totalGames >= 1, reward: 30 },
            { id: 'score_500', cond: this.highScore >= 500, reward: 50 },
            { id: 'score_2000', cond: this.highScore >= 2000, reward: 150 },
            { id: 'score_10000', cond: this.highScore >= 10000, reward: 500 },
            { id: 'level_10', cond: this.bestLevel >= 10, reward: 100 },
            { id: 'level_25', cond: this.bestLevel >= 25, reward: 250 },
            { id: 'games_25', cond: this.totalGames >= 25, reward: 100 },
            { id: 'games_100', cond: this.totalGames >= 100, reward: 300 }
        ];

        for (const a of checks) {
            if (a.cond && !this.achievements[a.id]) {
                this.achievements[a.id] = true;
                this.coins += a.reward;
                this.showNotification(`Achievement! +${a.reward} coins`);
            }
        }
    }

    updateCoinsDisplay() {
        const el = document.getElementById('coins-display');
        if (el) el.textContent = this.coins;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw ground
        this.ctx.fillStyle = '#2a2a4e';
        this.ctx.fillRect(0, this.groundY, this.canvas.width, this.canvas.height - this.groundY);

        // Draw blocks
        this.blocks.forEach(block => {
            this.ctx.fillStyle = block.color;
            this.ctx.beginPath();
            this.ctx.roundRect(block.x, block.y, block.width, block.height, 10);
            this.ctx.fill();

            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(block.hp, block.x + block.width / 2, block.y + block.height / 2);
        });

        // Draw cannon
        this.ctx.save();
        this.ctx.translate(this.cannon.x, this.cannon.y);

        this.ctx.fillStyle = '#555';
        this.ctx.beginPath();
        this.ctx.moveTo(-30, 20);
        this.ctx.lineTo(-25, -20);
        this.ctx.lineTo(25, -20);
        this.ctx.lineTo(30, 20);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.fillStyle = '#777';
        this.ctx.fillRect(-8, -40, 16, 25);

        this.ctx.fillStyle = '#333';
        this.ctx.beginPath();
        this.ctx.arc(-20, 20, 12, 0, Math.PI * 2);
        this.ctx.arc(20, 20, 12, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();

        // Draw balls
        this.balls.forEach(ball => {
            this.ctx.fillStyle = ball.color;
            this.ctx.shadowColor = ball.color;
            this.ctx.shadowBlur = 10;
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });

        // Draw particles
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life / 30;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;

        // Draw power-ups
        this.powerUps.forEach(pu => {
            const colors = { multiball: '#4ecdc4', speed: '#ff6b6b', power: '#ffd700', coins: '#ffd700' };
            this.ctx.fillStyle = colors[pu.type] || '#ffd700';
            this.ctx.shadowColor = colors[pu.type];
            this.ctx.shadowBlur = 15;
            this.ctx.beginPath();
            this.ctx.arc(pu.x, pu.y, pu.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            const icons = { multiball: '+', speed: '>', power: '!', coins: '$' };
            this.ctx.fillStyle = '#000';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(icons[pu.type], pu.x, pu.y);
        });

        // Coin popups
        this.coinPopups.forEach(c => {
            this.ctx.globalAlpha = c.life;
            this.ctx.font = 'bold 20px Arial';
            this.ctx.fillStyle = '#ffd700';
            this.ctx.textAlign = 'right';
            this.ctx.fillText(`+${c.amount}`, c.x, c.y);
        });
        this.ctx.globalAlpha = 1;
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Polyfill for roundRect
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}

window.addEventListener('load', () => {
    window.game = new BallBlast();
});
