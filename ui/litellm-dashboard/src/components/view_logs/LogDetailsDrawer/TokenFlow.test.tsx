import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TokenFlow } from "./TokenFlow";

const localised = (count: number) => count.toLocaleString();

describe("TokenFlow", () => {
  it("should render the total followed by its prompt and completion breakdown", () => {
    render(<TokenFlow prompt={9} completion={3} total={12} />);

    expect(screen.getByText("12（输入 9 + 输出 3）")).toBeInTheDocument();
  });

  it("should group large counts the way the reader's locale does", () => {
    render(<TokenFlow prompt={1234567} completion={89012} total={1323579} />);

    expect(screen.getByText(`${localised(1323579)}（输入 ${localised(1234567)} + 输出 ${localised(89012)}）`)).toBeInTheDocument();
  });

  it("should fall back to zero for counts the log entry does not carry", () => {
    render(<TokenFlow total={12} />);

    expect(screen.getByText("12（输入 0 + 输出 0）")).toBeInTheDocument();
  });
});
