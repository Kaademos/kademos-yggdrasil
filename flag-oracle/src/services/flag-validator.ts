const FLAG_REGEX =
  /^YGGDRASIL\{([A-Z_]+):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}$/i;

export interface FlagValidationResult {
  valid: boolean;
  realm?: string;
  uuid?: string;
  error?: string;
}

export class FlagValidator {
  validate(flag: string): FlagValidationResult {
    if (!flag || typeof flag !== 'string') {
      return { valid: false, error: 'Flag must be a non-empty string' };
    }

    const match = flag.match(FLAG_REGEX);
    if (!match) {
      return { valid: false, error: 'Invalid flag format' };
    }

    const [, realm, uuid] = match;
    return {
      valid: true,
      realm: realm.toUpperCase(),
      uuid: uuid.toLowerCase(),
    };
  }
}
