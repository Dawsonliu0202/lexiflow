export type ErrorCode =
  | 'AI_NOT_CONFIGURED'
  | 'AI_AUTH'
  | 'AI_NOT_FOUND'
  | 'AI_RATE_LIMIT'
  | 'AI_TIMEOUT'
  | 'AI_NETWORK'
  | 'AI_PARSE_ERROR'
  | 'AI_ABORTED'
  | 'NOTION_NOT_CONFIGURED'
  | 'NOTION_NOT_CONNECTED'
  | 'NOTION_AUTH'
  | 'NOTION_NOT_FOUND'
  | 'NOTION_RATE_LIMIT'
  | 'NOTION_VALIDATION'
  | 'NOTION_CONFLICT'
  | 'NOTION_SERVER'
  | 'NOTION_NETWORK'
  | 'OAUTH_CANCELLED'
  | 'OAUTH_NO_PARENT_PAGE'
  | 'OAUTH_STATE_MISMATCH'
  | 'DB_ERROR'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN';

export interface AppError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  detail?: unknown;
}

export class LexiFlowError extends Error implements AppError {
  public readonly code: ErrorCode;
  public readonly retryable: boolean;
  public readonly detail?: unknown;

  constructor(code: ErrorCode, message: string, retryable = false, detail?: unknown) {
    super(message);
    this.name = 'LexiFlowError';
    this.code = code;
    this.retryable = retryable;
    this.detail = detail;
    Object.setPrototypeOf(this, LexiFlowError.prototype);
  }
}

export function isAppError(err: unknown): err is AppError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'message' in err &&
    typeof (err as AppError).code === 'string'
  );
}

export function toAppError(err: unknown): AppError {
  if (isAppError(err)) {
    return {
      code: err.code,
      message: err.message,
      retryable: !!err.retryable,
      detail: err.detail,
    };
  }

  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return {
        code: 'AI_ABORTED',
        message: '请求已被取消',
        retryable: false,
      };
    }
    return {
      code: 'UNKNOWN',
      message: err.message,
      retryable: false,
    };
  }

  return {
    code: 'UNKNOWN',
    message: String(err || '未知错误'),
    retryable: false,
  };
}
