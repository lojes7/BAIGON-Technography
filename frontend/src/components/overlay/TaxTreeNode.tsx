import { useState } from "react";
import T from "../../constants/tokens";
import { typeColors2 } from "../../data";
import type { TaxNode } from "../../types";

function TaxTreeNode({ node, depth = 0 }: { node: TaxNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const col = typeColors2[node.type] ?? T.info;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-3 rounded cursor-pointer transition-colors hover:bg-gray-50"
        style={{ paddingLeft: 12 + depth * 20 }}
        onClick={() => hasChildren && setOpen(v => !v)}
      >
        <div className="w-4 flex-shrink-0 flex items-center justify-center">
          {hasChildren
            ? <span className="text-[12px]" style={{ color: T.info }}>{open ? "▾" : "▸"}</span>
            : <div className="w-1.5 h-1.5 rounded-full" style={{ background: col }} />}
        </div>
        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: `${col}30`, border: `1px solid ${col}` }} />
        <span className="text-[13px] font-medium flex-1" style={{ color: col }}>{node.label}</span>
        <span className="text-[11px] px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: `${col}12`, color: col }}>{node.type}</span>
        {node.skills !== undefined && (
          <span className="text-[11px] font-mono" style={{ color: T.info }}>{node.skills} 项能力</span>
        )}
        {node.count !== undefined && (
          <span className="text-[11px] font-mono" style={{ color: T.info }}>{node.count} 个</span>
        )}
      </div>
      {open && node.children?.map(child => (
        <TaxTreeNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default TaxTreeNode;
