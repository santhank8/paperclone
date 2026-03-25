import TelegramBot from 'node-telegram-bot-api';

export interface ApprovalRequest {
  approvalId: string;
  type: 'hire_agent' | 'approve_ceo_strategy';
  description: string;
  companyId: string;
  requestedBy?: string;
}

export class TelegramBotService {
  private bot: TelegramBot | null = null;
  private webhookUrl: string;
  private initialized: boolean = false;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    this.webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || '';
    
    if (token) {
      this.bot = new TelegramBot(token, { polling: false });
      this.setupWebhook();
      this.setupCommandHandlers();
      this.setupCallbackHandlers();
      this.initialized = true;
    } else {
      console.log('[Telegram] Bot token not configured, skipping initialization');
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  private async setupWebhook() {
    if (!this.bot || !this.webhookUrl) return;
    
    try {
      await this.bot.setWebHook(this.webhookUrl);
      console.log('[Telegram] Webhook set to:', this.webhookUrl);
    } catch (error) {
      console.error('[Telegram] Failed to set webhook:', error);
    }
  }

  private setupCommandHandlers() {
    if (!this.bot) return;

    // /start command
    this.bot.onText(/\/start/, (msg) => {
      this.bot!.sendMessage(
        msg.chat.id,
        `🎯 *Welcome to Paperclip Bot!*

Your AI company orchestration assistant.

*Available Commands:*
/status - Check company status
/approvals - View pending approvals
/missions - View active missions
/help - Show this help message

Stay in control of your AI company from anywhere! 🚀`,
        { parse_mode: 'Markdown' }
      );
    });

    // /status command
    this.bot.onText(/\/status/, async (msg) => {
      // TODO: Fetch real company status
      this.bot!.sendMessage(
        msg.chat.id,
        `📊 *Company Status*

🤖 Active Agents: 3
📋 Tasks in Progress: 5
✅ Completed Today: 12
⚠️ Errors: 0

All systems operational! ✨`,
        { parse_mode: 'Markdown' }
      );
    });

    // /approvals command
    this.bot.onText(/\/approvals/, async (msg) => {
      // TODO: Fetch real pending approvals
      this.bot!.sendMessage(
        msg.chat.id,
        `📋 *Pending Approvals*

No pending approvals at the moment.

Use /status to check company status.`,
        { parse_mode: 'Markdown' }
      );
    });

    // /missions command
    this.bot.onText(/\/missions/, async (msg) => {
      // TODO: Fetch real missions
      this.bot!.sendMessage(
        msg.chat.id,
        `🎯 *Active Missions*

No active missions.

Create a mission in the dashboard to get started!`,
        { parse_mode: 'Markdown' }
      );
    });

    // /help command
    this.bot.onText(/\/help/, (msg) => {
      this.bot!.sendMessage(
        msg.chat.id,
        `📖 *Paperclip Bot Help*

*Commands:*
/start - Start the bot
/status - Company status overview
/approvals - View pending approvals
/missions - View active missions
/help - Show this help

*Features:*
✅ Instant approval notifications
✅ Inline approve/reject buttons
✅ Real-time status updates
✅ Mission progress alerts

Need more help? Contact support.`,
        { parse_mode: 'Markdown' }
      );
    });
  }

  private setupCallbackHandlers() {
    if (!this.bot) return;

    // Handle inline button clicks
    this.bot.on('callback_query', async (callbackQuery) => {
      const message = callbackQuery.message;
      const data = callbackQuery.data;
      
      if (!data || !message) {
        this.bot!.answerCallbackQuery(callbackQuery.id, {
          text: 'Invalid request',
          show_alert: true
        });
        return;
      }

      // Parse callback data: "approve:approval_id" or "reject:approval_id"
      const [action, approvalId] = data.split(':');
      
      if (!action || !approvalId) {
        this.bot!.answerCallbackQuery(callbackQuery.id, {
          text: 'Invalid callback data',
          show_alert: true
        });
        return;
      }

      try {
        // TODO: Call approval API to process the decision
        // await processApproval(approvalId, action as 'approve' | 'reject');
        
        await this.bot!.answerCallbackQuery(callbackQuery.id, {
          text: `Approval ${action === 'approve' ? '✅ approved' : '❌ rejected'}`,
          show_alert: false
        });

        // Edit the original message to show the decision
        const actionEmoji = action === 'approve' ? '✅' : '❌';
        const actionText = action === 'approve' ? 'Approved' : 'Rejected';
        
        await this.bot!.editMessageText(
          `${message.text}\n\n*Decision:* ${actionEmoji} *${actionText}*`,
          {
            chat_id: message.chat.id,
            message_id: message.message_id,
            parse_mode: 'Markdown'
          }
        );
      } catch (error) {
        console.error('[Telegram] Failed to process approval:', error);
        await this.bot!.answerCallbackQuery(callbackQuery.id, {
          text: 'Failed to process approval. Please try again.',
          show_alert: true
        });
      }
    });
  }

  /**
   * Send approval request with inline keyboard buttons
   */
  public async sendApprovalRequest(
    chatId: number,
    approval: ApprovalRequest
  ): Promise<boolean> {
    if (!this.bot) {
      console.error('[Telegram] Bot not initialized');
      return false;
    }

    const riskEmoji = approval.type === 'hire_agent' ? '👥' : '🎯';
    const message = `
${riskEmoji} *Approval Required*

*Type:* ${approval.type === 'hire_agent' ? 'Hire Agent' : 'CEO Strategy'}
*Description:* ${approval.description}
*Company:* ${approval.companyId}
${approval.requestedBy ? `*Requested By:* ${approval.requestedBy}` : ''}

*Action Required:* Please approve or reject this request.
`.trim();

    try {
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve', callback_data: `approve:${approval.approvalId}` },
              { text: '❌ Reject', callback_data: `reject:${approval.approvalId}` }
            ]
          ]
        }
      });
      return true;
    } catch (error) {
      console.error('[Telegram] Failed to send approval request:', error);
      return false;
    }
  }

  /**
   * Send simple notification message
   */
  public async sendNotification(
    chatId: number,
    title: string,
    message: string
  ): Promise<boolean> {
    if (!this.bot) {
      console.error('[Telegram] Bot not initialized');
      return false;
    }

    const fullMessage = `*${title}*\n\n${message}`;

    try {
      await this.bot.sendMessage(chatId, fullMessage, {
        parse_mode: 'Markdown'
      });
      return true;
    } catch (error) {
      console.error('[Telegram] Failed to send notification:', error);
      return false;
    }
  }

  /**
   * Send mission progress update
   */
  public async sendMissionProgress(
    chatId: number,
    missionName: string,
    progress: number,
    status: string
  ): Promise<boolean> {
    if (!this.bot) return false;

    const statusEmoji = status === 'active' ? '🟢' : status === 'completed' ? '✅' : '⏸️';
    const message = `
${statusEmoji} *Mission Update*

*Mission:* ${missionName}
*Progress:* ${progress}%
*Status:* ${status.charAt(0).toUpperCase() + status.slice(1)}

Keep up the great work! 🚀
`.trim();

    try {
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown'
      });
      return true;
    } catch (error) {
      console.error('[Telegram] Failed to send mission update:', error);
      return false;
    }
  }

  /**
   * Send agent status alert
   */
  public async sendAgentAlert(
    chatId: number,
    agentName: string,
    status: string,
    error?: string
  ): Promise<boolean> {
    if (!this.bot) return false;

    const alertEmoji = status === 'error' ? '🚨' : '⚠️';
    const message = `
${alertEmoji} *Agent Alert*

*Agent:* ${agentName}
*Status:* ${status.toUpperCase()}
${error ? `*Error:* ${error}` : ''}

Please check the dashboard for details.
`.trim();

    try {
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown'
      });
      return true;
    } catch (error) {
      console.error('[Telegram] Failed to send agent alert:', error);
      return false;
    }
  }
}

// Export singleton instance
export const telegramBot = new TelegramBotService();
