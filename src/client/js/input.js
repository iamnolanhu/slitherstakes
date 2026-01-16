/**
 * SlitherStakes - Input Handler
 * Manages mouse and keyboard input
 */

class Input {
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.camera = camera;

        // Mouse state
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDown = false;

        // Callbacks
        this.onMove = null;
        this.onBoost = null;

        // Bind methods
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);

        // Send rate limiting
        this.lastSendTime = 0;
        this.sendInterval = 1000 / 60; // 60 Hz
    }

    start() {
        // Mouse events
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);

        // Keyboard events
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);

        // Touch events
        this.canvas.addEventListener('touchstart', this.handleTouchStart);
        this.canvas.addEventListener('touchmove', this.handleTouchMove);
        this.canvas.addEventListener('touchend', this.handleTouchEnd);

        // Prevent context menu on canvas
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    stop() {
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    }

    handleMouseMove(e) {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        this.sendInput();
    }

    handleMouseDown(e) {
        if (e.button === 0 || e.button === 2) {
            this.mouseDown = true;
            if (this.onBoost) {
                this.onBoost(true);
            }
        }
    }

    handleMouseUp(e) {
        if (e.button === 0 || e.button === 2) {
            this.mouseDown = false;
            if (this.onBoost) {
                this.onBoost(false);
            }
        }
    }

    handleKeyDown(e) {
        if (e.code === 'Space' && !e.repeat) {
            this.mouseDown = true;
            if (this.onBoost) {
                this.onBoost(true);
            }
        }
    }

    handleKeyUp(e) {
        if (e.code === 'Space') {
            this.mouseDown = false;
            if (this.onBoost) {
                this.onBoost(false);
            }
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            this.mouseX = touch.clientX;
            this.mouseY = touch.clientY;
            this.sendInput();
        }

        // Two-finger touch for boost
        if (e.touches.length >= 2) {
            this.mouseDown = true;
            if (this.onBoost) {
                this.onBoost(true);
            }
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            this.mouseX = touch.clientX;
            this.mouseY = touch.clientY;
            this.sendInput();
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        if (e.touches.length < 2) {
            this.mouseDown = false;
            if (this.onBoost) {
                this.onBoost(false);
            }
        }
    }

    sendInput() {
        const now = performance.now();
        if (now - this.lastSendTime < this.sendInterval) {
            return;
        }
        this.lastSendTime = now;

        if (this.onMove) {
            // Convert screen coordinates to world coordinates
            const worldX = this.camera.x + (this.mouseX - this.canvas.width / 2) / this.camera.zoom;
            const worldY = this.camera.y + (this.mouseY - this.canvas.height / 2) / this.camera.zoom;

            this.onMove({ x: worldX, y: worldY });
        }
    }
}

export default Input;
