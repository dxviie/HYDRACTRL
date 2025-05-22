/**
 * Physics simulation for the XY pad
 * Uses velocity, friction, and boundaries to create realistic movement
 */
export class XYPhysics {
  constructor(width, height, options = {}) {
    // Dimensions
    this.width = width;
    this.height = height;

    // Position and velocity
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;

    // Position history for velocity calculation
    this.historySize = options.historySize ?? 5;  // Number of points to keep
    this.xHistory = [];
    this.yHistory = [];
    this.timeHistory = [];

    // Physics parameters (with defaults)
    this.friction = options.friction ?? 0.1;  // Friction (0-1), higher means more friction
    this.bounce = options.bounce ?? 0.7;     // Bounciness (0-1)
    this.velocityLimit = options.velocityLimit ?? 2000; // Max velocity to prevent instability

    // Animation frame handling
    this.animationFrameId = null;
    this.lastTime = null;
    this.isRunning = false;
  }

  // Update physics state
  update(deltaTime) {
    // Convert deltaTime to seconds for more intuitive physics
    const dt = deltaTime / 1000;

    // Apply friction (1 - friction to invert the behavior)
    const frictionFactor = Math.pow(1 - this.friction, dt * 60); // Scale friction by framerate
    this.vx *= frictionFactor;
    this.vy *= frictionFactor;

    // Limit velocity to prevent instability
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > this.velocityLimit) {
      const scale = this.velocityLimit / speed;
      this.vx *= scale;
      this.vy *= scale;
    }

    // Update position
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Handle boundaries with bounce
    if (this.x < 0) {
      this.x = 0;
      this.vx = -this.vx * this.bounce;
    } else if (this.x > this.width) {
      this.x = this.width;
      this.vx = -this.vx * this.bounce;
    }

    if (this.y < 0) {
      this.y = 0;
      this.vy = -this.vy * this.bounce;
    } else if (this.y > this.height) {
      this.y = this.height;
      this.vy = -this.vy * this.bounce;
    }

    // Check if movement has effectively stopped
    const isMoving = Math.abs(this.vx) > 0.01 || Math.abs(this.vy) > 0.01;
    return isMoving;
  }

  // Start physics simulation
  start(callback) {
    if (this.isRunning) return;
    
    // Calculate initial velocities from position history
    this.calculateInitialVelocities();
    
    this.isRunning = true;
    this.lastTime = performance.now();

    const animate = (currentTime) => {
      if (!this.isRunning) return;

      // Calculate delta time, capped at 32ms (roughly 30fps minimum)
      const deltaTime = Math.min(currentTime - this.lastTime, 32);
      this.lastTime = currentTime;

      // Update physics and check if still moving
      const isMoving = this.update(deltaTime);

      // Call callback with normalized coordinates
      callback(this.x / this.width, this.y / this.height);

      // Stop animation if movement has effectively stopped
      if (!isMoving) {
        this.stop();
        return;
      }

      // Request next frame with timing for 60fps
      const timeToNext = Math.max(0, 16 - (performance.now() - currentTime));
      this.animationFrameId = setTimeout(() => {
        requestAnimationFrame(animate);
      }, timeToNext);
    };

    requestAnimationFrame(animate);
  }

  // Stop physics simulation
  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      clearTimeout(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // Set current position
  setPosition(x, y) {
    this.x = x * this.width;
    this.y = y * this.height;
  }

  // Set X position and record history
  setPositionX(x) {
    const now = performance.now();
    this.x = x * this.width;
    
    this.xHistory.push({ pos: this.x, time: now });
    if (this.xHistory.length > this.historySize) {
      this.xHistory.shift();
    }
  }

  // Set Y position and record history
  setPositionY(y) {
    const now = performance.now();
    this.y = y * this.height;
    
    this.yHistory.push({ pos: this.y, time: now });
    if (this.yHistory.length > this.historySize) {
      this.yHistory.shift();
    }
  }

  // Calculate initial velocities from position history
  calculateInitialVelocities() {
    if (this.xHistory.length >= 2) {
      const xLatest = this.xHistory[this.xHistory.length - 1];
      const xPrev = this.xHistory[0];
      const dt = (xLatest.time - xPrev.time) / 1000;
      if (dt > 0) {
        this.vx = (xLatest.pos - xPrev.pos) / dt;
      }
    }

    if (this.yHistory.length >= 2) {
      const yLatest = this.yHistory[this.yHistory.length - 1];
      const yPrev = this.yHistory[0];
      const dt = (yLatest.time - yPrev.time) / 1000;
      if (dt > 0) {
        this.vy = (yLatest.pos - yPrev.pos) / dt;
      }
    }

    // Clear history after calculating velocities
    this.xHistory = [];
    this.yHistory = [];
  }

  // Update physics parameters
  updateParams(params) {
    if (params.friction !== undefined) this.friction = params.friction;
    if (params.bounce !== undefined) this.bounce = params.bounce;
  }
}
