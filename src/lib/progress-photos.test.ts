import { describe, expect, it } from "vitest";

import {
  CHECK_IN_INTERVAL_DAYS,
  daysSinceLastCheckIn,
  isCheckInDue,
  photoJourney,
  spanLabel,
  weightNear,
} from "./progress-photos";

const shot = (date: string, photoDataUrl = "data:image/jpeg;base64,x") => ({ date, photoDataUrl });

describe("photoJourney", () => {
  it("has nothing to say with no photos", () => {
    const journey = photoJourney({});
    expect(journey.first).toBeNull();
    expect(journey.count).toBe(0);
    expect(journey.meaningful).toBe(false);
  });

  it("orders by date rather than by insertion", () => {
    // Photos can arrive out of order — an older shot imported after a newer
    // one — and a reversed before/after is the one mistake that would make the
    // card actively insulting.
    const journey = photoJourney({
      checkIns: [shot("2026-03-01T00:00:00Z"), shot("2026-01-01T00:00:00Z")],
    });
    expect(journey.first?.date).toBe("2026-01-01T00:00:00Z");
    expect(journey.latest?.date).toBe("2026-03-01T00:00:00Z");
  });

  it("counts the days between the ends", () => {
    const journey = photoJourney({
      checkIns: [shot("2026-01-01T00:00:00Z"), shot("2026-03-01T00:00:00Z")],
    });
    expect(journey.daysApart).toBe(59);
    expect(journey.meaningful).toBe(true);
  });

  it("is not meaningful with a single photo", () => {
    expect(photoJourney({ checkIns: [shot("2026-01-01T00:00:00Z")] }).meaningful).toBe(false);
  });

  it("is not meaningful when the shots are days apart", () => {
    const journey = photoJourney({
      checkIns: [shot("2026-01-01T00:00:00Z"), shot("2026-01-05T00:00:00Z")],
    });
    expect(journey.count).toBe(2);
    expect(journey.meaningful).toBe(false);
  });

  it("ignores entries carrying no image", () => {
    const journey = photoJourney({
      checkIns: [shot("2026-01-01T00:00:00Z"), { date: "2026-03-01T00:00:00Z", photoDataUrl: "" }],
    });
    expect(journey.count).toBe(1);
  });

  it("reports the bodyweight change across the span", () => {
    const journey = photoJourney({
      checkIns: [shot("2026-01-01T00:00:00Z"), shot("2026-03-01T00:00:00Z")],
      weights: [
        { date: "2026-01-02T00:00:00Z", weight: 80 },
        { date: "2026-02-28T00:00:00Z", weight: 84.4 },
      ],
    });
    expect(journey.weightDeltaKg).toBe(4.4);
  });

  it("reports no delta when bodyweight was never logged", () => {
    const journey = photoJourney({
      checkIns: [shot("2026-01-01T00:00:00Z"), shot("2026-03-01T00:00:00Z")],
    });
    expect(journey.weightDeltaKg).toBeNull();
  });
});

describe("weightNear", () => {
  it("picks the closest entry either side of the date", () => {
    const weights = [
      { date: "2026-01-01T00:00:00Z", weight: 70 },
      { date: "2026-02-01T00:00:00Z", weight: 75 },
    ];
    expect(weightNear(weights, "2026-01-25T00:00:00Z")).toBe(75);
    expect(weightNear(weights, "2026-01-05T00:00:00Z")).toBe(70);
  });

  it("returns null with nothing logged", () => {
    expect(weightNear([], "2026-01-01T00:00:00Z")).toBeNull();
  });
});

describe("check-in prompting", () => {
  const now = new Date("2026-03-01T12:00:00Z");

  it("counts whole days since the newest shot", () => {
    expect(daysSinceLastCheckIn({ checkIns: [shot("2026-02-22T12:00:00Z")] }, now)).toBe(7);
  });

  it("uses the newest shot, not the last in the array", () => {
    const checkIns = [shot("2026-02-28T12:00:00Z"), shot("2026-01-01T00:00:00Z")];
    expect(daysSinceLastCheckIn({ checkIns }, now)).toBe(1);
  });

  it("never reports negative days for a device clock running fast", () => {
    expect(daysSinceLastCheckIn({ checkIns: [shot("2026-03-02T12:00:00Z")] }, now)).toBe(0);
  });

  it("is due once the interval has passed", () => {
    expect(isCheckInDue({ checkIns: [shot("2026-02-22T12:00:00Z")] }, now)).toBe(true);
    expect(isCheckInDue({ checkIns: [shot("2026-02-25T12:00:00Z")] }, now)).toBe(false);
  });

  it("does not nag somebody who has never taken one", () => {
    // An empty state has a far better pitch than a reminder to do a thing you
    // have never done.
    expect(isCheckInDue({ checkIns: [] }, now)).toBe(false);
    expect(daysSinceLastCheckIn({ checkIns: [] }, now)).toBeNull();
  });

  it("prompts on a weekly rhythm", () => {
    expect(CHECK_IN_INTERVAL_DAYS).toBe(7);
  });
});

describe("spanLabel", () => {
  it("switches to weeks once there are enough days to round sensibly", () => {
    expect(spanLabel(59)).toBe("8 weeks apart");
    expect(spanLabel(13)).toBe("13 days apart");
    expect(spanLabel(1)).toBe("1 day apart");
  });
});
