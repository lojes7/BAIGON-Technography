import T from "./tokens";

const STATUS: Record<string, { key: string; color: string; bg: string }> = {
  draft: { key: "status.draft", color: T.info, bg: "#EDE6E0" },
  pending: { key: "status.pending", color: T.pending, bg: "#FDF6E3" },
  running: { key: "status.running", color: T.stable, bg: "#EBF2FA" },
  succeeded: { key: "status.succeeded", color: T.emerging, bg: "#E6F5F1" },
  partially_succeeded: { key: "status.partially_succeeded", color: T.declining, bg: "#FBF2EA" },
  failed: { key: "status.failed", color: T.risk, bg: "#FAECEC" },
  needs_review: { key: "status.needs_review", color: T.pending, bg: "#FDF6E3" },
  pending_review: { key: "status.needs_review", color: T.pending, bg: "#FDF6E3" },
  review_passed: { key: "status.confirmed", color: T.emerging, bg: "#E6F5F1" },
  confirmed: { key: "status.confirmed", color: T.emerging, bg: "#E6F5F1" },
  review_reject: { key: "status.rejected", color: T.risk, bg: "#FAECEC" },
  rejected: { key: "status.rejected", color: T.risk, bg: "#FAECEC" },
  archived: { key: "status.archived", color: T.info, bg: "#EDE6E0" },
  candidate: { key: "status.candidate", color: T.stable, bg: "#EBF2FA" },
  valid: { key: "status.valid", color: T.emerging, bg: "#E6F5F1" },
};

export default STATUS;
