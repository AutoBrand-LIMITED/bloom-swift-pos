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
  it("keeps the operator and team read-only while applying the selected employee Sales Team", () => {
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
          {
            id: "AC02",
            name: "Elma",
            code: "AC02",
            odooEmployeeId: 95,
            salesTeamId: 7,
            salesTeamName: "Retail",
          },
          {
            id: "AC03",
            name: "May",
            code: "AC03",
            odooEmployeeId: 96,
            salesTeamId: 8,
            salesTeamName: "Corporate Events",
          },
        ]}
        onSalespersonChange={onSalespersonChange}
        onSalesTeamChange={onSalesTeamChange}
      />,
    );

    expect(screen.getByLabelText("登入操作員")).toHaveTextContent("AC02 — Elma");
    fireEvent.click(screen.getByRole("combobox", { name: "負責銷售員" }));
    expect(screen.getByPlaceholderText("搜尋員工編號或姓名...")).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: "AC03 — May" }));
    expect(onSalespersonChange).toHaveBeenCalledWith("AC03 — May", 96, 8, "Corporate Events");
    expect(screen.getByLabelText("Sales Team")).toHaveTextContent("Retail");
    expect(screen.queryByRole("textbox", { name: /Sales Team/ })).not.toBeInTheDocument();
    expect(onSalesTeamChange).not.toHaveBeenCalled();
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

  it("blocks unverified salesperson choices while preserving a legacy team snapshot", () => {
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
    expect(screen.getByLabelText("Sales Team")).toHaveTextContent("Corporate");
    expect(screen.getAllByText(/不會提供未驗證選項/)).toHaveLength(1);
  });

  it("shows an actionable warning when the employee has no linked Sales Team", () => {
    render(
      <SalesIdSection
        salesId="AC02 — Elma"
        salespersonEmployeeId={95}
        department=""
        employee={operator}
        staff={[{ id: "AC02", name: "Elma", code: "AC02", odooEmployeeId: 95 }]}
        onSalespersonChange={vi.fn()}
        onSalesTeamChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Sales Team")).toHaveTextContent("未連結 Sales Team");
    expect(screen.getByText(/Odoo Employees 連結 Sales Team/)).toBeVisible();
  });

  it("allows a manager to override the team for only the current order", () => {
    const onSalesTeamChange = vi.fn();
    render(
      <SalesIdSection
        salesId="AC02 — Elma"
        salespersonEmployeeId={95}
        department="Retail"
        salesTeamId={7}
        salesTeams={[
          { id: 7, name: "Retail" },
          { id: 8, name: "Corporate Events" },
        ]}
        employee={{ ...operator, role: "manager" }}
        staff={[{
          id: "AC02",
          name: "Elma",
          code: "AC02",
          odooEmployeeId: 95,
          salesTeamId: 7,
          salesTeamName: "Retail",
        }]}
        onSalespersonChange={vi.fn()}
        onSalesTeamChange={onSalesTeamChange}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Sales Team" }));
    fireEvent.click(screen.getByRole("option", { name: "Corporate Events" }));

    expect(onSalesTeamChange).toHaveBeenCalledWith(8, "Corporate Events");
    expect(screen.getByText(/主管只會覆寫今張訂單/)).toBeVisible();
  });

  it("waits for the selected employee before enabling a manager override", () => {
    render(
      <SalesIdSection
        salesId="AC02 — Elma"
        salespersonEmployeeId={95}
        department=""
        salesTeams={[{ id: 8, name: "Corporate Events" }]}
        employee={{ ...operator, role: "manager" }}
        staff={[]}
        staffLoading
        onSalespersonChange={vi.fn()}
        onSalesTeamChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Sales Team" })).toBeDisabled();
  });
});
