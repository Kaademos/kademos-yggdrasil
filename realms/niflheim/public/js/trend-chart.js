/**
 * Trend Chart Component
 * Renders a line chart showing pressure history
 */

class TrendChart {
  constructor(canvasId, maxPoints = 10) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`Canvas element with id "${canvasId}" not found`);
      return;
    }
    
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.maxPoints = maxPoints;
    this.data = [];
    this.padding = 40;
    this.maxValue = 1000;
    
    // Initialize with some default data
    this.initializeData();
  }

  /**
   * Initialize with default trend data
   */
  initializeData() {
    const now = Date.now();
    const baseValue = 500;
    
    for (let i = 0; i < this.maxPoints; i++) {
      const timestamp = now - (this.maxPoints - i - 1) * 60000; // 1 minute intervals
      const variation = (Math.random() - 0.5) * 40; // ±20 PSI variation
      this.data.push({
        timestamp: timestamp,
        value: Math.max(450, Math.min(550, baseValue + variation))
      });
    }
    
    this.render();
  }

  /**
   * Add new data point
   */
  addDataPoint(value, timestamp = Date.now()) {
    this.data.push({
      timestamp: timestamp,
      value: value
    });

    // Keep only last N points
    if (this.data.length > this.maxPoints) {
      this.data.shift();
    }

    this.render();
  }

  /**
   * Set all data points at once
   */
  setData(dataPoints) {
    this.data = dataPoints.slice(-this.maxPoints);
    this.render();
  }

  /**
   * Render the chart
   */
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    if (this.data.length === 0) return;

    // Draw grid
    this.drawGrid();

    // Draw line chart
    this.drawLineChart();

    // Draw data points
    this.drawDataPoints();

    // Draw axes
    this.drawAxes();
  }

  /**
   * Draw background grid
   */
  drawGrid() {
    const ctx = this.ctx;
    const chartWidth = this.width - 2 * this.padding;
    const chartHeight = this.height - 2 * this.padding;

    ctx.strokeStyle = 'rgba(107, 163, 199, 0.1)';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = this.padding + (chartHeight * i / 5);
      ctx.beginPath();
      ctx.moveTo(this.padding, y);
      ctx.lineTo(this.padding + chartWidth, y);
      ctx.stroke();
    }

    // Vertical grid lines
    for (let i = 0; i <= this.maxPoints - 1; i++) {
      const x = this.padding + (chartWidth * i / (this.maxPoints - 1));
      ctx.beginPath();
      ctx.moveTo(x, this.padding);
      ctx.lineTo(x, this.padding + chartHeight);
      ctx.stroke();
    }
  }

  /**
   * Draw line connecting data points
   */
  drawLineChart() {
    if (this.data.length < 2) return;

    const ctx = this.ctx;
    const chartWidth = this.width - 2 * this.padding;
    const chartHeight = this.height - 2 * this.padding;

    ctx.beginPath();
    
    this.data.forEach((point, index) => {
      const x = this.padding + (chartWidth * index / (this.maxPoints - 1));
      const y = this.padding + chartHeight - (chartHeight * point.value / this.maxValue);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    // Gradient stroke
    const gradient = ctx.createLinearGradient(this.padding, 0, this.padding + chartWidth, 0);
    gradient.addColorStop(0, '#00d4ff');
    gradient.addColorStop(1, '#0066cc');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fill area under line
    ctx.lineTo(this.padding + chartWidth, this.padding + chartHeight);
    ctx.lineTo(this.padding, this.padding + chartHeight);
    ctx.closePath();

    const fillGradient = ctx.createLinearGradient(0, this.padding, 0, this.padding + chartHeight);
    fillGradient.addColorStop(0, 'rgba(0, 212, 255, 0.2)');
    fillGradient.addColorStop(1, 'rgba(0, 212, 255, 0.05)');

    ctx.fillStyle = fillGradient;
    ctx.fill();
  }

  /**
   * Draw individual data points
   */
  drawDataPoints() {
    const ctx = this.ctx;
    const chartWidth = this.width - 2 * this.padding;
    const chartHeight = this.height - 2 * this.padding;

    this.data.forEach((point, index) => {
      const x = this.padding + (chartWidth * index / (this.maxPoints - 1));
      const y = this.padding + chartHeight - (chartHeight * point.value / this.maxValue);

      // Point glow
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 212, 255, 0.3)';
      ctx.fill();

      // Point
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#00d4ff';
      ctx.fill();
      ctx.strokeStyle = '#0a2540';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  /**
   * Draw axes and labels
   */
  drawAxes() {
    const ctx = this.ctx;
    const chartWidth = this.width - 2 * this.padding;
    const chartHeight = this.height - 2 * this.padding;

    // Y-axis labels (pressure values)
    ctx.font = '11px Courier New';
    ctx.fillStyle = '#6ba3c7';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 5; i++) {
      const value = Math.round(this.maxValue * (5 - i) / 5);
      const y = this.padding + (chartHeight * i / 5) + 4;
      ctx.fillText(`${value}`, this.padding - 8, y);
    }

    // X-axis label (time)
    ctx.textAlign = 'center';
    ctx.fillText('Time →', this.padding + chartWidth / 2, this.height - 5);

    // Y-axis label (PSI)
    ctx.save();
    ctx.translate(15, this.padding + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('PSI', 0, 0);
    ctx.restore();
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

// Export for use in main script
window.TrendChart = TrendChart;
