import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import GiftCardSection from "@/components/pos/GiftCardSection";

describe("GiftCardSection Markdown preview", () => {
  it("renders supported emphasis while escaping unsafe HTML", () => {
    const { container } = render(
      <GiftCardSection
        enabled
        message={'**Bold <script>alert("x")</script>** and *italic & safe*'}
        onEnabledChange={vi.fn()}
        onMessageChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "預覽" }));

    expect(container.querySelector("strong")).toHaveTextContent('Bold <script>alert("x")</script>');
    expect(container.querySelector("em")).toHaveTextContent("italic & safe");
    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).toContain("&lt;script&gt;");
  });
});
