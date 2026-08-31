import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SalesIdSection from "@/components/pos/SalesIdSection";

vi.stubGlobal("ResizeObserver", class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
});

const operator = {
  id: 95,
  name: "Elma",
  login: "elma",
  salesLabel: "AC02 — Elma",
  role: "staff" as const,
};

describe("SalesIdSection assignment", () => {
  it("keeps the operator read-only while allowing a responsible salesperson and free-text Sales Team", () => {
    const onSalespersonChange = vi.fn();
    const onSalesTeamChange = vi.fn();
    render(
      <SalesIdSection
        salesId="AC02 — Elma"
        salespersonEmployeeId={95}
        department="Retail"
        employee={operator}
        staff={[
          { id: "AC02", name: "Elma", code: "AC02", odooEmployeeId: 95 },
          { id: "AC03", name: "May", code: "AC03", odooEmployeeId: 96 },
        ]}
        onSalespersonChange={onSalespersonChange}
        onSalesTeamChange={onSalesTeamChange}
      />,
    );

    expect(screen.getByLabelText("登入操作員")).toHaveTextContent("AC02 — Elma");
    fireEvent.click(screen.getByRole("combobox", { name: "負責銷售員" }));
    expect(screen.getByPlaceholderText("搜尋員工編號或姓名...")).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: "AC03 — May" }));
    expect(onSalespersonChange).toHaveBeenCalledWith("AC03 — May", 96);

    fireEvent.change(screen.getByRole("textbox", { name: "Sales Team（選填）" }), {
      target: { value: "Corporate Events" },
    });
    expect(onSalesTeamChange).toHaveBeenCalledWith("Corporate Events");
  });

  it("filters the salesperson list by employee code or name", () => {
    render(
      <SalesIdSection
        salesId="AC02 — Elma"
        salespersonEmployeeId={95}
        department=""
        employee={operator}
        staff={[
          { id: "AC02", name: "Elma", code: "AC02", odooEmployeeId: 95 },
          { id: "AC03", name: "May", code: "AC03", odooEmployeeId: 96 },
          { id: "RITA", name: "Rita Li", code: "RITA", odooEmployeeId: 97 },
        ]}
        onSalespersonChange={vi.fn()}
        onSalesTeamChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "負責銷售員" }));
    fireEvent.change(screen.getByPlaceholderText("搜尋員工編號或姓名..."), {
      target: { value: "rita" },
    });

    expect(screen.getByRole("option", { name: "RITA — Rita Li" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "AC03 — May" })).not.toBeInTheDocument();
  });

  it("blocks unverified salesperson choices while keeping Sales Team as text", () => {
    render(
      <SalesIdSection
        salesId="AC03 — May"
        salespersonEmployeeId={96}
        department="Corporate"
        employee={operator}
        staff={[]}
        staffError="offline"
        onSalespersonChange={vi.fn()}
        onSalesTeamChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "負責銷售員" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "負責銷售員" })).toHaveTextContent("AC03 — May");
    expect(screen.getByRole("textbox", { name: "Sales Team（選填）" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Sales Team（選填）" })).toHaveValue("Corporate");
    expect(screen.getAllByText(/不會提供未驗證選項/)).toHaveLength(1);
  });
});
