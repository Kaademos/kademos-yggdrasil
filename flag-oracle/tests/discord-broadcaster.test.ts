import { DiscordBroadcaster } from '../src/services/discord-broadcaster';

describe('DiscordBroadcaster', () => {
  const WEBHOOK = 'https://discord.test/webhook/abc';
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as any).fetch;
  });

  it('is disabled when no webhook url is configured', async () => {
    const b = new DiscordBroadcaster({ discordWebhookUrl: undefined });
    expect(b.isEnabled()).toBe(false);

    await b.flagCaptured({ userId: 'u1', realm: 'NIFLHEIM', points: 100, score: 100, firstBlood: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a capture message to the webhook', async () => {
    const b = new DiscordBroadcaster({ discordWebhookUrl: WEBHOOK });
    expect(b.isEnabled()).toBe(true);

    await b.flagCaptured({ userId: 'u1', realm: 'NIFLHEIM', points: 100, score: 100, firstBlood: false });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(WEBHOOK);
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.content).toContain('Niflheim');
    expect(body.content).toContain('+100');
    // raw user id must never appear
    expect(body.content).not.toContain('u1');
    expect(body.content).toContain('Seeker-');
  });

  it('marks first blood distinctly', async () => {
    const b = new DiscordBroadcaster({ discordWebhookUrl: WEBHOOK });
    await b.flagCaptured({ userId: 'u1', realm: 'ASGARD', points: 1000, score: 1000, firstBlood: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.content).toContain('FIRST BLOOD');
  });

  it('broadcasts full completion', async () => {
    const b = new DiscordBroadcaster({ discordWebhookUrl: WEBHOOK });
    await b.fullCompletion({ userId: 'u1' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.content).toContain('ascended');
  });

  it('never throws when the webhook delivery fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const b = new DiscordBroadcaster({ discordWebhookUrl: WEBHOOK });

    await expect(
      b.flagCaptured({ userId: 'u1', realm: 'HELHEIM', points: 200, score: 300, firstBlood: false })
    ).resolves.toBeUndefined();
  });
});
