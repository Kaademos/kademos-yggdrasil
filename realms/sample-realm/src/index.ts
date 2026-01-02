import express, { Request, Response } from 'express';

interface Config {
  port: number;
  flag: string;
  nodeEnv: string;
}

function loadConfig(): Config {
  const port = parseInt(process.env.PORT || '3000', 10);
  const flag = process.env.FLAG || 'YGGDRASIL{SAMPLE:00000000-0000-0000-0000-000000000000}';
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('Invalid PORT configuration');
  }

  return { port, flag, nodeEnv };
}

async function main() {
  const config = loadConfig();
  const app = express();

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', realm: 'sample' });
  });

  app.get('/', (_req: Request, res: Response) => {
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sample Realm - Yggdrasil</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .container {
            text-align: center;
            background: rgba(0, 0, 0, 0.3);
            padding: 3rem;
            border-radius: 10px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          }
          h1 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
          }
          p {
            font-size: 1.2rem;
            margin: 1rem 0;
          }
          .hint {
            margin-top: 2rem;
            font-size: 0.9rem;
            opacity: 0.8;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🌌 Welcome to Sample Realm</h1>
          <p>You have successfully reached the sample realm of Yggdrasil!</p>
          <p>This is a test realm for M0 development.</p>
          <div class="hint">
            <p>💡 Hint: The flag is waiting at <code>/flag</code></p>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  app.get('/flag', (_req: Request, res: Response) => {
    res.status(200).json({
      message: 'Congratulations! You found the flag.',
      flag: config.flag,
    });
  });

  app.listen(config.port, () => {
    console.info(`Sample Realm listening on port ${config.port}`);
    console.info(`Environment: ${config.nodeEnv}`);
  });
}

main().catch((error) => {
  console.error('Fatal error starting Sample Realm:', error);
  process.exit(1);
});
