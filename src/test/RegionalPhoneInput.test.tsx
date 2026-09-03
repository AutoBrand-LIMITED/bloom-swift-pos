import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RegionalPhoneInput from "@/components/pos/RegionalPhoneInput";

describe("RegionalPhoneInput", () => {
  it("adds the selected country code when a local international number is entered", () => {
    const onChange = vi.fn();
    render(
      <RegionalPhoneInput
        id="phone"
        ariaLabel="下單人電話"
        value=""
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "國家或地區區號" }), {
      target: { value: "SG" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "下單人電話" }), {
      target: { value: "81234567" },
    });

    expect(onChange).toHaveBeenLastCalledWith("+6581234567");
  });

  it("auto-detects a pasted Singapore number and emits canonical E.164", () => {
    const onChange = vi.fn();
    render(
      <RegionalPhoneInput
        id="phone"
        ariaLabel="下單人電話"
        value=""
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "下單人電話" }), {
      target: { value: "+65 8123 4567" },
    });

    expect(screen.getByRole("combobox", { name: "國家或地區區號" })).toHaveValue("SG");
    expect(screen.getByRole("textbox", { name: "下單人電話" })).toHaveValue("81234567");
    expect(onChange).toHaveBeenCalledWith("+6581234567");
  });

  it("shows a Canadian number as country code plus national digits", () => {
    render(
      <RegionalPhoneInput
        id="phone"
        ariaLabel="下單人電話"
        value="+1 (416) 555-0123"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "國家或地區區號" })).toHaveValue("CA");
    expect(screen.getByRole("textbox", { name: "下單人電話" })).toHaveValue("4165550123");
  });
});
