import type { DynamicGraphData } from "../types/dynamic-graph";
import type { AbilityGraphHandle } from "../components/AbilityGraph";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export function exportGraphJson(data: DynamicGraphData, filename = "ability-graph.json") {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    statistics: {
      nodeCount: data.nodes.length,
      edgeCount: data.edges.length,
      nodeTypes: data.nodes.reduce<Record<string, number>>((acc, n) => {
        acc[n.type] = (acc[n.type] ?? 0) + 1;
        return acc;
      }, {}),
      relationTypes: data.edges.reduce<Record<string, number>>((acc, e) => {
        acc[e.relationType] = (acc[e.relationType] ?? 0) + 1;
        return acc;
      }, {}),
      avgDemand: data.nodes.length
        ? data.nodes.reduce((s, n) => s + n.demandLevel, 0) / data.nodes.length
        : 0,
    },
    ...data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  downloadBlob(blob, filename);
}

export function exportGraphSvg(handle: AbilityGraphHandle | null, filename = "ability-graph.svg") {
  if (!handle) return false;
  const svgString = handle.exportSvgString();
  if (!svgString) return false;
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, filename);
  return true;
}

export async function exportGraphPng(
  handle: AbilityGraphHandle | null,
  filename = "ability-graph.png",
  scale = 2,
  background = "#FFFFFF",
): Promise<boolean> {
  if (!handle) return false;
  const svgString = handle.exportSvgString();
  if (!svgString) return false;
  const svgEl = handle.getSvgElement();
  const viewBox = svgEl?.getAttribute("viewBox")?.split(/\s+/).map(Number);
  let w = 1600, h = 1100;
  if (viewBox && viewBox.length === 4) {
    w = Math.round(viewBox[2]);
    h = Math.round(viewBox[3]);
  }
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);
    await new Promise<void>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error("canvas toBlob null")); return; }
        downloadBlob(blob, filename);
        resolve();
      }, "image/png");
    });
    return true;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function buildGraphCsv(data: DynamicGraphData) {
  const nodeHeader = "id,type,name,category,industry,demandLevel,trend,emerging,relatedJobCount,sampleCount,coverage,companyCount";
  const nodeRows = data.nodes.map((n) => [
    n.id, n.type, `"${(n.name ?? "").replace(/"/g, '""')}"`,
    n.category ?? "", n.industry ?? "",
    n.demandLevel.toFixed(3), n.trend ?? "", n.emerging ? "true" : "false",
    n.relatedJobCount ?? "", n.sampleCount ?? "",
    n.coverage?.toFixed(3) ?? "", n.companyCount ?? "",
  ].join(","));
  const edgeHeader = "id,source,target,relationType,confidence,importance,requiredLevel";
  const edgeRows = data.edges.map((e) => [
    e.id, e.source, e.target, e.relationType, e.confidence,
    e.importance.toFixed(3), e.requiredLevel ?? "",
  ].join(","));
  return {
    nodesCsv: "\ufeff" + [nodeHeader, ...nodeRows].join("\n"),
    edgesCsv: "\ufeff" + [edgeHeader, ...edgeRows].join("\n"),
  };
}

export function exportGraphCsv(data: DynamicGraphData, basename = "ability-graph") {
  const { nodesCsv, edgesCsv } = buildGraphCsv(data);
  downloadBlob(new Blob([nodesCsv], { type: "text/csv;charset=utf-8" }), `${basename}-nodes.csv`);
  setTimeout(() => {
    downloadBlob(new Blob([edgesCsv], { type: "text/csv;charset=utf-8" }), `${basename}-edges.csv`);
  }, 260);
}
