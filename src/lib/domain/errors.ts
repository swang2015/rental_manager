export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'not_found'
      | 'validation'
      | 'conflict'
      | 'forbidden'
      | 'invalid_state' = 'validation',
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function assertFound<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new DomainError(message, 'not_found');
  }
  return value;
}

export function assertCondition(condition: unknown, message: string, code: DomainError['code'] = 'validation'): asserts condition {
  if (!condition) {
    throw new DomainError(message, code);
  }
}
