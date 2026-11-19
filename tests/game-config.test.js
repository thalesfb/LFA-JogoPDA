import assert from "node:assert/strict";
import test from "node:test";

import { INPUT_SYMBOLS, STATES } from "../src/pda.js";
import {
  STATES_META,
  SYMBOL_DESC,
  gateActionForDirection,
  physicalRoomByState,
} from "../src/game-config.js";

test("every formal state has monitor metadata and a physical room", () => {
  assert.deepEqual(Object.keys(STATES_META).sort(), [...STATES].sort());
  assert.deepEqual(Object.keys(physicalRoomByState).sort(), [...STATES].sort());
  assert.equal(physicalRoomByState.q4, "q4");
  assert.equal(physicalRoomByState.q7, "q4");
  assert.equal(physicalRoomByState.q8, "q4");
  assert.equal(STATES_META.q7.x, STATES_META.q4.x);
  assert.equal(STATES_META.q7.y, STATES_META.q4.y);
  assert.equal(STATES_META.q8.x, STATES_META.q4.x);
  assert.equal(STATES_META.q8.y, STATES_META.q4.y);
});

test("the legend describes exactly the alphabet used by the PDA", () => {
  assert.deepEqual(Object.keys(SYMBOL_DESC).sort(), [...INPUT_SYMBOLS].sort());
});

test("gate WASD actions distinguish the two credential phases", () => {
  for (const state of ["q4", "q7", "q8"]) {
    assert.equal(gateActionForDirection(state, "W"), "d");
    assert.equal(gateActionForDirection(state, "S"), "s");
  }

  assert.equal(gateActionForDirection("q4", "D"), null);
  assert.equal(gateActionForDirection("q7", "D"), null);
  assert.equal(gateActionForDirection("q8", "D"), "f");
  assert.equal(gateActionForDirection("q7", "A"), null);
});
