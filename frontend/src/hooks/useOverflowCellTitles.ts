import { useEffect } from "react";

const FIXED_TABLE_CELL_SELECTOR = [
  'table:not([data-table-layout="auto"]) th',
  'table:not([data-table-layout="auto"]) td',
].join(",");

/**
 * 为被省略的数据单元格补充原生 title，鼠标悬停或键盘聚焦时可查看全文。
 * 使用事件委托覆盖当前及后续动态渲染的全部数据表，避免每个页面重复实现。
 */
export default function useOverflowCellTitles() {
  useEffect(() => {
    const updateTitle = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const cell = event.target.closest<HTMLElement>(FIXED_TABLE_CELL_SELECTOR);
      if (!cell) return;

      // 业务显式设置的 title 优先；自动 title 每次按最新内容重新计算。
      if (cell.dataset.overflowTitle !== "true" && cell.hasAttribute("title")) return;
      if (cell.dataset.overflowTitle === "true") {
        cell.removeAttribute("title");
        delete cell.dataset.overflowTitle;
      }

      const isOverflowing = cell.scrollWidth > cell.clientWidth
        || cell.scrollHeight > cell.clientHeight;
      const fullText = cell.innerText.replace(/\s+/g, " ").trim();
      if (isOverflowing && fullText) {
        cell.title = fullText;
        cell.dataset.overflowTitle = "true";
      }
    };

    document.addEventListener("pointerover", updateTitle, true);
    document.addEventListener("focusin", updateTitle, true);
    return () => {
      document.removeEventListener("pointerover", updateTitle, true);
      document.removeEventListener("focusin", updateTitle, true);
    };
  }, []);
}
