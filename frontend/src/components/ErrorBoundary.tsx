// 全局错误边界：捕获渲染期异常，避免整页白屏
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // 错误信息输出到控制台，便于排查
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#F7F9FB" }}>
          <div style={{ textAlign: "center", maxWidth: 480 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#19324D", marginBottom: 8 }}>页面出现错误</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
              点击下方按钮重新加载页面
            </div>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              style={{ padding: "8px 20px", borderRadius: 8, background: "#19324D", color: "#fff", fontSize: 13, cursor: "pointer", border: "none" }}
            >
              刷新页面
            </button>
            <details style={{ marginTop: 16, textAlign: "left" }}>
              <summary style={{ fontSize: 12, color: "#9CA3AF", cursor: "pointer" }}>错误详情</summary>
              <pre style={{ fontSize: 11, color: "#B54848", whiteSpace: "pre-wrap", wordBreak: "break-all", marginTop: 8 }}>
                {String(this.state.error)}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
