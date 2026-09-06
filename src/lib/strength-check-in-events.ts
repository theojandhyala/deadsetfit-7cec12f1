export const OPEN_STRENGTH_CHECK_IN_EVENT = "deadset:open-strength-check-in";

export function openStrengthCheckIn(): void {
  window.dispatchEvent(new Event(OPEN_STRENGTH_CHECK_IN_EVENT));
}
