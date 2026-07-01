import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import React from "react";
import AppraisalSection from "../components/AppraisalSection";
import ReportDownloadSection from "../components/ReportDownloadSection";

let mockFetchSuccess = true;
let errorOnAppraisalSubmit = false;

const mockFetch = vi.fn().mockImplementation((url, options) => {
  // Handle Geoapify API calls for address suggestions
  if (typeof url === 'string' && (url.includes("geoapify") || url.includes("geocode/autocomplete"))) {
    console.log("Geoapify API called:", url);
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        features: [
          {
            properties: {
              formatted: "1 Queen Street, Auckland Central, Auckland, 1010, New Zealand"
            }
          }
        ]
      }),
    });
  }
  
  // Handle appraisal API calls
  if (typeof url === 'string' && url.includes("/api/appraisal")) {
    if (errorOnAppraisalSubmit) {
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ success: false }),
      });
    }
    if (!mockFetchSuccess) {
      return Promise.reject(new Error("API Error"));
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  }
  
  // Handle other API calls
  if (!mockFetchSuccess) {
    return Promise.reject(new Error("API Error"));
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, action: "download", downloadUrl: "https://example.com/mock.pdf" }),
  });
});
global.fetch = mockFetch;

describe("AppraisalSection", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetchSuccess = true;
    errorOnAppraisalSubmit = false;
  });

  afterEach(() => {
    cleanup();
  });

  const fillForm = async () => {
    const addressInput = screen.getByPlaceholderText("Start typing your NZ address...");
    fireEvent.change(addressInput, { target: { value: "1 Queen Street, Auckland Central, Auckland, 1010, New Zealand" } });

    // Wait for suggestions to appear
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    // Try to select address from suggestions
    try {
      const suggestionItems = screen.queryAllByText(/Queen Street/i) || [];
      
      if (suggestionItems.length > 0) {
        fireEvent.mouseDown(suggestionItems[0]);
      } else {
        fireEvent.change(addressInput, { target: { value: "1 Queen Street, Auckland Central, Auckland, 1010, New Zealand" } });
      }
    } catch (e) {
      fireEvent.change(addressInput, { target: { value: "1 Queen Street, Auckland Central, Auckland, 1010, New Zealand" } });
    }

    // Wait for state to update
    await act(async () => {
      await Promise.resolve();
    });

    const nextBtn = screen.getByRole("button", { name: /Request Bespoke Analysis/i });
    
    if (nextBtn.getAttribute('disabled') === null) {
      fireEvent.click(nextBtn);
    }

    await act(async () => {
      await Promise.resolve();
    });

    const nameInput = screen.getByPlaceholderText("e.g. John Doe");
    const emailInput = screen.getByPlaceholderText("e.g. john@example.com");
    const phoneInput = screen.getByPlaceholderText("e.g. +64 21 000 0000");

    // Combobox order after suburb field added:
    // [0] = suburb, [1] = timeline, [2] = motivation, [3] = languagePreference, [4] = heardFrom
    const allSelects = screen.getAllByRole("combobox");
    const suburbSelect   = allSelects[0];
    const timelineSelect = allSelects[1];
    const motivationSelect = allSelects[2];

    fireEvent.change(nameInput,        { target: { value: "Bob" } });
    fireEvent.change(emailInput,       { target: { value: "bob@example.com" } });
    fireEvent.change(phoneInput,       { target: { value: "12345" } });
    fireEvent.change(suburbSelect,     { target: { value: "Albany" } });
    fireEvent.change(timelineSelect,   { target: { value: "within-3-months" } });
    fireEvent.change(motivationSelect, { target: { value: "upsizing" } });
  };

  it("should render translations and handle inputs", async () => {
    render(<AppraisalSection lang="en" />);
    expect(screen.getByText("Unlock Your Property’s True Capital Value")).toBeDefined();

    await fillForm();

    const nameInput = screen.getByPlaceholderText("e.g. John Doe") as HTMLInputElement;
    expect(nameInput.value).toBe("Bob");
  });

  it("should submit form successfully and show modal", async () => {
    render(<AppraisalSection lang="en" />);
    await fillForm();
    const submitBtn = screen.getByRole("button", { name: /Submit Bespoke Request/i });

    fireEvent.click(submitBtn);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/appraisal", expect.any(Object));
    expect(screen.getByText("Thank you!")).toBeDefined();

    const closeBtn = screen.getByRole("button", { name: /Close/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText("Thank you!")).toBeNull();
  });

  it("should handle error state when api fails", async () => {
    mockFetchSuccess = false;
    render(<AppraisalSection lang="en" />);
    await fillForm();
    const submitBtn = screen.getByRole("button", { name: /Submit Bespoke Request/i });

    fireEvent.click(submitBtn);

    await act(async () => {
      await Promise.resolve().catch(() => {});
    });

    expect(screen.getByText("An error occurred. Please try again.")).toBeDefined();
  });

  it("should handle error response from api gracefully", async () => {
    errorOnAppraisalSubmit = true;
    render(<AppraisalSection lang="en" />);
    await fillForm();
    const submitBtn = screen.getByRole("button", { name: /Submit Bespoke Request/i });

    fireEvent.click(submitBtn);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("An error occurred. Please try again.")).toBeDefined();
  });
});

describe("ReportDownloadSection", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetchSuccess = true;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("should render translations and handle inputs", () => {
    render(<ReportDownloadSection lang="en" />);
    expect(screen.getByText("Access the Latest Auckland & North Shore Hyper-Local Market Report")).toBeDefined();

    const firstNameInput = screen.getByPlaceholderText("e.g. Jane");
    const emailInput = screen.getByPlaceholderText("e.g. jane@example.com");

    fireEvent.change(firstNameInput, { target: { value: "Jane" } });
    fireEvent.change(emailInput, { target: { value: "jane@example.com" } });

    expect((firstNameInput as HTMLInputElement).value).toBe("Jane");
  });

  it("should submit form successfully and trigger download", async () => {
    Object.defineProperty(window, "location", {
      value: { assign: vi.fn() },
      writable: true,
    });

    render(<ReportDownloadSection lang="en" />);
    const firstNameInput = screen.getByPlaceholderText("e.g. Jane");
    const emailInput = screen.getByPlaceholderText("e.g. jane@example.com");
    const submitBtn = screen.getByRole("button", { name: /Download PDF Report/i });

    fireEvent.change(firstNameInput, { target: { value: "Jane" } });
    fireEvent.change(emailInput, { target: { value: "jane@example.com" } });

    fireEvent.click(submitBtn);

    // wait for async actions
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/reports/download", expect.any(Object));
  });

  it("should handle error state when api fails", async () => {
    mockFetchSuccess = false;
    render(<ReportDownloadSection lang="en" />);
    const firstNameInput = screen.getByPlaceholderText("e.g. Jane");
    const emailInput = screen.getByPlaceholderText("e.g. jane@example.com");
    const submitBtn = screen.getByRole("button", { name: /Download PDF Report/i });

    fireEvent.change(firstNameInput, { target: { value: "Jane" } });
    fireEvent.change(emailInput, { target: { value: "jane@example.com" } });

    fireEvent.click(submitBtn);

    await act(async () => {
      await Promise.resolve().catch(() => {});
    });

    expect(screen.getByText("An error occurred. Please try again.")).toBeDefined();
  });
});
