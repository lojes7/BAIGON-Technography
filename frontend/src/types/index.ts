export type PageId = string;

export interface NavSection {
  id: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number }>;
  single?: boolean;
  children?: { id: string; labelKey: string }[];
}

export interface EvidenceItem {
  text: string; source: string; date: string; job?: string; status: string;
}

export type GraphNode = {
  id: string; label: string; type: "industry" | "family" | "job" | "skill" | "tool";
  x: number; y: number;
};

export type TaxNode = {
  id: string; label: string; type: string;
  children?: TaxNode[]; skills?: number; count?: number;
};
