import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SalesIdSection from "@/components/pos/SalesIdSection";


describe("SalesIdSection employee binding", () => {
  it("shows the logged-in employee as read-only instead of an employee picker", () => {
    render(
      <SalesIdSection
        salesId="AC02 — Elma"
        employee={{
          id: 95,
          name: "Elma",
          login: "elma",
          salesLabel: "AC02 — Elma",
        }}
        onSalespersonChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("負責員工")).toHaveTextContent("AC02 — Elma");
    expect(screen.queryByRole("combobox", { name: "負責員工" })).not.toBeInTheDocument();
    expect(screen.getByText(/不能切換其他員工/)).toBeInTheDocument();
  });
});
