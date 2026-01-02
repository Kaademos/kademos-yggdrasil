/**
 * Niflheim SCADA - Main Application Logic
 */

// Global state
let gauge = null;
let chart = null;
let statusInterval = null;

/**
 * Initialize application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
  initializeSCADA();
  attachEventListeners();
  startStatusPolling();
});

/**
 * Initialize SCADA components
 */
function initializeSCADA() {
  // Initialize pressure gauge
  gauge = new PressureGauge('pressure-gauge');
  gauge.setValue(500);

  // Initialize trend chart
  chart = new TrendChart('trend-chart', 10);

  // Update header timestamp
  updateHeaderTimestamp();
  setInterval(updateHeaderTimestamp, 1000);

  // Fetch and display current status
  fetchSystemStatus();
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
  const form = document.getElementById('regulation-form');
  form.addEventListener('submit', handleRegulation);

  // Update gauge when pressure input changes
  const pressureInput = document.getElementById('pressure-input');
  pressureInput.addEventListener('input', (e) => {
    const value = parseInt(e.target.value) || 0;
    document.getElementById('pressure-value').textContent = value;
  });
}

/**
 * Handle regulation form submission
 */
async function handleRegulation(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  const data = {
    pressure: parseInt(formData.get('pressure')),
    temperature: parseInt(formData.get('temperature')),
    flowRate: parseInt(formData.get('flowRate'))
  };

  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'REGULATING...';

  try {
    const response = await fetch('/api/regulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      showSuccess('System regulated successfully');
      updateSystemState(result.systemState);
    } else if (response.status === 500 && result.crashReportId) {
      // CRASH DETECTED
      showCrashModal(result);
    } else {
      showError(result.error || 'Regulation failed');
    }
  } catch (error) {
    showError('Network error: Unable to communicate with system');
  } finally {
    button.disabled = false;
    button.textContent = 'REGULATE SYSTEM';
  }
}

/**
 * Fetch current system status
 */
async function fetchSystemStatus() {
  try {
    const response = await fetch('/api/status');
    if (response.ok) {
      const status = await response.json();
      updateSystemState(status);
    }
  } catch (error) {
    console.error('Failed to fetch system status:', error);
  }
}

/**
 * Update system state display
 */
function updateSystemState(state) {
  if (state.pressure !== undefined) {
    gauge.update(state.pressure);
    document.getElementById('pressure-value').textContent = state.pressure;
    document.getElementById('pressure-input').value = state.pressure;
    
    // Add to trend chart
    chart.addDataPoint(state.pressure);
  }

  if (state.doorStatus) {
    const doorElement = document.getElementById('door-status');
    const dot = doorElement.querySelector('.indicator-dot');
    
    if (state.doorStatus === 'LOCKED') {
      doorElement.innerHTML = '<span class="indicator-dot locked"></span> LOCKED';
    } else {
      doorElement.innerHTML = '<span class="indicator-dot unlocked"></span> UNLOCKED';
    }
  }

  if (state.timestamp) {
    document.getElementById('last-update').textContent = formatTimestamp(state.timestamp);
  }
}

/**
 * Start polling for status updates
 */
function startStatusPolling() {
  // Poll every 5 seconds
  statusInterval = setInterval(fetchSystemStatus, 5000);
}

/**
 * Update header timestamp
 */
function updateHeaderTimestamp() {
  const now = new Date();
  const hours = now.getUTCHours().toString().padStart(2, '0');
  const minutes = now.getUTCMinutes().toString().padStart(2, '0');
  const seconds = now.getUTCSeconds().toString().padStart(2, '0');
  
  document.getElementById('header-timestamp').textContent = `${hours}:${minutes}:${seconds} UTC`;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Show success message
 */
function showSuccess(message) {
  const messageElement = document.getElementById('control-message');
  messageElement.textContent = message;
  messageElement.className = 'control-message success';
  
  setTimeout(() => {
    messageElement.className = 'control-message';
  }, 5000);
}

/**
 * Show error message
 */
function showError(message) {
  const messageElement = document.getElementById('control-message');
  messageElement.textContent = message;
  messageElement.className = 'control-message error';
}

/**
 * View configuration file
 */
async function viewConfig(filename) {
  try {
    const response = await fetch(`/api/config/${filename}`);
    if (response.ok) {
      const content = await response.text();
      
      document.getElementById('config-modal-title').textContent = filename;
      document.getElementById('config-content').textContent = content;
      document.getElementById('config-modal').classList.add('active');
    } else {
      showError(`Failed to load ${filename}`);
    }
  } catch (error) {
    showError(`Network error loading ${filename}`);
  }
}

/**
 * Close config modal
 */
function closeConfigModal() {
  document.getElementById('config-modal').classList.remove('active');
}

/**
 * Show crash report modal
 */
function showCrashModal(crashData) {
  document.getElementById('crash-error-code').textContent = 
    crashData.errorCode || 'PRESSURE_OVERFLOW';
  document.getElementById('crash-timestamp').textContent = 
    crashData.timestamp || new Date().toISOString();
  document.getElementById('crash-report-id').textContent = 
    crashData.crashReportId;

  const downloadButton = document.getElementById('download-crash-report');
  downloadButton.onclick = () => downloadCrashReport(crashData.crashReportId);

  document.getElementById('crash-modal').classList.add('active');
}

/**
 * Download crash report
 */
async function downloadCrashReport(reportId) {
  try {
    const response = await fetch(`/api/crash-report/${reportId}`);
    if (response.ok) {
      const data = await response.json();
      
      // Create downloadable file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `niflheim-crash-${reportId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Also show preview
      showCrashReportPreview(data);
    } else {
      showError('Failed to download crash report');
    }
  } catch (error) {
    showError('Network error downloading crash report');
  }
}

/**
 * Show crash report preview (for user convenience)
 */
function showCrashReportPreview(data) {
  // Close crash modal and show config modal with crash report content
  document.getElementById('crash-modal').classList.remove('active');
  
  document.getElementById('config-modal-title').textContent = 'Crash Report Details';
  document.getElementById('config-content').textContent = JSON.stringify(data, null, 2);
  document.getElementById('config-modal').classList.add('active');
}

// Close modals when clicking outside
window.onclick = function(event) {
  const configModal = document.getElementById('config-modal');
  const crashModal = document.getElementById('crash-modal');
  
  if (event.target === configModal) {
    closeConfigModal();
  }
  if (event.target === crashModal) {
    crashModal.classList.remove('active');
  }
};

// Make functions globally available for onclick handlers
window.viewConfig = viewConfig;
window.closeConfigModal = closeConfigModal;
