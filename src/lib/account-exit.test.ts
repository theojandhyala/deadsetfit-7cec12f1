import { describe, expect, it, vi } from "vitest";

import { finishLocalAccountExit } from "./account-exit";

describe("finishLocalAccountExit", () => {
  it("keeps training state on logout but clears auth-derived state", () => {
    const removeItem = vi.fn();
    const dispatchExplicitLogout = vi.fn();
    const clearSessionBackup = vi.fn();
    finishLocalAccountExit({
      removeLocalTrainingState: false,
      removeItem,
      dispatchExplicitLogout,
      clearSessionBackup,
    });
    expect(removeItem).not.toHaveBeenCalled();
    expect(dispatchExplicitLogout).toHaveBeenCalledOnce();
    expect(clearSessionBackup).toHaveBeenCalledOnce();
  });

  it("removes device training state after permanent account deletion", () => {
    const removeItem = vi.fn();
    finishLocalAccountExit({
      removeLocalTrainingState: true,
      removeItem,
      dispatchExplicitLogout: vi.fn(),
      clearSessionBackup: vi.fn(),
    });
    expect(removeItem).toHaveBeenCalledWith("grit_app_state_v1");
  });

  it("finishes remaining cleanup when storage throws", () => {
    const dispatchExplicitLogout = vi.fn();
    const clearSessionBackup = vi.fn();
    finishLocalAccountExit({
      removeLocalTrainingState: true,
      removeItem: () => {
        throw new Error("storage unavailable");
      },
      dispatchExplicitLogout,
      clearSessionBackup,
    });
    expect(dispatchExplicitLogout).toHaveBeenCalledOnce();
    expect(clearSessionBackup).toHaveBeenCalledOnce();
  });
});
