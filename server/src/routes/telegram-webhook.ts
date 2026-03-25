import { Router, Request, Response } from 'express';
import { telegramBot } from '../services/telegram-bot.js';

export const telegramWebhookRoutes = Router();

/**
 * Telegram webhook endpoint
 * Receives updates from Telegram Bot API
 */
telegramWebhookRoutes.post('/webhook', async (_req: Request, res: Response) => {
  // Telegram sends updates to this endpoint
  // The telegram-bot library handles parsing and routing internally
  // We just need to acknowledge receipt
  res.sendStatus(200);
});

/**
 * Manual webhook test endpoint
 */
telegramWebhookRoutes.get('/test', (_req: Request, res: Response) => {
  if (telegramBot.isInitialized()) {
    res.json({ 
      status: 'ok', 
      message: 'Telegram bot is running',
      initialized: true 
    });
  } else {
    res.status(503).json({ 
      status: 'error', 
      message: 'Telegram bot not initialized',
      initialized: false,
      hint: 'Check TELEGRAM_BOT_TOKEN environment variable'
    });
  }
});

export default telegramWebhookRoutes;
