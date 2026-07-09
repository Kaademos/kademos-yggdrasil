import { createHash } from 'crypto';
import { injectable, inject } from 'tsyringe';

export interface FlagCaptureEvent {
  userId: string;
  realm: string;
  points: number;
  score: number;
  firstBlood: boolean;
}

export interface CompletionEvent {
  userId: string;
}

/**
 * DiscordBroadcaster — broadcasts gameplay events to a Discord channel webhook.
 *
 * Opt-in: disabled unless DISCORD_WEBHOOK_URL is configured (mirrors the observability
 * opt-in). Every send is fire-and-forget with a short timeout and swallowed errors, so a
 * slow or broken webhook can never delay or fail a flag submission.
 */
@injectable()
export class DiscordBroadcaster {
  private readonly webhookUrl: string;
  private readonly timeoutMs = 3000;

  constructor(@inject('Config') config: { discordWebhookUrl?: string }) {
    this.webhookUrl = config.discordWebhookUrl || '';
  }

  isEnabled(): boolean {
    return this.webhookUrl.length > 0;
  }

  /** Stable, non-reversible handle so raw user/session ids never reach Discord. */
  private handle(userId: string): string {
    const suffix = createHash('sha256').update(userId).digest('hex').slice(0, 6).toUpperCase();
    return `Seeker-${suffix}`;
  }

  private async post(content: string): Promise<void> {
    if (!this.isEnabled()) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });
    } catch (err) {
      // Never let a webhook failure affect gameplay.
      console.warn('[DiscordBroadcaster] webhook delivery failed:', (err as Error).message);
    } finally {
      clearTimeout(timer);
    }
  }

  async flagCaptured(event: FlagCaptureEvent): Promise<void> {
    const who = this.handle(event.userId);
    const realm = event.realm.charAt(0).toUpperCase() + event.realm.slice(1).toLowerCase();
    const content = event.firstBlood
      ? `🩸 **FIRST BLOOD!** ${who} is the first to conquer **${realm}** (+${event.points} pts, total ${event.score})!`
      : `🚩 ${who} captured **${realm}** (+${event.points} pts, total ${event.score})`;
    await this.post(content);
  }

  async fullCompletion(event: CompletionEvent): Promise<void> {
    const who = this.handle(event.userId);
    await this.post(
      `🌳 **${who} has ascended Yggdrasil** — all ten realms conquered. All hail the worthy!`
    );
  }
}
