/**
 * Realm Template Entry Point
 * 
 * This template provides a standardized structure for all Yggdrasil realms.
 * To use this template:
 * 1. Copy this directory to /realms/<realm-name>
 * 2. Update package.json (name, description)
 * 3. Update config/index.ts with realm-specific config
 * 4. Implement realm-specific routes
 * 5. Add your vulnerability implementation
 * 6. Update README.md with realm details
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { loadConfig, RealmConfig } from './config';
import { createHealthRouter } from './routes/health';
import { requestLogger, errorLogger } from './middleware/logging';
import { createPressureRouter } from './routes/pressure';
import { createConfigRouter } from './routes/config';
import { createCrashReportRouter } from './routes/crash-report';

/**
 * Create and configure Express application
 */
function createApp(config: RealmConfig): express.Application {
  const app = express();

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Logging middleware (in development mode)
  if (config.nodeEnv === 'development') {
    app.use(requestLogger);
  }

  // Serve static files from public directory
  app.use(express.static(path.join(__dirname, '../public')));

  // Mount health check router
  app.use(createHealthRouter(config));

  // Mount pressure regulator routes (vulnerable endpoint)
  app.use(createPressureRouter(config));

  // Mount config file router (M9)
  app.use(createConfigRouter());

  // Mount crash report router (M9)
  app.use(createCrashReportRouter());

  // M9: Root route now serves static index.html from public/
  // The static middleware above will handle this automatically
  // Keeping this route for explicit control if needed
  app.get('/', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  // Legacy inline HTML route (M9: Replaced with proper SCADA UI)
  app.get('/legacy', (_req: Request, res: Response) => {
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Niflheim Cryo-Facility - Yggdrasil</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          body {
            font-family: 'Courier New', 'Consolas', monospace;
            background: linear-gradient(135deg, #0a2540 0%, #1a3a5c 50%, #0d1b2a 100%);
            color: #00d4ff;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 2rem;
            position: relative;
            overflow: hidden;
          }

          body::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
              radial-gradient(circle at 20% 50%, rgba(0, 212, 255, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(100, 200, 255, 0.1) 0%, transparent 50%);
            pointer-events: none;
          }

          .container {
            background: rgba(10, 37, 64, 0.9);
            border: 2px solid rgba(0, 212, 255, 0.3);
            border-radius: 12px;
            padding: 2.5rem;
            max-width: 600px;
            width: 100%;
            box-shadow: 
              0 0 30px rgba(0, 212, 255, 0.2),
              inset 0 0 20px rgba(0, 212, 255, 0.05);
            position: relative;
            z-index: 1;
          }

          .header {
            text-align: center;
            margin-bottom: 2rem;
            border-bottom: 1px solid rgba(0, 212, 255, 0.2);
            padding-bottom: 1.5rem;
          }

          h1 {
            font-size: 2rem;
            color: #00d4ff;
            text-transform: uppercase;
            letter-spacing: 3px;
            margin-bottom: 0.5rem;
            text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
          }

          .subtitle {
            color: #6ba3c7;
            font-size: 0.9rem;
            letter-spacing: 1px;
          }

          .system-status {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(0, 212, 255, 0.2);
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 2rem;
          }

          .status-row {
            display: flex;
            justify-content: space-between;
            margin: 0.5rem 0;
            font-size: 0.95rem;
          }

          .status-label {
            color: #6ba3c7;
          }

          .status-value {
            color: #00d4ff;
            font-weight: bold;
          }

          .status-value.locked {
            color: #ff4444;
          }

          .status-value.unlocked {
            color: #44ff44;
          }

          .pressure-control {
            margin: 2rem 0;
          }

          .control-label {
            color: #00d4ff;
            font-size: 1rem;
            margin-bottom: 0.5rem;
            display: block;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .input-group {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1rem;
          }

          input[type="number"] {
            flex: 1;
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(0, 212, 255, 0.3);
            border-radius: 4px;
            padding: 0.75rem;
            color: #00d4ff;
            font-family: inherit;
            font-size: 1rem;
          }

          input[type="number"]:focus {
            outline: none;
            border-color: #00d4ff;
            box-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
          }

          button {
            background: linear-gradient(135deg, #0066cc 0%, #004499 100%);
            border: 1px solid rgba(0, 212, 255, 0.5);
            border-radius: 4px;
            padding: 0.75rem 1.5rem;
            color: #fff;
            font-family: inherit;
            font-size: 1rem;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 1px;
            transition: all 0.3s ease;
          }

          button:hover {
            background: linear-gradient(135deg, #0077dd 0%, #0055aa 100%);
            box-shadow: 0 0 15px rgba(0, 212, 255, 0.5);
          }

          button:active {
            transform: scale(0.98);
          }

          .hint {
            background: rgba(255, 200, 0, 0.1);
            border-left: 3px solid #ffc800;
            border-radius: 4px;
            padding: 1rem;
            margin-top: 2rem;
            font-size: 0.85rem;
            color: #ffc800;
          }

          .response {
            margin-top: 1rem;
            padding: 1rem;
            border-radius: 4px;
            font-size: 0.9rem;
            display: none;
          }

          .response.error {
            background: rgba(255, 68, 68, 0.1);
            border: 1px solid rgba(255, 68, 68, 0.3);
            color: #ff6b6b;
            display: block;
          }

          .response.success {
            background: rgba(68, 255, 68, 0.1);
            border: 1px solid rgba(68, 255, 68, 0.3);
            color: #66ff66;
            display: block;
          }

          .footer {
            text-align: center;
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid rgba(0, 212, 255, 0.2);
            font-size: 0.75rem;
            color: #6ba3c7;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❄️ Niflheim</h1>
            <div class="subtitle">Cryo-Stasis Facility - Realm 10</div>
          </div>

          <div class="system-status">
            <div class="status-row">
              <span class="status-label">Current Pressure:</span>
              <span class="status-value" id="current-pressure">50 PSI</span>
            </div>
            <div class="status-row">
              <span class="status-label">Door Status:</span>
              <span class="status-value locked" id="door-status">LOCKED</span>
            </div>
            <div class="status-row">
              <span class="status-label">Last Updated:</span>
              <span class="status-value" id="last-updated">--</span>
            </div>
          </div>

          <div class="pressure-control">
            <label class="control-label">Pressure Regulator</label>
            <div class="input-group">
              <input type="number" id="pressure-input" placeholder="Enter pressure (0-100 PSI)" value="50" min="0" max="100" step="1">
              <button id="update-btn">Update</button>
            </div>
            <div id="response" class="response"></div>
          </div>

          <div class="hint">
            💡 <strong>System Note:</strong> Cryo-chamber pressure must be maintained between 0-100 PSI. Values outside this range may trigger emergency protocols.
          </div>

          <div class="footer">
            Niflheim Cryo-Facility Control System v2.3.1
          </div>
        </div>

        <script>
          const pressureInput = document.getElementById('pressure-input');
          const updateBtn = document.getElementById('update-btn');
          const responseDiv = document.getElementById('response');
          const currentPressureSpan = document.getElementById('current-pressure');
          const doorStatusSpan = document.getElementById('door-status');
          const lastUpdatedSpan = document.getElementById('last-updated');

          // Fetch current status on load
          async function fetchStatus() {
            try {
              const response = await fetch('/api/status');
              const data = await response.json();
              updateUI(data);
            } catch (error) {
              console.error('Failed to fetch status:', error);
            }
          }

          function updateUI(state) {
            currentPressureSpan.textContent = state.currentPressure + ' PSI';
            doorStatusSpan.textContent = state.doorStatus;
            doorStatusSpan.className = 'status-value ' + state.doorStatus.toLowerCase();
            lastUpdatedSpan.textContent = new Date(state.timestamp).toLocaleTimeString();
          }

          async function updatePressure() {
            const pressure = parseFloat(pressureInput.value);
            responseDiv.style.display = 'none';

            try {
              const response = await fetch('/api/pressure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pressure }),
              });

              const data = await response.json();

              if (response.ok) {
                responseDiv.className = 'response success';
                responseDiv.textContent = data.message;
                responseDiv.style.display = 'block';
                updateUI(data.state);
              } else {
                responseDiv.className = 'response error';
                responseDiv.textContent = data.error || data.message || 'Unknown error occurred';
                responseDiv.style.display = 'block';
              }
            } catch (error) {
              responseDiv.className = 'response error';
              responseDiv.textContent = 'Network error: ' + error.message;
              responseDiv.style.display = 'block';
            }
          }

          updateBtn.addEventListener('click', updatePressure);
          pressureInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') updatePressure();
          });

          // Initial status fetch
          fetchStatus();
        </script>
      </body>
      </html>
    `);
  });

  // Error logging middleware
  if (config.nodeEnv === 'development') {
    app.use(errorLogger);
  }

  // Error handling middleware (must be last)
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
    
    res.status(statusCode).json({
      error: config.nodeEnv === 'development' ? err.message : 'Internal Server Error',
      ...(config.nodeEnv === 'development' && { stack: err.stack }),
    });
  });

  return app;
}

/**
 * Main entry point
 */
async function main() {
  const config = loadConfig();
  const app = createApp(config);

  app.listen(config.port, () => {
    console.info(`${config.realmName.toUpperCase()} Realm listening on port ${config.port}`);
    console.info(`Environment: ${config.nodeEnv}`);
    console.info(`Flag loaded: ${config.flag.substring(0, 20)}...`);
  });
}

// Start the server
main().catch((error) => {
  console.error(`Fatal error starting realm:`, error);
  process.exit(1);
});
