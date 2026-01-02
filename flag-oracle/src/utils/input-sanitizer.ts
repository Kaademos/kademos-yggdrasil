export class InputSanitizer {
  static sanitizeUserId(userId: unknown): string | null {
    if (!userId || typeof userId !== 'string') {
      return null;
    }

    const cleaned = userId.trim();

    if (cleaned.length < 1 || cleaned.length > 128) {
      return null;
    }

    if (!/^[a-zA-Z0-9-_]+$/.test(cleaned)) {
      return null;
    }

    return cleaned;
  }

  static sanitizeFlag(flag: unknown): string | null {
    if (!flag || typeof flag !== 'string') {
      return null;
    }

    const cleaned = flag.trim();

    if (cleaned.length > 100) {
      return null;
    }

    return cleaned;
  }
}
