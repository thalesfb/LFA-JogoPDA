import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { INPUT_SYMBOLS, STATES, TRANSITIONS, runSequence } from "../src/pda.js";
import { SYMBOL_DESC } from "../src/game-config.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../script.js", import.meta.url), "utf8");

test("the SVG diagram labels every canonical transition and state exactly once", () => {
  const diagramTransitions = [...html.matchAll(/<text data-transition="([^"]*)"[^>]*>([^<]*)<\/text>/g)]
    .map(([, transition, label]) => {
      const [, read, pop, , push] = transition.split("|");
      assert.equal(label.trim(), `${read}, ${pop} ; ${push || "λ"}`);
      return transition;
    })
    .sort();
  const modelTransitions = TRANSITIONS
    .map(({ from, read, pop, to, push }) => [from, read, pop, to, push.join("")].join("|"))
    .sort();
  const diagramEdges = [...html.matchAll(/data-edge="([^"]*)"/g)]
    .map(([, edge]) => edge)
    .sort();
  const modelEdges = [...new Set(TRANSITIONS.map(({ from, to }) => `${from}|${to}`))].sort();
  const diagramStates = [...html.matchAll(/data-state="([^"]*)"/g)]
    .map(([, state]) => state)
    .sort();

  assert.deepEqual(diagramTransitions, modelTransitions);
  assert.deepEqual(diagramEdges, modelEdges);
  assert.deepEqual(diagramStates, [...STATES].sort());
});

test("all four HTML examples match acceptance in the canonical PDA", () => {
  const examples = [...html.matchAll(/class="example-btn (accept|reject)" data-seq="([^"]+)"/g)];

  assert.equal(examples.length, 4);
  for (const [, expected, input] of examples) {
    assert.equal(runSequence(input).accepted, expected === "accept", `example ${input}`);
  }
});

test("the delta table and symbol legend are rendered from the PDA model", () => {
  assert.match(html, /<tbody id="delta-table-body"><\/tbody>/);
  assert.match(script, /TRANSITIONS\.map\(/);
  assert.match(html, /id="symbol-legend"/);
  assert.match(script, /INPUT_SYMBOLS\.map\(/);
  assert.deepEqual(Object.keys(SYMBOL_DESC).sort(), [...INPUT_SYMBOLS].sort());
});
