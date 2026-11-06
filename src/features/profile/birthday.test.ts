import { describe, expect, it } from "vitest";
import {
  birthdayFromMonthDay,
  isBirthdayToday,
  isBirthdayTodayIn,
  todayMonthDay,
} from "@/features/profile/birthday";

const NOW = new Date(2026, 10, 3, 12, 0, 0); // the 3rd of November, 2026

describe("the shape the server sends a birthday in", () => {
  it("reads a pair, padded or not", () => {
    expect(birthdayFromMonthDay("11-03")).toEqual({ month: 11, day: 3 });
    // The pad is the sender's business rather than the reader's: it is the same
    // day either way. The old compare in the two profiles was a plain string
    // equality against a padded `todayMonthDay()`, so this one answered false.
    expect(birthdayFromMonthDay("11-3")).toEqual({ month: 11, day: 3 });
  });

  it("refuses anything that is not a day of the year", () => {
    // The round trip is the check: the calendar rolls the 31st of February
    // forward to the 2nd of March rather than refusing it, so a pair is trusted
    // only when it reads back as the pair that built it.
    expect(birthdayFromMonthDay("02-31")).toBeNull();
    expect(birthdayFromMonthDay("13-01")).toBeNull();
    expect(birthdayFromMonthDay("00-10")).toBeNull();
    expect(birthdayFromMonthDay("11-00")).toBeNull();
    // A whole date is not the shape, and neither is nothing.
    expect(birthdayFromMonthDay("2026-11-03")).toBeNull();
    expect(birthdayFromMonthDay("")).toBeNull();
    expect(birthdayFromMonthDay("   ")).toBeNull();
    expect(birthdayFromMonthDay(null)).toBeNull();
    expect(birthdayFromMonthDay(undefined)).toBeNull();
    expect(birthdayFromMonthDay({ month: 11 })).toBeNull();
  });
});

describe("whether today is somebody's day", () => {
  it("writes today the way the server does", () => {
    expect(todayMonthDay(NOW)).toBe("11-03");
    expect(todayMonthDay(new Date(2026, 0, 9))).toBe("01-09");
  });

  it("answers for the day and only the day", () => {
    expect(isBirthdayToday("11-03", NOW)).toBe(true);
    expect(isBirthdayToday("11-3", NOW)).toBe(true);
    expect(isBirthdayToday("11-04", NOW)).toBe(false);
    expect(isBirthdayToday("11-02", NOW)).toBe(false);
    // A payload with no birthday on it is not a birthday, and neither is a
    // malformed one — a cake is not drawn off a value nobody could read.
    expect(isBirthdayToday("", NOW)).toBe(false);
    expect(isBirthdayToday(null, NOW)).toBe(false);
    expect(isBirthdayToday("99-99", NOW)).toBe(false);
  });

  it("reads the field off whatever the caller is holding", () => {
    expect(isBirthdayTodayIn({ birthday: "11-03" }, NOW)).toBe(true);
    expect(isBirthdayTodayIn({ birthday: "03-11" }, NOW)).toBe(false);
    // A person the screen has not read yet, or has no birthday to show.
    expect(isBirthdayTodayIn(null, NOW)).toBe(false);
    expect(isBirthdayTodayIn(undefined, NOW)).toBe(false);
    expect(isBirthdayTodayIn({}, NOW)).toBe(false);
  });
});
