import { describe, expect, test } from "bun:test";
import { Duration, Equal, Option, Schema } from "effect";
import { elapsed, hasSettled, Job, Run } from "../../src/domain";
import { job, run, T0 } from "../support/domain";

const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

describe("Run", () => {
  test("two polls returning the same data give equal values (no state change, no re-render)", () => {
    const a = [run({ startedAt: at(1) }), run({ number: 2 })];
    const b = [run({ startedAt: at(1) }), run({ number: 2 })];
    expect(Equal.equals(a, b)).toBe(true);
    expect(Equal.equals(a, [run({ startedAt: at(2) }), run({ number: 2 })])).toBe(false);
  });

  test("round-trips through JSON (used by the run cache)", () => {
    const codec = Schema.toCodecJson(Run);
    const original = run({ status: "running", startedAt: at(5), actor: "octocat" });
    const json = JSON.parse(JSON.stringify(Schema.encodeSync(codec)(original)));
    expect(json.createdAt).toBe("2026-11-27T10:00:00.000Z");
    const decoded = Schema.decodeUnknownSync(codec)(json);
    expect(decoded).toBeInstanceOf(Run);
    expect(Equal.equals(decoded, original)).toBe(true);
  });

  test("rejects a non-integer run number", () => {
    expect(() => run({ number: 1.5 })).toThrow();
  });
});

describe("Job", () => {
  test("progress must be within 0..1", () => {
    expect(job({ progress: 0.4 }).progress).toBe(0.4);
    expect(() => job({ progress: 1.2 })).toThrow();
  });

  test("round-trips through JSON with its steps", () => {
    const codec = Schema.toCodecJson(Job);
    const original = job({ stage: "test", startedAt: at(1) });
    const decoded = Schema.decodeUnknownSync(codec)(
      JSON.parse(JSON.stringify(Schema.encodeSync(codec)(original))),
    );
    expect(Equal.equals(decoded, original)).toBe(true);
  });
});

describe("elapsed", () => {
  test("none before start", () => {
    expect(Option.isNone(elapsed({}, at(10)))).toBe(true);
  });

  test("until now while running, until finish once finished", () => {
    expect(elapsed({ startedAt: at(0) }, at(42)).pipe(Option.map(Duration.toSeconds))).toEqual(
      Option.some(42),
    );
    expect(
      elapsed({ startedAt: at(0), finishedAt: at(30) }, at(99)).pipe(Option.map(Duration.toSeconds)),
    ).toEqual(Option.some(30));
  });

  test("never negative (clock skew between us and the provider)", () => {
    expect(elapsed({ startedAt: at(10) }, at(5)).pipe(Option.map(Duration.toMillis))).toEqual(Option.some(0));
  });
});

describe("hasSettled", () => {
  test("active → final", () => {
    expect(hasSettled(run({ status: "running" }), run({ status: "failure" }))).toBe(true);
    expect(hasSettled(run({ status: "queued" }), run({ status: "success" }))).toBe(true);
  });

  test("not when it stays active, was already final, or is seen for the first time", () => {
    expect(hasSettled(run({ status: "queued" }), run({ status: "running" }))).toBe(false);
    expect(hasSettled(run({ status: "success" }), run({ status: "success" }))).toBe(false);
    expect(hasSettled(undefined, run({ status: "success" }))).toBe(false);
  });
});
