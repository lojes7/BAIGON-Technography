import axios, { type AxiosError } from "axios";
import { toast } from "sonner";
import { parseJson } from "./lossless";

// ── 创建 axios 实例 ──
const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
  // 用 lossless 解析响应，避免雪花 ID（int64）被 JSON.parse 丢精度
  transformResponse: [(data: unknown) => {
    if (typeof data === "string" && data.length > 0) {
      try { return parseJson(data); } catch { return data; }
    }
    return data;
  }],
});

// ── 请求拦截器：自动注入 Token ──
request.interceptors.request.use((config) => {
  const token = localStorage.getItem("baigon_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── 响应拦截器：统一错误处理 ──
request.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ code?: number }>) => {
    if (error.response) {
      const { status } = error.response;

      switch (status) {
        case 401:
          localStorage.removeItem("baigon_token");
          localStorage.removeItem("baigon_user");
          window.location.href = "/login";
          break;
        case 403:
          toast.error("无权限访问");
          break;
        case 404:
          toast.error("资源不存在");
          break;
        case 500:
          toast.error("服务器内部错误");
          break;
        case 503:
          toast.error("服务暂不可用");
          break;
        default:
          toast.error(`请求失败 (${status})`);
      }
    } else if (error.code === "ECONNABORTED") {
      toast.error("请求超时");
    } else {
      toast.error("网络错误");
    }

    return Promise.reject(error);
  },
);

export default request;
