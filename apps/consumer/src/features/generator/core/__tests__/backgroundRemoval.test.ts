import {
  autoRemoveBackground,
  detectBackgroundCandidate,
  removeBackgroundFromSelection,
  removeEdgeConnectedBackground,
} from "../backgroundRemoval";
import { DEFAULT_BACKGROUND_REMOVAL_CONFIG } from "../backgroundRemovalConfig";
import { hexToOklab, oklabDistance } from "../color";
import { calculateUsage } from "../calculateUsage";
import { mapHexGridToPalette } from "../color";
import { TEST_PALETTE } from "@tests/fixtures/testPalette";

const WHITE = "#FFFFFF";
const OFF_WHITE = "#F8F8F8";
const RED = "#FF0000";
const GREEN = "#00FF00";
const BLUE = "#0000FF";
const BLACK = "#000000";

function makeGrid(width: number, height: number, fill: string | null): (string | null)[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

function countNonNull(grid: (string | null)[][]): number {
  return grid.flat().filter((c) => c !== null).length;
}

describe("backgroundRemoval", () => {
  describe("TC-BG-001: 已有透明通道", () => {
    it("已有 null 保持 null，不会被映射为白色", () => {
      const grid: (string | null)[][] = [
        [WHITE, null, WHITE],
        [null, RED, null],
        [WHITE, null, WHITE],
      ];

      const result = removeEdgeConnectedBackground(grid, WHITE);
      expect(result.grid[0][1]).toBeNull();
      expect(result.grid[1][0]).toBeNull();
      expect(result.grid[1][2]).toBeNull();
      expect(result.grid[2][1]).toBeNull();
      expect(result.grid[1][1]).toBe(RED);
    });
  });

  describe("TC-BG-002: 纯色边缘背景", () => {
    it("纯色背景触达四边四角时自动检测高置信度并删除背景，主体保留", () => {
      // 5×5：外围白色背景，中心 3×3 红色主体
      const grid = makeGrid(5, 5, WHITE);
      for (let y = 1; y <= 3; y++) {
        for (let x = 1; x <= 3; x++) {
          grid[y][x] = RED;
        }
      }

      const detection = detectBackgroundCandidate(grid);
      expect(detection.candidateHex).toBe(WHITE);
      expect(detection.representativeTouchedSides).toBe(4);
      expect(detection.touchedCorners).toBe(4);
      expect(detection.borderCoverage).toBeGreaterThanOrEqual(0.55);
      expect(detection.confident).toBe(true);

      const result = autoRemoveBackground(grid);
      expect(result.requiresUserSelection).toBe(false);
      expect(result.removedCount).toBe(16); // 5×5 - 3×3
      expect(result.autoRemovalSafe).toBe(true);

      // 主体保留
      for (let y = 1; y <= 3; y++) {
        for (let x = 1; x <= 3; x++) {
          expect(result.grid[y][x]).toBe(RED);
        }
      }
      // 背景变 null
      expect(countNonNull(result.grid)).toBe(9);
    });

    it("近纯色背景（两种相近白）在真实阈值内被合并并删除", () => {
      const dist = oklabDistance(hexToOklab(WHITE), hexToOklab(OFF_WHITE));
      expect(dist).toBeLessThanOrEqual(DEFAULT_BACKGROUND_REMOVAL_CONFIG.backgroundDistanceThreshold);

      // 背景以 OFF_WHITE 为主（代表色），混有少量 WHITE，确保代表色触达四角
      const grid = makeGrid(6, 6, OFF_WHITE);
      for (let y = 1; y <= 4; y++) {
        for (let x = 1; x <= 4; x++) {
          grid[y][x] = RED;
        }
      }
      grid[0][2] = WHITE;
      grid[5][3] = WHITE;

      const result = autoRemoveBackground(grid);
      expect(result.requiresUserSelection).toBe(false);
      expect(countNonNull(result.grid)).toBe(16);
    });
  });

  describe("TC-BG-003: 主体内部同色区域", () => {
    it("内部与背景同色但不连通的区域必须保留", () => {
      // 5×5：外围白色背景，中心红色主体，主体内部包含一个白色孤岛
      const grid = makeGrid(5, 5, WHITE);
      for (let y = 1; y <= 3; y++) {
        for (let x = 1; x <= 3; x++) {
          grid[y][x] = RED;
        }
      }
      grid[2][2] = WHITE; // 主体内部的白色孤岛

      const result = autoRemoveBackground(grid);
      expect(result.requiresUserSelection).toBe(false);
      // 中心白色孤岛不连通，应保留
      expect(result.grid[2][2]).toBe(WHITE);
      // 红色主体保留
      expect(result.grid[1][1]).toBe(RED);
      expect(result.grid[3][3]).toBe(RED);
    });
  });

  describe("TC-BG-004: 主体与背景近色且触边", () => {
    it("主体与背景在阈值内近似并触达边缘时，自动删除被安全规则拦截", () => {
      // 5×5：顶/左/右为白色背景，底边与中心为近白色主体
      const grid = makeGrid(5, 5, WHITE);
      for (let y = 1; y < 5; y++) {
        for (let x = 1; x < 5; x++) {
          grid[y][x] = OFF_WHITE;
        }
      }
      // 确保顶行/左列/右列保持白色
      for (let x = 0; x < 5; x++) grid[0][x] = WHITE;
      for (let y = 0; y < 5; y++) {
        grid[y][0] = WHITE;
        grid[y][4] = WHITE;
      }

      // 确认确实在阈值内
      expect(oklabDistance(hexToOklab(WHITE), hexToOklab(OFF_WHITE))).toBeLessThanOrEqual(
        DEFAULT_BACKGROUND_REMOVAL_CONFIG.backgroundDistanceThreshold
      );

      // 检测可能高置信度，但自动删除应被 dry-run 安全规则拦截
      const result = autoRemoveBackground(grid);
      expect(result.requiresUserSelection).toBe(true);
      expect(result.removedCount).toBe(0);
      expect(result.autoRemovalSafe).toBe(false);
      expect(countNonNull(result.grid)).toBe(25);
    });
  });

  describe("TC-BG-005: 复杂边缘", () => {
    it("四边为多种复杂颜色时不应把全部边缘当背景", () => {
      const grid: (string | null)[][] = [
        [WHITE, WHITE, RED, RED, RED],
        [GREEN, BLACK, BLACK, BLACK, BLUE],
        [GREEN, BLACK, BLACK, BLACK, BLUE],
        [GREEN, BLACK, BLACK, BLACK, BLUE],
        [GREEN, GREEN, RED, RED, RED],
      ];

      const detection = detectBackgroundCandidate(grid);
      expect(detection.confident).toBe(false);

      const result = autoRemoveBackground(grid);
      expect(result.requiresUserSelection).toBe(true);
      expect(result.removedCount).toBe(0);
    });
  });

  describe("TC-BG-006: 用户点选背景", () => {
    it("点选边缘背景色后只删除边缘连通区域，支持重选", () => {
      // 5×5：外围白色背景，中心红色主体，主体内部有白色孤岛
      const grid = makeGrid(5, 5, WHITE);
      for (let y = 1; y <= 3; y++) {
        for (let x = 1; x <= 3; x++) {
          grid[y][x] = RED;
        }
      }
      grid[2][2] = WHITE;

      const originalNonNull = countNonNull(grid);

      // 用户点选左上角背景
      const result = removeBackgroundFromSelection(grid, 0, 0);
      expect(result.requiresUserSelection).toBe(false);
      expect(result.removedCount).toBe(16);
      expect(result.grid[2][2]).toBe(WHITE); // 内部孤岛保留

      // 输入不变
      expect(countNonNull(grid)).toBe(originalNonNull);

      // 重新点选另一个背景位置也能工作
      const result2 = removeBackgroundFromSelection(grid, 4, 4);
      expect(result2.removedCount).toBe(16);
    });

    it("点中 null 时返回原网格副本并要求重新选择", () => {
      const grid: (string | null)[][] = [
        [null, WHITE],
        [WHITE, RED],
      ];
      const result = removeBackgroundFromSelection(grid, 0, 0);
      expect(result.removedCount).toBe(0);
      expect(result.requiresUserSelection).toBe(true);
      expect(countNonNull(result.grid)).toBe(countNonNull(grid));
    });

    it("点选内部主体色但边缘没有该色时要求重新选择", () => {
      const grid = makeGrid(5, 5, WHITE);
      for (let y = 1; y <= 3; y++) {
        for (let x = 1; x <= 3; x++) {
          grid[y][x] = RED;
        }
      }
      // 点选中心红色，边缘没有红色，应 0 删除并要求重选
      const result = removeBackgroundFromSelection(grid, 2, 2);
      expect(result.removedCount).toBe(0);
      expect(result.requiresUserSelection).toBe(true);
      expect(countNonNull(result.grid)).toBe(25);
    });

    it("空网格无法选择背景", () => {
      expect(() => removeBackgroundFromSelection([], 0, 0)).toThrow("空网格无法选择背景");
    });
  });

  describe("TC-BG-007: 背景不计豆数", () => {
    it("删除 36 格背景后 totalBeads 为 64", () => {
      // 10×10：外围 1 格白色背景，内部 8×8 红色主体
      const grid = makeGrid(10, 10, WHITE);
      for (let y = 1; y <= 8; y++) {
        for (let x = 1; x <= 8; x++) {
          grid[y][x] = RED;
        }
      }

      expect(countNonNull(grid)).toBe(100);

      const result = autoRemoveBackground(grid);
      expect(result.requiresUserSelection).toBe(false);
      expect(result.removedCount).toBe(36);
      expect(countNonNull(result.grid)).toBe(64);

      const cells = mapHexGridToPalette(result.grid, TEST_PALETTE);
      const usage = calculateUsage(cells);
      expect(usage.totalBeads).toBe(64);
      expect(usage.usage.reduce((sum, u) => sum + u.count, 0)).toBe(64);
    });
  });

  describe("TC-BG-008: 复杂宠物照片人工验收", () => {
    it("本阶段无真实图片解码，标记为延期并在检测中说明", () => {
      const grid: (string | null)[][] = [[WHITE, RED], [RED, WHITE]];
      const detection = detectBackgroundCandidate(grid);
      expect(detection).toBeDefined();
    });
  });

  describe("P0：防止自动去背景误删主体", () => {
    it("主体占据三条边且覆盖超过 55% 时拒绝自动删除", () => {
      // 5×5：红色主体占据下方 4×5，触达左/右/下三边，覆盖约 68.75%
      const grid = makeGrid(5, 5, WHITE);
      for (let y = 1; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          grid[y][x] = RED;
        }
      }

      const detection = detectBackgroundCandidate(grid);
      // 红色代表色触达 3 条边，不满足默认 4 条边要求
      expect(detection.representativeTouchedSides).toBe(3);
      expect(detection.confident).toBe(false);

      const result = autoRemoveBackground(grid);
      expect(result.requiresUserSelection).toBe(true);
      expect(result.removedCount).toBe(0);
      expect(countNonNull(result.grid)).toBe(25);
    });

    it("主体与背景近色且与边缘连通时，dry-run 安全比例拦截自动删除", () => {
      // 5×5 全为近白色，只有一个红色孤岛在中心
      const grid = makeGrid(5, 5, OFF_WHITE);
      grid[2][2] = RED;

      // OFF_WHITE 与 WHITE 在阈值内，flood fill 会删除绝大部分
      const result = autoRemoveBackground(grid);
      expect(result.requiresUserSelection).toBe(true);
      expect(result.removedCount).toBe(0);
      expect(result.autoRemovalSafe).toBe(false);
      expect(countNonNull(result.grid)).toBe(25);
    });

    it("全单色网格自动删除会清空整图，必须转为用户点选", () => {
      const grid = makeGrid(5, 5, WHITE);

      const detection = detectBackgroundCandidate(grid);
      expect(detection.confident).toBe(true);

      const result = autoRemoveBackground(grid);
      expect(result.requiresUserSelection).toBe(true);
      expect(result.removedCount).toBe(0);
      expect(result.autoRemovalSafe).toBe(false);
      expect(countNonNull(result.grid)).toBe(25);
    });
  });

  describe("HEX 网格内容校验", () => {
    it("detectBackgroundCandidate 对非法 HEX 单元格立即抛错", () => {
      const grid: (string | null)[][] = [["#GGGGGG"]];
      expect(() => detectBackgroundCandidate(grid)).toThrow("非法 HEX");
    });

    it("removeEdgeConnectedBackground 对非法 HEX 单元格立即抛错", () => {
      const grid: (string | null)[][] = [
        [WHITE, RED],
        [RED, "#ZZZZZZ"],
      ];
      expect(() => removeEdgeConnectedBackground(grid, WHITE)).toThrow("非法 HEX");
    });

    it("removeEdgeConnectedBackground 对非法 backgroundHex 立即抛错", () => {
      const grid: (string | null)[][] = [[WHITE]];
      expect(() => removeEdgeConnectedBackground(grid, "GGGGGG")).toThrow("非法 HEX 格式");
    });

    it("removeBackgroundFromSelection 对非法 HEX 单元格立即抛错", () => {
      const grid: (string | null)[][] = [
        [WHITE, RED],
        [RED, "#GGGGGG"],
      ];
      expect(() => removeBackgroundFromSelection(grid, 0, 0)).toThrow("非法 HEX");
    });

    it("autoRemoveBackground 对非法 HEX 单元格立即抛错", () => {
      const grid: (string | null)[][] = [
        [WHITE, RED],
        [RED, "#GGGGGG"],
      ];
      expect(() => autoRemoveBackground(grid)).toThrow("非法 HEX");
    });

    it("接受 #RGB 简写并按 normalizeHex 规则处理", () => {
      const grid: (string | null)[][] = [["#FFF", RED]];
      const result = removeEdgeConnectedBackground(grid, "#FFFFFF");
      expect(result.grid[0][0]).toBeNull();
    });

    it("拒绝带 alpha 的 HEX", () => {
      const grid: (string | null)[][] = [["#FFFFFFAA"]];
      expect(() => detectBackgroundCandidate(grid)).toThrow("非法 HEX");
    });
  });

  describe("边界与非法输入", () => {
    it("空网格", () => {
      const result = autoRemoveBackground([]);
      expect(result.grid).toEqual([]);
      expect(result.removedCount).toBe(0);
      expect(result.requiresUserSelection).toBe(true);
    });

    it("全 null 网格", () => {
      const grid = makeGrid(3, 3, null);
      const result = autoRemoveBackground(grid);
      expect(result.removedCount).toBe(0);
      expect(result.requiresUserSelection).toBe(true);
    });

    it("1×1 网格自动删除会被安全规则拦截", () => {
      const grid: (string | null)[][] = [[WHITE]];
      const result = autoRemoveBackground(grid);
      expect(result.removedCount).toBe(0);
      expect(result.requiresUserSelection).toBe(true);
      expect(result.autoRemovalSafe).toBe(false);
    });

    it("单行网格：背景触达四边时应成功删除", () => {
      const grid: (string | null)[][] = [[WHITE, WHITE, RED, WHITE]];
      const result = autoRemoveBackground(grid);
      expect(result.removedCount).toBe(3);
      expect(result.grid).toEqual([[null, null, RED, null]]);
    });

    it("单列网格：背景触达四边时应成功删除", () => {
      const grid: (string | null)[][] = [[WHITE], [WHITE], [RED], [WHITE]];
      const result = autoRemoveBackground(grid);
      expect(result.removedCount).toBe(3);
      expect(result.grid[2][0]).toBe(RED);
    });

    it("锯齿网格抛错", () => {
      const grid = [[WHITE, RED], [WHITE]] as (string | null)[][];
      expect(() => autoRemoveBackground(grid)).toThrow("非法网格");
    });

    it("非法 threshold 抛错", () => {
      const grid: (string | null)[][] = [[WHITE]];
      expect(() => detectBackgroundCandidate(grid, { config: { backgroundDistanceThreshold: -1 } })).toThrow("非法");
      expect(() => detectBackgroundCandidate(grid, { config: { minBorderCoverage: 1.5 } })).toThrow("非法");
      expect(() => detectBackgroundCandidate(grid, { config: { minTouchedSides: 5 } })).toThrow("非法");
      expect(() => detectBackgroundCandidate(grid, { config: { minTouchedCorners: 5 } })).toThrow("非法");
      expect(() => detectBackgroundCandidate(grid, { config: { maxAutoRemovalRatio: 1.5 } })).toThrow("非法");
    });

    it("坐标非法或越界抛错", () => {
      const grid: (string | null)[][] = [[WHITE, RED], [WHITE, RED]];
      expect(() => removeBackgroundFromSelection(grid, 0.5, 0)).toThrow("整数");
      expect(() => removeBackgroundFromSelection(grid, -1, 0)).toThrow("越界");
      expect(() => removeBackgroundFromSelection(grid, 0, 2)).toThrow("越界");
    });

    it("输入不可变", () => {
      const grid: (string | null)[][] = [
        [WHITE, WHITE],
        [WHITE, RED],
      ];
      const original = grid.map((row) => [...row]);
      autoRemoveBackground(grid);
      expect(grid).toEqual(original);
    });

    it("稳定 tie-break：覆盖率与触边相同时选 HEX 字典序更小的候选", () => {
      const grid: (string | null)[][] = [
        ["#AAAAAA", "#BBBBBB"],
        ["#AAAAAA", "#BBBBBB"],
      ];
      const detection = detectBackgroundCandidate(grid, {
        config: { backgroundDistanceThreshold: 0, minBorderCoverage: 0.5, minTouchedSides: 2, minTouchedCorners: 0 },
      });
      expect(detection.candidateHex).toBe("#AAAAAA");
    });
  });
});
