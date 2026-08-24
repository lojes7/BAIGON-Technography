// 保留 HTTP 状态码，供页面区分“暂无数据”、并发冲突与真正的请求失败。
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`请求失败 (${status})`);
    this.name = "HttpError";
    this.status = status;
  }
}

export function isHttpErrorStatus(error: unknown, status: number): boolean {
  return error instanceof HttpError && error.status === status;
}
