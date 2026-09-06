export type AccountExitCleanup = {
  removeLocalTrainingState: boolean;
  removeItem: (key: string) => void;
  dispatchExplicitLogout: () => void;
  clearSessionBackup: () => void;
};

/**
 * Local cleanup shared by sign-out and deletion. Every operation is
 * best-effort so a broken storage implementation can never hold the account
 * action hostage after the server has already completed it.
 */
export function finishLocalAccountExit(cleanup: AccountExitCleanup): void {
  if (cleanup.removeLocalTrainingState) {
    try {
      cleanup.removeItem("grit_app_state_v1");
    } catch {
      // Private storage modes can throw on removeItem.
    }
  }
  try {
    cleanup.dispatchExplicitLogout();
  } catch {
    // Event delivery is advisory; auth sign-out still continues.
  }
  try {
    cleanup.clearSessionBackup();
  } catch {
    // A corrupt backup must not block logout or account deletion.
  }
}
