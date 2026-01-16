/**
 * SlitherStakes - Canvas Renderer
 * Handles all canvas drawing operations
 */

class Renderer {
    constructor(ctx, world) {
        this.ctx = ctx;
        this.world = world;
        this.gridSize = 50;
    }

    /**
     * Get scaled font size based on viewport width for mobile responsiveness
     * @param {number} baseSize - The base font size in pixels
     * @returns {number} The scaled font size
     */
    getScaledFontSize(baseSize) {
        const width = window.innerWidth;
        if (width <= 480) return Math.max(baseSize * 0.8, 12);
        if (width <= 768) return Math.max(baseSize * 0.9, 12);
        return baseSize;
    }

    renderGrid(camera) {
        const ctx = this.ctx;
        const gridSize = this.gridSize;

        ctx.strokeStyle = 'rgba(50, 50, 80, 0.3)';
        ctx.lineWidth = 1;

        // Calculate visible grid lines
        const startX = Math.floor(camera.x / gridSize) * gridSize - 1000;
        const startY = Math.floor(camera.y / gridSize) * gridSize - 1000;
        const endX = startX + 2000;
        const endY = startY + 2000;

        ctx.beginPath();

        // Vertical lines
        for (let x = startX; x <= endX; x += gridSize) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }

        // Horizontal lines
        for (let y = startY; y <= endY; y += gridSize) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }

        ctx.stroke();
    }

    renderBorder() {
        const ctx = this.ctx;

        // World border
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, this.world.width, this.world.height);

        // Warning zone (inner border)
        ctx.strokeStyle = 'rgba(255, 68, 68, 0.3)';
        ctx.lineWidth = 50;
        ctx.strokeRect(25, 25, this.world.width - 50, this.world.height - 50);
    }

    renderFood(food) {
        const ctx = this.ctx;

        for (const f of food) {
            // Glow effect
            const gradient = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius * 2);
            gradient.addColorStop(0, f.color);
            gradient.addColorStop(0.5, f.color + '88');
            gradient.addColorStop(1, 'transparent');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.radius * 2, 0, Math.PI * 2);
            ctx.fill();

            // Core
            ctx.fillStyle = f.color;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    renderSnakes(snakes, playerId) {
        // Sort so player is rendered last (on top)
        snakes.sort((a, b) => {
            if (a.id === playerId) return 1;
            if (b.id === playerId) return -1;
            return 0;
        });

        for (const snake of snakes) {
            if (!snake.alive) continue;
            this.renderSnake(snake, snake.id === playerId);
        }
    }

    renderSnake(snake, isPlayer) {
        const ctx = this.ctx;
        const segments = snake.segments || [];

        if (segments.length === 0) return;

        // Calculate segment radius based on length
        const baseRadius = 12 + Math.min(snake.length * 0.08, 8);

        // Render body segments (tail to head)
        for (let i = segments.length - 1; i >= 0; i--) {
            const seg = segments[i];
            const progress = i / segments.length;
            const radius = baseRadius * (0.6 + 0.4 * progress);

            // Gradient color from tail to head
            const hue = this.colorToHue(snake.color);
            const lightness = 30 + progress * 30;

            ctx.fillStyle = `hsl(${hue}, 70%, ${lightness}%)`;

            // Glow for player
            if (isPlayer) {
                ctx.shadowColor = snake.color;
                ctx.shadowBlur = 10;
            }

            ctx.beginPath();
            ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
        }

        // Render head
        this.renderHead(snake, isPlayer, baseRadius);
    }

    renderHead(snake, isPlayer, baseRadius) {
        const ctx = this.ctx;
        const headRadius = baseRadius * 1.3;

        // Head glow
        if (isPlayer || snake.boosting) {
            const glowRadius = headRadius * 2;
            const gradient = ctx.createRadialGradient(
                snake.x, snake.y, headRadius,
                snake.x, snake.y, glowRadius
            );
            gradient.addColorStop(0, snake.color + '44');
            gradient.addColorStop(1, 'transparent');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(snake.x, snake.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Head
        ctx.fillStyle = snake.color;
        ctx.beginPath();
        ctx.arc(snake.x, snake.y, headRadius, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        const eyeOffset = headRadius * 0.4;
        const eyeRadius = headRadius * 0.25;
        const pupilRadius = eyeRadius * 0.5;

        // Eye positions based on angle
        const angle = snake.angle || 0;
        const eyeAngle1 = angle + Math.PI / 4;
        const eyeAngle2 = angle - Math.PI / 4;

        const eye1X = snake.x + Math.cos(eyeAngle1) * eyeOffset;
        const eye1Y = snake.y + Math.sin(eyeAngle1) * eyeOffset;
        const eye2X = snake.x + Math.cos(eyeAngle2) * eyeOffset;
        const eye2Y = snake.y + Math.sin(eyeAngle2) * eyeOffset;

        // Eye whites
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeRadius, 0, Math.PI * 2);
        ctx.arc(eye2X, eye2Y, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        // Pupils (looking forward)
        const pupilOffset = eyeRadius * 0.3;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(
            eye1X + Math.cos(angle) * pupilOffset,
            eye1Y + Math.sin(angle) * pupilOffset,
            pupilRadius, 0, Math.PI * 2
        );
        ctx.arc(
            eye2X + Math.cos(angle) * pupilOffset,
            eye2Y + Math.sin(angle) * pupilOffset,
            pupilRadius, 0, Math.PI * 2
        );
        ctx.fill();

        // Name tag
        this.renderNameTag(snake, headRadius);

        // Boost indicator
        if (snake.boosting) {
            this.renderBoostTrail(snake, headRadius);
        }
    }

    renderNameTag(snake, headRadius) {
        const ctx = this.ctx;
        const nameY = snake.y - headRadius - 20;

        // Use scaled font sizes for mobile responsiveness
        const nameFontSize = this.getScaledFontSize(14);
        const lengthFontSize = this.getScaledFontSize(12);

        ctx.font = `bold ${nameFontSize}px Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillText(snake.name, snake.x + 1, nameY + 1);

        // Text
        ctx.fillStyle = '#fff';
        ctx.fillText(snake.name, snake.x, nameY);

        // Length indicator
        ctx.font = `${lengthFontSize}px Roboto, sans-serif`;
        ctx.fillStyle = '#00ff88';
        ctx.fillText(`${snake.length}`, snake.x, nameY + 16);
    }

    renderBoostTrail(snake, headRadius) {
        const ctx = this.ctx;
        const angle = snake.angle || 0;

        // Particles behind the head
        for (let i = 0; i < 5; i++) {
            const dist = headRadius + 10 + i * 8;
            const spread = (Math.random() - 0.5) * 0.5;
            const x = snake.x - Math.cos(angle + spread) * dist;
            const y = snake.y - Math.sin(angle + spread) * dist;
            const radius = 3 - i * 0.5;

            ctx.fillStyle = `rgba(255, 200, 100, ${0.5 - i * 0.1})`;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    colorToHue(hexColor) {
        // Simple hex to hue conversion
        const r = parseInt(hexColor.slice(1, 3), 16) / 255;
        const g = parseInt(hexColor.slice(3, 5), 16) / 255;
        const b = parseInt(hexColor.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;

        if (max !== min) {
            const d = max - min;
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return Math.round(h * 360);
    }

    /**
     * Render touch indicator showing touch position and line to snake head
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Input} input - Input handler instance
     * @param {Object} playerSnake - Player's snake object
     * @param {Object} camera - Camera object with x, y, zoom
     */
    renderTouchIndicator(ctx, input, playerSnake, camera) {
        if (!input.isTouching() || !playerSnake) return;

        const touchPos = input.getTouchPosition();

        // Convert touch screen coordinates to world coordinates
        const dpr = window.devicePixelRatio || 1;
        const worldTouchX = camera.x + (touchPos.x - ctx.canvas.width / 2 / dpr) / camera.zoom;
        const worldTouchY = camera.y + (touchPos.y - ctx.canvas.height / 2 / dpr) / camera.zoom;

        // Draw dashed line from snake head to touch point
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(playerSnake.x, playerSnake.y);
        ctx.lineTo(worldTouchX, worldTouchY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Draw semi-transparent circle at touch position
        ctx.save();
        const touchRadius = 30;
        const gradient = ctx.createRadialGradient(
            worldTouchX, worldTouchY, 0,
            worldTouchX, worldTouchY, touchRadius
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(worldTouchX, worldTouchY, touchRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw outer ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(worldTouchX, worldTouchY, touchRadius * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

export default Renderer;
