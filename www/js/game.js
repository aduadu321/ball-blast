class BallBlast {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.init();
        this.setupControls();
        this.setupUI();

        this.gameLoop();
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
        this.highScore = parseInt(localStorage.getItem('ballBlastHighScore')) || 0;

        // Cannon
        this.cannon = {
            x: this.canvas.width / 2,
            y: this.groundY + 30,
            width: 60,
            height: 50,
            targetX: this.canvas.width / 2
        };

        // Balls
        this.balls = [];
        this.maxBalls = 3;
        this.ballSpeed = 12;
        this.fireRate = 8;
        this.fireCounter = 0;

        // Blocks
        this.blocks = [];
        this.blockSpeed = 0.3;

        // Particles
        this.particles = [];

        // Power-ups
        this.powerUps = [];

        // Spawn initial blocks
        this.spawnWave();

        document.getElementById('highScore').textContent = `Best: ${this.highScore}`;
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
    }

    startGame() {
        this.gameState = 'playing';
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('game-over').classList.add('hidden');
    }

    spawnWave() {
        const cols = Math.floor(this.canvas.width / 80);
        const blockSize = 70;
        const spacing = (this.canvas.width - cols * blockSize) / (cols + 1);

        for (let i = 0; i < cols; i++) {
            if (Math.random() > 0.4) {
                const hp = Math.floor(10 + this.level * 5 + Math.random() * this.level * 10);
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
        if (hp < 20) return '#4ecdc4';
        if (hp < 50) return '#45b7d1';
        if (hp < 100) return '#96c93d';
        if (hp < 200) return '#f9ca24';
        if (hp < 500) return '#ff9f43';
        return '#ee5a24';
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
                color: '#fff'
            });
        }
    }

    update() {
        if (this.gameState !== 'playing') return;

        // Move cannon
        const dx = this.cannon.targetX - this.cannon.x;
        this.cannon.x += dx * 0.15;
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
                    // Damage block
                    block.hp--;
                    block.color = this.getBlockColor(block.hp);
                    this.score++;

                    // Reflect ball
                    ball.vy *= -1;
                    ball.y += ball.vy * 2;

                    // Spawn particles
                    this.spawnParticles(ball.x, ball.y, block.color, 3);

                    // Destroy block
                    if (block.hp <= 0) {
                        this.spawnParticles(block.x + block.width / 2, block.y + block.height / 2, block.color, 15);
                        this.blocks.splice(j, 1);
                        this.score += 10;

                        // Chance for power-up
                        if (Math.random() < 0.1) {
                            this.spawnPowerUp(block.x + block.width / 2, block.y + block.height / 2);
                        }
                    }
                    break;
                }
            }
        }

        // Update blocks
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            const block = this.blocks[i];
            block.y += this.blockSpeed;

            // Game over check
            if (block.y + block.height > this.groundY) {
                this.gameOver();
                return;
            }
        }

        // Spawn new wave if needed
        if (this.blocks.length === 0 || (this.blocks.every(b => b.y > 100) && Math.random() < 0.02)) {
            this.level++;
            this.blockSpeed = Math.min(1.5, 0.3 + this.level * 0.05);
            this.maxBalls = Math.min(10, 3 + Math.floor(this.level / 3));
            this.spawnWave();
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3;
            p.life--;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update power-ups
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const pu = this.powerUps[i];
            pu.y += 2;

            // Collect power-up
            if (Math.abs(pu.x - this.cannon.x) < 40 && Math.abs(pu.y - this.cannon.y) < 40) {
                this.applyPowerUp(pu.type);
                this.powerUps.splice(i, 1);
                continue;
            }

            // Remove if off screen
            if (pu.y > this.canvas.height) {
                this.powerUps.splice(i, 1);
            }
        }

        // Update UI
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
        const types = ['multiball', 'speed', 'power'];
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
                this.maxBalls = Math.min(15, this.maxBalls + 2);
                break;
            case 'speed':
                this.fireRate = Math.max(3, this.fireRate - 1);
                break;
            case 'power':
                // Damage all blocks
                this.blocks.forEach(b => {
                    b.hp = Math.max(1, b.hp - 10);
                    b.color = this.getBlockColor(b.hp);
                });
                break;
        }
        this.spawnParticles(this.cannon.x, this.cannon.y, '#ffd700', 20);
    }

    gameOver() {
        this.gameState = 'gameover';

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('ballBlastHighScore', this.highScore);
        }

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('bestScore').textContent = this.highScore;
        document.getElementById('game-over').classList.remove('hidden');
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw ground
        this.ctx.fillStyle = '#2a2a4e';
        this.ctx.fillRect(0, this.groundY, this.canvas.width, this.canvas.height - this.groundY);

        // Draw blocks
        this.blocks.forEach(block => {
            // Block body
            this.ctx.fillStyle = block.color;
            this.ctx.beginPath();
            this.ctx.roundRect(block.x, block.y, block.width, block.height, 10);
            this.ctx.fill();

            // Block HP text
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 18px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(block.hp, block.x + block.width / 2, block.y + block.height / 2);
        });

        // Draw cannon
        this.ctx.save();
        this.ctx.translate(this.cannon.x, this.cannon.y);

        // Cannon body
        this.ctx.fillStyle = '#555';
        this.ctx.beginPath();
        this.ctx.moveTo(-30, 20);
        this.ctx.lineTo(-25, -20);
        this.ctx.lineTo(25, -20);
        this.ctx.lineTo(30, 20);
        this.ctx.closePath();
        this.ctx.fill();

        // Cannon barrel
        this.ctx.fillStyle = '#777';
        this.ctx.fillRect(-8, -40, 16, 25);

        // Wheels
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
            this.ctx.fillStyle = '#ffd700';
            this.ctx.shadowColor = '#ffd700';
            this.ctx.shadowBlur = 15;
            this.ctx.beginPath();
            this.ctx.arc(pu.x, pu.y, pu.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // Icon
            this.ctx.fillStyle = '#000';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            const icons = { multiball: '+', speed: '>', power: '!' };
            this.ctx.fillText(icons[pu.type], pu.x, pu.y);
        });
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

// Start game
window.addEventListener('load', () => {
    new BallBlast();
});
