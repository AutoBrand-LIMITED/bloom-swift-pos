import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SalesIdSection from "@/components/pos/SalesIdSection";

const operator = {
  id: 95,
  name: "Elma",
  login: "elma",
  salesLabel: "AC02 — Elma",
  role: "staff" as const,
};

describe("SalesIdSection assignment", () => {
  it("keeps the operator read-only while allowing a responsible salesperson and Sales Team", () => {
    const onSalespersonChange = vi.fn();
    const onSalesTeamChange = vi.fn();
    render(
      <SalesIdSection
        salesId="AC02 — Elma"
        salespersonEmployeeId={95}
        department="Retail"
        salesTeamId={7}
        employee={operator}
        staff={[
          { id: "AC02", name: "Elma", code: "AC02", odooEmployeeId: 95 },
          { id: "AC03", name: "May", code: "AC03", odooEmployeeId: 96 },
        ]}
        teams={[{ id: 7, name: "Retail" }, { id: 8, name: "Corporate" }]}
        onSalespersonChange={onSalespersonChange}
        onSalesTeamChange={onSalesTeamChange}
      />,
    );

    expect(screen.getByLabelText("登入操作員")).toHaveTextContent("AC02 — Elma");
    fireEvent.click(screen.getByRole("combobox", { name: "負責銷售員" }));
    fireEvent.click(screen.getByRole("option", { name: "AC03 — May" }));
    expect(onSalespersonChange).toHaveBeenCalledWith("AC03 — May", 96);

    fireEvent.click(screen.getByRole("combobox", { name: "Sales Team（選填）" }));
    fireEvent.click(screen.getByRole("option", { name: "Corporate" }));
    expect(onSalesTeamChange).toHaveBeenCalledWith("Corporate", 8);
  });

  it("renders a saved assignment but blocks unverified choices after reference failure", () => {
    render(
      <SalesIdSection
        salesId="AC03 — May"
        salespersonEmployeeId={96}
        department="Corporate"
        salesTeamId={8}
        employee={operator}
        staff={[]}
        teams={[]}
        staffError="offline"
        teamsError="offline"
        onSalespersonChange={vi.fn()}
        onSalesTeamChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "負責銷售員" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "負責銷售員" })).toHaveTextContent("AC03 — May");
    expect(screen.getByRole("combobox", { name: "Sales Team（選填）" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Sales Team（選填）" })).toHaveTextContent("Corporate");
    expect(screen.getAllByText(/不會提供未驗證選項/)).toHaveLength(2);
  });
});
