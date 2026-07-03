/**
 * 网格尺寸计算。
 *
 * 保持原图宽高比，将最长边固定为 maxGridEdge，另一边按原比例四舍五入。
 * 极端比例下短边至少为 1 格。
 */

export interface GridSize {
  width: number;
  height: number;
}

/**
 * 根据原图尺寸和 preset 最长边计算输出网格尺寸。
 *
 * @param sourceWidth 原图宽度（像素）
 * @param sourceHeight 原图高度（像素）
 * @param maxGridEdge 成品最长边格数
 * @returns 输出网格宽高
 * @throws 输入非正有限数时抛出明确错误
 */
export function calculateGrid(
  sourceWidth: number,
  sourceHeight: number,
  maxGridEdge: number
): GridSize {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    !Number.isFinite(maxGridEdge) ||
    !Number.isInteger(maxGridEdge) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    maxGridEdge <= 0
  ) {
    throw new Error(
      `非法输入: sourceWidth=${sourceWidth}, sourceHeight=${sourceHeight}, maxGridEdge=${maxGridEdge}，sourceWidth/sourceHeight 必须为正有限数，maxGridEdge 必须为正整数`
    );
  }

  const isLandscape = sourceWidth >= sourceHeight;

  let width: number;
  let height: number;

  if (isLandscape) {
    width = maxGridEdge;
    height = Math.round(maxGridEdge * (sourceHeight / sourceWidth));
  } else {
    height = maxGridEdge;
    width = Math.round(maxGridEdge * (sourceWidth / sourceHeight));
  }

  // 极端比例下短边至少为 1 格
  width = Math.max(1, Math.min(width, maxGridEdge));
  height = Math.max(1, Math.min(height, maxGridEdge));

  return { width, height };
}
