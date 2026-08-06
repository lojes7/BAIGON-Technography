import T from "../constants/tokens";
import type { TaxNode } from "../types";

const taxonomyTree: TaxNode[] = [
  {
    id: "t1", label: "人工智能软件", type: "产业", children: [
      {
        id: "t1-1", label: "大模型应用", type: "岗位族", children: [
          {
            id: "t1-1-1", label: "大模型应用工程师", type: "岗位", skills: 8,
            children: [
              { id: "t1-1-1-a", label: "技术技能", type: "能力类型", count: 5 },
              { id: "t1-1-1-b", label: "工具与平台", type: "能力类型", count: 2 },
              { id: "t1-1-1-c", label: "软技能", type: "能力类型", count: 1 },
            ]
          },
          {
            id: "t1-1-2", label: "AI平台工程师", type: "岗位", skills: 7,
            children: [
              { id: "t1-1-2-a", label: "技术技能", type: "能力类型", count: 4 },
              { id: "t1-1-2-b", label: "工具与平台", type: "能力类型", count: 2 },
              { id: "t1-1-2-c", label: "知识领域", type: "能力类型", count: 1 },
            ]
          },
        ]
      },
      {
        id: "t1-2", label: "机器视觉", type: "岗位族", children: [
          { id: "t1-2-1", label: "机器视觉工程师", type: "岗位", skills: 9, children: [] },
          { id: "t1-2-2", label: "计算机视觉研究员", type: "岗位", skills: 11, children: [] },
        ]
      },
      {
        id: "t1-3", label: "AI基础设施", type: "岗位族", children: [
          { id: "t1-3-1", label: "MLOps工程师", type: "岗位", skills: 6, children: [] },
        ]
      },
    ]
  },
  {
    id: "t2", label: "智能制造", type: "产业", children: [
      {
        id: "t2-1", label: "工业智能", type: "岗位族", children: [
          { id: "t2-1-1", label: "工业视觉工程师", type: "岗位", skills: 7, children: [] },
          { id: "t2-1-2", label: "智能质检工程师", type: "岗位", skills: 5, children: [] },
        ]
      },
    ]
  },
];

const typeColors2: Record<string, string> = {
  产业: T.ink, 岗位族: T.teal, 岗位: T.stable, 能力类型: T.emerging,
};

const TAX_PARENTS: Record<string, string[]> = {
  产业: ["（根节点，无父节点）"],
  岗位族: ["人工智能软件", "智能制造"],
  岗位: ["大模型应用", "机器视觉", "AI基础设施", "工业智能"],
  能力类型: ["大模型应用工程师", "AI平台工程师", "机器视觉工程师", "MLOps工程师", "数据开发工程师"],
};

export { taxonomyTree, typeColors2, TAX_PARENTS };
