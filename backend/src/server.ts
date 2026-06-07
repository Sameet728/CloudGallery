import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectDB } from './config/db';
import { env } from './config/env';
import { initTelegramClient } from './services/telegramService';
import { initAIModels } from './services/aiService';

// Import Routes
import authRoutes from './routes/authRoutes';
import photoRoutes from './routes/photoRoutes';
import albumRoutes from './routes/albumRoutes';
import personRoutes from './routes/personRoutes';
import notificationRoutes from './routes/notificationRoutes';
import { startTrashCleanupJob } from './jobs/trashCleanup';

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'CloudGallery API is running' });
});

// Deep link fallback route
app.get('/s/:token', (req: Request, res: Response) => {
  const token = req.params.token;
  const appSchemeUrl = `mobile://shared-album/${token}`;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Opening CloudGallery...</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; text-align: center; padding: 40px 20px; background: #f2f2f7; color: #111; }
        .card { background: #fff; padding: 30px 20px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto; }
        h2 { margin-top: 0; }
        p { color: #666; line-height: 1.5; margin-bottom: 24px; }
        .btn { display: inline-block; background: #007AFF; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; }
      </style>
      <script>
        // Try to open the app immediately
        window.location.replace("${appSchemeUrl}");
        
        // Fallback if app doesn't open
        setTimeout(() => {
          document.getElementById('fallback').style.display = 'block';
        }, 1500);
      </script>
    </head>
    <body>
      <div class="card">
        <h2>CloudGallery</h2>
        <p>Attempting to open the shared album in your app...</p>
        <div id="fallback" style="display: none;">
          <p>If you don't have the app installed, please install it to view this shared album.</p>
          <!-- For now, we just give a generic message since there is no app store link -->
          <a href="${appSchemeUrl}" class="btn">Open App manually</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.use('/api/auth', authRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/people', personRoutes);
app.use('/api/notifications', notificationRoutes);

const PORT = env.PORT;

const startServer = async () => {
  if (env.MONGO_URI) {
    await connectDB();
  } else {
    console.warn('⚠️ MONGO_URI is not set. Skipping database connection.');
  }

  try {
    await initTelegramClient();
    await initAIModels();
    startTrashCleanupJob();
  } catch (error) {
    console.error('Failed to initialize Telegram client:', error);
  }
  
  app.listen(PORT, () => {
    console.log(`Server running in ${env.NODE_ENV} mode on port ${PORT}`);
  });
};

startServer();

