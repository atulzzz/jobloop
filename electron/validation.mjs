export const ErrorCodes = Object.freeze({
  INVALID_URL: "INVALID_URL",
  INVALID_BOUNDS: "INVALID_BOUNDS",
  BROWSER_UNAVAILABLE: "BROWSER_UNAVAILABLE",
  PAGE_BUSY: "PAGE_BUSY",
  NAVIGATION_FAILED: "NAVIGATION_FAILED",
  CAPTURE_FAILED: "CAPTURE_FAILED",
  UNTRUSTED_SENDER: "UNTRUSTED_SENDER",
  INTERNAL_ERROR: "INTERNAL_ERROR"
});

export class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

export function normalizeUrl(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (!trimmed) {
    throw new AppError(ErrorCodes.INVALID_URL, "请输入网址。");
  }

  if (trimmed.length > 2048) {
    throw new AppError(ErrorCodes.INVALID_URL, "网址长度超过限制。");
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url;

  try {
    url = new URL(withProtocol);
  } catch {
    throw new AppError(ErrorCodes.INVALID_URL, "网址格式不正确。");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError(ErrorCodes.INVALID_URL, "只支持 HTTP 或 HTTPS 网址。");
  }

  return url.toString();
}

export function isSameOriginUrl(candidate, current) {
  try {
    return new URL(candidate).origin === new URL(current).origin;
  } catch {
    return false;
  }
}

export function sanitizeBounds(value, viewport) {
  if (!value || typeof value !== "object" || !viewport) {
    throw new AppError(ErrorCodes.INVALID_BOUNDS, "页面区域参数无效。");
  }

  const x = Math.floor(Number(value.x));
  const y = Math.floor(Number(value.y));
  const width = Math.floor(Number(value.width));
  const height = Math.floor(Number(value.height));

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1
  ) {
    throw new AppError(ErrorCodes.INVALID_BOUNDS, "页面区域尺寸无效。");
  }

  return {
    x: Math.max(0, Math.min(x, viewport.width)),
    y: Math.max(0, Math.min(y, viewport.height)),
    width: Math.max(0, Math.min(width, Math.max(0, viewport.width - x))),
    height: Math.max(0, Math.min(height, Math.max(0, viewport.height - y)))
  };
}

export function toPublicError(error) {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message
    };
  }

  return {
    code: ErrorCodes.INTERNAL_ERROR,
    message: "发生了未预期的内部错误。"
  };
}
