"use client";

import type { ExportAsset, PatternDocument } from "@/features/generator/model/types";
import { ResultImageCard } from "./ResultImageCard";

interface ResultSectionProps {
  document: PatternDocument;
  patternAsset: ExportAsset;
  usageAsset: ExportAsset;
}

/**
 * 结果区：同时展示图纸和用量图两张结果卡。
 */
export function ResultSection({ document, patternAsset, usageAsset }: ResultSectionProps) {
  const patternSummary = `${document.width}×${document.height} 格 · 总豆数 ${document.totalBeads}`;
  const usageSummary = `${document.usage.length} 色 · 总豆数 ${document.totalBeads}`;

  return (
    <section className="mt-4 space-y-4">
      <ResultImageCard
        title="拼豆图纸"
        asset={patternAsset}
        summary={patternSummary}
      />
      <ResultImageCard
        title="豆子用量"
        asset={usageAsset}
        summary={usageSummary}
      />
    </section>
  );
}
