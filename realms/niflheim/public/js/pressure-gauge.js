/**
 * Pressure Gauge Component
 * Renders a circular gauge visualization using Canvas API
 */

class PressureGauge {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`Canvas element with id "${canvasId}" not found`);
      return;
    }
    
    this.ctx = this.canvas.getContext('2d');
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height - 20;
    this.radius = 120;
    this.value = 0;
    this.maxValue = 1000;
    this.targetValue = 0;
    this.animationFrame = null;
  }

  /**
   * Draw the gauge with current value
   */
  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw background arc
    this.drawArc(this.radius, 15, '#1a3a5c', 1);

    // Draw colored zones
    this.drawZones();

    // Draw tick marks
    this.drawTicks();

    // Draw needle
    this.drawNeedle();

    // Draw center cap
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#0a2540';
    ctx.fill();
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * Draw colored pressure zones
   */
  drawZones() {
    const ctx = this.ctx;
    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;
    const totalAngle = endAngle - startAngle;

    // Green zone (0-700 PSI)
    const green End = startAngle + (totalAngle * 0.7);
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.radius - 5, startAngle, greenEnd);
    ctx.strokeStyle = 'rgba(68, 255, 68, 0.3)';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Yellow zone (700-950 PSI)
    const yellowEnd = startAngle + (totalAngle * 0.95);
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.radius - 5, greenEnd, yellowEnd);
    ctx.strokeStyle = 'rgba(255, 255, 68, 0.3)';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Red zone (950-1000 PSI)
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.radius - 5, yellowEnd, endAngle);
    ctx.strokeStyle = 'rgba(255, 68, 68, 0.3)';
    ctx.lineWidth = 10;
    ctx.stroke();
  }

  /**
   * Draw arc helper
   */
  drawArc(radius, lineWidth, color, alpha) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, radius, Math.PI, 2 * Math.PI);
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /**
   * Draw tick marks
   */
  drawTicks() {
    const ctx = this.ctx;
    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;
    const totalAngle = endAngle - startAngle;
    const tickCount = 10;

    for (let i = 0; i <= tickCount; i++) {
      const angle = startAngle + (totalAngle * i / tickCount);
      const tickLength = i % 2 === 0 ? 15 : 10;
      
      const x1 = this.centerX + (this.radius - 20) * Math.cos(angle);
      const y1 = this.centerY + (this.radius - 20) * Math.sin(angle);
      const x2 = this.centerX + (this.radius - 20 - tickLength) * Math.cos(angle);
      const y2 = this.centerY + (this.radius - 20 - tickLength) * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#6ba3c7';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw labels for major ticks
      if (i % 2 === 0) {
        const label = (this.maxValue * i / tickCount).toString();
        const labelX = this.centerX + (this.radius - 45) * Math.cos(angle);
        const labelY = this.centerY + (this.radius - 45) * Math.sin(angle) + 5;
        
        ctx.font = '12px Courier New';
        ctx.fillStyle = '#6ba3c7';
        ctx.textAlign = 'center';
        ctx.fillText(label, labelX, labelY);
      }
    }
  }

  /**
   * Draw needle pointing to current value
   */
  drawNeedle() {
    const ctx = this.ctx;
    const percentage = Math.min(this.value / this.maxValue, 1);
    const angle = Math.PI + (Math.PI * percentage);

    const needleLength = this.radius - 30;
    const needleX = this.centerX + needleLength * Math.cos(angle);
    const needleY = this.centerY + needleLength * Math.sin(angle);

    // Needle shadow
    ctx.beginPath();
    ctx.moveTo(this.centerX + 2, this.centerY + 2);
    ctx.lineTo(needleX + 2, needleY + 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Needle
    ctx.beginPath();
    ctx.moveTo(this.centerX, this.centerY);
    ctx.lineTo(needleX, needleY);
    
    // Color based on zone
    let needleColor = '#44ff44'; // Green
    if (percentage > 0.95) {
      needleColor = '#ff4444'; // Red
    } else if (percentage > 0.7) {
      needleColor = '#ffff44'; // Yellow
    }
    
    ctx.strokeStyle = needleColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Needle tip
    ctx.beginPath();
    ctx.arc(needleX, needleY, 4, 0, Math.PI * 2);
    ctx.fillStyle = needleColor;
    ctx.fill();
  }

  /**
   * Update gauge value with animation
   */
  update(newValue) {
    this.targetValue = Math.max(0, Math.min(newValue, this.maxValue));
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    this.animate();
  }

  /**
   * Animate needle movement
   */
  animate() {
    const delta = this.targetValue - this.value;
    const step = delta * 0.1;

    if (Math.abs(delta) > 0.5) {
      this.value += step;
      this.draw();
      this.animationFrame = requestAnimationFrame(() => this.animate());
    } else {
      this.value = this.targetValue;
      this.draw();
    }
  }

  /**
   * Set value immediately without animation
   */
  setValue(value) {
    this.value = Math.max(0, Math.min(value, this.maxValue));
    this.targetValue = this.value;
    this.draw();
  }
}

// Export for use in main script
window.PressureGauge = PressureGauge;
