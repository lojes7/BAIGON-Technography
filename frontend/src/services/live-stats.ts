// 动态统计口径：KPI = 演示池 + 真实数据
// 口径规则（与 engineer.getDataSourceList 的真实环境判定一致）：
// 以「未筛选的真实总量」统一判定——≥100 视为真实环境，四个数字全部用真实口径；
// <100 视为演示环境，全部叠加演示池（120 条）补位。保证 累计 ≥ 待复核 + 通过 + 驳回 恒成立。
import { useSyncExternalStore } from "react";
import { DEMO_STATS } from "./demo-pool";
import { getDataSourceRealTotal } from "./engineer";

export type LiveStats = typeof DEMO_STATS;

const REAL_THRESHOLD = 100; // 与 getDataSourceList 的演示补位阈值一致

let snapshot: LiveStats = DEMO_STATS;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export async function refreshLiveStats(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const [total, pending, passed, rejected] = await Promise.all([
        getDataSourceRealTotal(""),
        getDataSourceRealTotal("PENDING"),
        getDataSourceRealTotal("PASSED"),
        getDataSourceRealTotal("REJECTED"),
      ]);
      let s: LiveStats;
      if (total >= REAL_THRESHOLD) {
        // 真实环境：全部用真实口径，保证 待复核 ≤ 累计
        s = {
          ...DEMO_STATS,
          total,
          pending,
          passed,
          rejected,
          passRate: `${((passed / Math.max(1, passed + rejected)) * 100).toFixed(1)}%`,
          pendingHigh: Math.max(1, Math.round(pending * 0.25)),
          todayNew: DEMO_STATS.todayNew + Math.max(0, total - DEMO_STATS.total),
          trend: DEMO_STATS.trend,
        };
      } else {
        // 演示补位环境：与列表页脚一致，全部叠加演示池
        const t = total + DEMO_STATS.total;
        const p = pending + DEMO_STATS.pending;
        const a = passed + DEMO_STATS.passed;
        const r = rejected + DEMO_STATS.rejected;
        s = {
          ...DEMO_STATS,
          total: t,
          pending: p,
          passed: a,
          rejected: r,
          passRate: `${((a / Math.max(1, a + r)) * 100).toFixed(1)}%`,
          pendingHigh: Math.max(1, Math.round(p * 0.25)),
          todayNew: DEMO_STATS.todayNew + total,
          trend: DEMO_STATS.trend,
        };
      }
      snapshot = s;
      emit();
    } catch {
      // 后端不可用时保持演示口径，页面照常可演示
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useLiveStats(): LiveStats {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      void refreshLiveStats();
      return () => listeners.delete(cb);
    },
    () => snapshot,
  );
  return snapshot;
}
