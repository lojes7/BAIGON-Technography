import T from "./tokens";

const STATUS: Record<string, { key: string; color: string; bg: string }> = {
  draft: { key: "status.draft", color: T.info, bg: "#F3F4F6" },
  pending: { key: "status.pending", color: "#B45309", bg: "#FEF3C7" },
  running: { key: "status.running", color: T.stable, bg: "#EFF6FF" },
  succeeded: { key: "status.succeeded", color: "#047857", bg: "#D1FAE5" },
  partially_succeeded: { key: "status.partially_succeeded", color: T.declining, bg: "#FFEDD5" },
  failed: { key: "status.failed", color: "#B91C1C", bg: "#FEE2E2" },
  needs_review: { key: "status.needs_review", color: "#B45309", bg: "#FEF3C7" },
  pending_review: { key: "status.needs_review", color: "#B45309", bg: "#FEF3C7" },
  review_passed: { key: "status.confirmed", color: "#047857", bg: "#D1FAE5" },
  passed: { key: "status.confirmed", color: "#047857", bg: "#D1FAE5" },
  confirmed: { key: "status.confirmed", color: "#047857", bg: "#D1FAE5" },
  review_reject: { key: "status.rejected", color: "#B91C1C", bg: "#FEE2E2" },
  rejected: { key: "status.rejected", color: "#B91C1C", bg: "#FEE2E2" },
  archived: { key: "status.archived", color: T.info, bg: "#F3F4F6" },
  candidate: { key: "status.candidate", color: T.stable, bg: "#EFF6FF" },
  valid: { key: "status.valid", color: "#047857", bg: "#D1FAE5" },
};

export default STATUS;
