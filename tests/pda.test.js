import assert from "node:assert/strict";
import test from "node:test";

import {
  FINAL_STATE,
  INPUT_SYMBOLS,
  STATES,
  TRANSITIONS,
  applyTransition,
  createInitialConfiguration,
  runSequence,
} from "../src/pda.js";

test("defines a ten-state deterministic PDA", () => {
  assert.deepEqual(STATES, ["q0", "q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "qf"]);
  assert.equal(FINAL_STATE, "qf");
  assert.equal(TRANSITIONS.length, 19);
  assert.deepEqual(INPUT_SYMBOLS, [..."ickvpdsfmrle"]);
  assert.ok(Object.isFrozen(TRANSITIONS));
  assert.ok(TRANSITIONS.every(({ push }) => Object.isFrozen(push)));

  const keys = TRANSITIONS.map(({ from, read, pop }) => `${from}|${read}|${pop}`);
  assert.equal(new Set(keys).size, keys.length, "transition rules must be deterministic");
});

test("creates a fresh initial configuration with Z at the bottom of the stack", () => {
  const first = createInitialConfiguration();
  const second = createInitialConfiguration();

  assert.deepEqual(first, { state: "q0", stack: ["Z"] });
  assert.notEqual(first.stack, second.stack);
});

test("applies every existing rule without mutating its input configuration", () => {
  for (const rule of TRANSITIONS) {
    const stack = rule.pop === "Z" ? ["Z"] : ["Z", rule.pop];
    const configuration = { state: rule.from, stack };
    const originalStack = [...stack];
    const result = applyTransition(configuration, rule.read);

    assert.ok(result, `missing rule: ${rule.from}, ${rule.read}, ${rule.pop}`);
    assert.equal(result.state, rule.to);
    assert.deepEqual(result.stack, [
      ...(rule.pop === "Z" ? [] : ["Z"]),
      ...rule.push.slice().reverse(),
    ]);
    assert.deepEqual(configuration.stack, originalStack);
  }
});

test("the vault gate requires both credentials in either stack order", () => {
  const gateRules = TRANSITIONS
    .filter(({ from }) => ["q4", "q7", "q8"].includes(from))
    .map(({ from, read, pop, to, push }) => [from, read, pop, to, push.join("")]);

  assert.deepEqual(gateRules, [
    ["q4", "d", "C", "q7", ""],
    ["q4", "s", "K", "q7", ""],
    ["q7", "d", "C", "q8", ""],
    ["q7", "s", "K", "q8", ""],
    ["q8", "f", "Z", "q5", "Z"],
  ]);
  assert.equal(runSequence("icvkvpsd").state, "q8");
  assert.equal(runSequence("ikvcvpds").state, "q8");
});

test("keeps the stack top at the end of the array and preserves the current game flow", () => {
  assert.deepEqual(runSequence("ic").stack, ["Z", "C"]);
  assert.deepEqual(runSequence("ik").stack, ["Z", "K"]);
  assert.deepEqual(runSequence("icvkvpsdf").stack, ["Z"]);
  assert.deepEqual(runSequence("icvkvpsdfmmrll").stack, ["Z"]);
});

test("accepts the existing successful examples", () => {
  assert.equal(runSequence("icvkvpsdfmrle").accepted, true);
  assert.equal(runSequence("ikvcvpdsfmmrlle").accepted, true);
  assert.equal(runSequence("icvkvpsdfmmrlle").accepted, true);
});

test("rejects opening the vault after collecting only one credential", () => {
  assert.equal(runSequence("icvpdfmrle").accepted, false);
  assert.equal(runSequence("ikvpsfmrle").accepted, false);
});

test("rejects the two existing unsuccessful examples", () => {
  assert.equal(runSequence("icvkvpdsfmrle").accepted, false);
  assert.equal(runSequence("icvkvpsdfmmrle").accepted, false);
});

test("matches all fifteen acceptance cases from the delivery plan", () => {
  const cases = [
    ["icvkvpsdfmrle", true],
    ["ikvcvpdsfmmrlle", true],
    ["icvkvpsdfmmrlle", true],
    ["icvpdfmrle", false],
    ["ikvpsfmrle", false],
    ["icvkvpdsfmrle", false],
    ["icvkvpsdfmmrle", false],
    ["icvkvpsdfrle", false],
    ["icvkvpsdfmrlle", false],
    ["icvkvpsdfmrlee", false],
    ["icvkvpsdfm", false],
    ["icvkvcvpdsfmrle", false],
    ["", false],
    ["i", false],
    ["xyz", false],
  ];

  assert.equal(cases.length, 15);
  for (const [input, accepted] of cases) {
    assert.equal(runSequence(input).accepted, accepted, `unexpected result for ${input || "ε"}`);
  }
  assert.equal(runSequence("icvkvpsdfmrle").state, FINAL_STATE);
});

test("an undefined transition leaves the original configuration unchanged", () => {
  const configuration = { state: "q2", stack: ["Z", "C"] };
  const snapshot = { state: configuration.state, stack: [...configuration.stack] };

  assert.equal(applyTransition(configuration, "c"), null);
  assert.deepEqual(configuration, snapshot);
});

test("all inputs through length four execute deterministically without exceptions", () => {
  const visit = (prefix, remaining) => {
    const result = runSequence(prefix);
    assert.equal(typeof result.accepted, "boolean");
    assert.equal(result.stack[0], "Z");
    assert.equal(result.stack.filter((symbol) => symbol === "Z").length, 1);

    if (remaining === 0) return;
    for (const symbol of INPUT_SYMBOLS) visit(prefix + symbol, remaining - 1);
  };

  visit("", 4);
});

test("enumerates exactly the intended language through length seventeen", () => {
  const accepted = new Set();

  const visit = (configuration, input) => {
    if (configuration.state === FINAL_STATE) accepted.add(input);
    if (input.length === 17) return;

    const top = configuration.stack.at(-1);
    for (const rule of TRANSITIONS) {
      if (rule.from !== configuration.state || rule.pop !== top) continue;
      const next = applyTransition(configuration, rule.read);
      visit(next, input + rule.read);
    }
  };

  visit(createInitialConfiguration(), "");

  const expected = new Set();
  for (const prefix of ["icvkvpsdf", "ikvcvpdsf"]) {
    for (let count = 1; prefix.length + (2 * count) + 2 <= 17; count++) {
      expected.add(`${prefix}${"m".repeat(count)}r${"l".repeat(count)}e`);
    }
  }

  assert.equal(accepted.size, 6);
  assert.equal(expected.size, 6);
  assert.deepEqual([...accepted].sort(), [...expected].sort());
});
