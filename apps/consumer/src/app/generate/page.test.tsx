import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GeneratePage from "./page";

describe("GeneratePage", () => {
  it("TC-FLOW-001: 默认渲染并选中冰箱贴 + 标准", () => {
    render(<GeneratePage />);

    expect(screen.getByText("拼豆小纸条")).toBeInTheDocument();
    expect(
      screen.getByText("把你的图片变成一张可以照着拼的拼豆小纸条")
    ).toBeInTheDocument();

    // 默认用途：冰箱贴
    const fridgeButton = screen.getByRole("button", { name: "冰箱贴" });
    expect(fridgeButton).toHaveAttribute("aria-pressed", "true");

    // 默认模式：标准清晰
    const standardButton = screen.getByRole("button", { name: "标准清晰" });
    expect(standardButton).toHaveAttribute("aria-pressed", "true");

    // 生成按钮禁用（未上传图片）
    const generateButton = screen.getByRole("button", { name: "生成拼豆图纸" });
    expect(generateButton).toBeDisabled();
  });

  it("点击用途和模式会切换 aria-pressed 状态", async () => {
    const user = userEvent.setup();
    render(<GeneratePage />);

    const keychainButton = screen.getByRole("button", { name: "挂件" });
    const beginnerButton = screen.getByRole("button", { name: "新手友好" });

    expect(keychainButton).toHaveAttribute("aria-pressed", "false");
    expect(beginnerButton).toHaveAttribute("aria-pressed", "false");

    await user.click(keychainButton);
    await user.click(beginnerButton);

    expect(keychainButton).toHaveAttribute("aria-pressed", "true");
    expect(beginnerButton).toHaveAttribute("aria-pressed", "true");
  });

  it("容器最大宽度为 390px，适配移动端首屏", () => {
    render(<GeneratePage />);
    const container = screen.getByText("拼豆小纸条").closest("div");
    expect(container).toHaveClass("max-w-[390px]");
  });

  it("显示开发色板提示", () => {
    render(<GeneratePage />);
    expect(screen.getByText("当前使用开发色板，颜色为示意")).toBeInTheDocument();
  });

  it("显示隐私声明", () => {
    render(<GeneratePage />);
    expect(screen.getByText("图片仅在本机处理，不上传服务器")).toBeInTheDocument();
  });

  it("上传区域显示选择图片占位", () => {
    render(<GeneratePage />);
    const uploadButtons = screen.getAllByText("选择图片");
    expect(uploadButtons.length).toBeGreaterThanOrEqual(1);
  });
});
