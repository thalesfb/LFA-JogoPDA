import { STATES } from "./pda.js";

export const STATES_META = Object.freeze({
  q0: Object.freeze({ name: "Beco / Entrada", x: 115, y: 290, color: "#38bdf8", room: "q0" }),
  q2: Object.freeze({ name: "Sala de Segurança", x: 350, y: 100, color: "#fbbf24", room: "q2" }),
  q1: Object.freeze({ name: "Saguão Central", x: 350, y: 290, color: "#38bdf8", room: "q1" }),
  q3: Object.freeze({ name: "Sala de TI", x: 350, y: 480, color: "#a78bfa", room: "q3" }),
  q4: Object.freeze({ name: "Portão Blindado", x: 590, y: 290, color: "#38bdf8", room: "q4" }),
  q7: Object.freeze({ name: "Portão • primeira credencial", x: 590, y: 290, color: "#fbbf24", room: "q4" }),
  q8: Object.freeze({ name: "Portão • destravado", x: 590, y: 290, color: "#34d399", room: "q4" }),
  q5: Object.freeze({ name: "Interior do Cofre", x: 830, y: 105, color: "#f472b6", room: "q5" }),
  q6: Object.freeze({ name: "Corredor de Fuga", x: 830, y: 290, color: "#38bdf8", room: "q6" }),
  qf: Object.freeze({ name: "Garagem (Fuga)", x: 830, y: 475, color: "#10b981", room: "qf" }),
});

export const physicalRoomByState = Object.freeze(Object.fromEntries(
  STATES.map((state) => [state, STATES_META[state].room]),
));

export const SYMBOL_DESC = Object.freeze({
  i: "Entrar no Saguão",
  c: "Clonar Cartão (+C)",
  k: "Coletar Kit TI (+K)",
  v: "Voltar ao Saguão",
  p: "Avançar ao Portão",
  d: "Usar Cartão (-C)",
  s: "Usar Kit TI (-K)",
  f: "Destravar Cofre (topo Z)",
  m: "Pegar Malote (+M)",
  r: "Ir p/ Corredor Fuga",
  l: "Ocultar Malote (-M)",
  e: "Escapar na Garagem (topo Z)",
});

const GATE_DIRECTIONS = Object.freeze({
  q4: Object.freeze({ W: "d", S: "s" }),
  q7: Object.freeze({ W: "d", S: "s" }),
  q8: Object.freeze({ W: "d", S: "s", D: "f" }),
});

export const gateActionForDirection = (state, direction) => GATE_DIRECTIONS[state]?.[direction] ?? null;
