// 百工谱 — 可展开折叠的懒加载目录树（学科门类 / 职业大典共用）
// 数据量大（专业 845、职业 1635），采用点击展开时懒加载子级，避免一次性拉取。
import { useState } from "react";
import { ChevronRight, ChevronDown, Loader2, Database } from "lucide-react";
import T from "../constants/tokens";

export interface CatalogNodeData {
  id: string; // 雪花 ID int64，lossless 解析为字符串避免精度丢失
  code: string;
  name: string;
  is_embed?: boolean; // 叶子节点（专业/职业）的名称向量化状态
}

interface CatalogTreeProps {
  roots: CatalogNodeData[];
  loadChildren: (node: CatalogNodeData, depth: number) => Promise<CatalogNodeData[]>;
  maxDepth: number; // 树的总层级数，用于判断叶子节点
  leafEmbedBadge?: boolean; // 叶子节点是否显示向量化徽章
}

function TreeNode({
  node,
  depth,
  maxDepth,
  loadChildren,
  leafEmbedBadge,
}: {
  node: CatalogNodeData;
  depth: number;
  maxDepth: number;
  loadChildren: (node: CatalogNodeData, depth: number) => Promise<CatalogNodeData[]>;
  leafEmbedBadge?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<CatalogNodeData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const isLeaf = depth >= maxDepth - 1;

  const toggle = async () => {
    if (isLeaf) return;
    if (children === null) {
      setLoading(true);
      try {
        const kids = await loadChildren(node, depth);
        setChildren(kids);
        setOpen(true);
      } catch {
        setChildren([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    } else {
      setOpen((v) => !v);
    }
  };

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-3 rounded cursor-pointer transition-colors hover:bg-gray-50"
        style={{ paddingLeft: 12 + depth * 20 }}
        onClick={toggle}
      >
        {/* 展开箭头 / 叶子圆点 */}
        <div className="w-4 flex-shrink-0 flex items-center justify-center">
          {isLeaf ? (
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: T.stable }} />
          ) : loading ? (
            <Loader2 size={13} className="animate-spin" style={{ color: T.info }} />
          ) : open ? (
            <ChevronDown size={14} style={{ color: T.info }} />
          ) : (
            <ChevronRight size={14} style={{ color: T.info }} />
          )}
        </div>

        <span className="text-[13px] flex-1 truncate" style={{ color: T.ink }}>{node.name}</span>
        {node.code && (
          <span className="text-[11px] font-mono flex-shrink-0" style={{ color: T.info }}>{node.code}</span>
        )}

        {/* 叶子节点向量化徽章 */}
        {isLeaf && leafEmbedBadge && (
          node.is_embed ? (
            <span className="text-[11px] px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: `${T.emerging}12`, color: T.emerging }}>已向量化</span>
          ) : (
            <span className="text-[11px] px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: `${T.pending}12`, color: T.pending }}>未向量化</span>
          )
        )}
      </div>

      {open && children !== null && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              loadChildren={loadChildren}
              leafEmbedBadge={leafEmbedBadge}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CatalogTree({ roots, loadChildren, maxDepth, leafEmbedBadge }: CatalogTreeProps) {
  if (roots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <Database size={24} style={{ color: T.info }} />
        <span className="text-[13px]" style={{ color: T.info }}>暂无数据</span>
      </div>
    );
  }
  return (
    <div className="py-2">
      {roots.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          maxDepth={maxDepth}
          loadChildren={loadChildren}
          leafEmbedBadge={leafEmbedBadge}
        />
      ))}
    </div>
  );
}
