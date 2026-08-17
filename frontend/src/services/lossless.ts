// lossless JSON 解析：解决雪花 ID 精度丢失问题
//
// 后端雪花 ID 为 int64（18 位），gateway 用 encoding/json 序列化成 JSON 数字，
// 原生 JSON.parse 会按 JS Number 解析，超过 Number.MAX_SAFE_INTEGER(2^53) 后被四舍五入，
// 导致前端拿到的 id 错位（如详情/原始记录追溯接口 404、目录树懒加载失败）。
//
// 用 json-bigint 的 storeAsString 模式：仅把超出安全整数范围的大整数转成字符串，
// 其余小数字（page/total/count 等）保持 number，业务影响最小。
import JSONbig from "json-bigint";

const parser = JSONbig({ storeAsString: true });

/** 解析响应文本，大整数（雪花 ID）转字符串 */
export function parseJson(text: string): unknown {
  return parser.parse(text);
}
