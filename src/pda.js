export const STATES = Object.freeze(["q0", "q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "qf"]);
export const INPUT_SYMBOLS = Object.freeze(["i", "c", "k", "v", "p", "d", "s", "f", "m", "r", "l", "e"]);
export const INITIAL_STATE = "q0";
export const INITIAL_STACK_SYMBOL = "Z";
export const FINAL_STATE = "qf";

const transitionRules = [
  { from: "q0", read: "i", pop: "Z", to: "q1", push: ["Z"], desc: "Infiltra o saguão principal" },
  { from: "q1", read: "c", pop: "Z", to: "q2", push: ["C", "Z"], desc: "Vai à Segurança e clona Cartão C" },
  { from: "q1", read: "c", pop: "K", to: "q2", push: ["C", "K"], desc: "Vai à Segurança e empilha Cartão C sobre K" },
  { from: "q2", read: "v", pop: "C", to: "q1", push: ["C"], desc: "Retorna da Segurança ao Saguão" },
  { from: "q1", read: "k", pop: "Z", to: "q3", push: ["K", "Z"], desc: "Vai à TI e coleta Kit K" },
  { from: "q1", read: "k", pop: "C", to: "q3", push: ["K", "C"], desc: "Vai à TI e empilha Kit K sobre C" },
  { from: "q3", read: "v", pop: "K", to: "q1", push: ["K"], desc: "Retorna da TI ao Saguão" },
  { from: "q1", read: "p", pop: "C", to: "q4", push: ["C"], desc: "Avança ao Portão Blindado com Cartão no topo" },
  { from: "q1", read: "p", pop: "K", to: "q4", push: ["K"], desc: "Avança ao Portão Blindado com Kit no topo" },
  { from: "q4", read: "d", pop: "C", to: "q7", push: [], desc: "Usa o Cartão C na primeira trava" },
  { from: "q4", read: "s", pop: "K", to: "q7", push: [], desc: "Usa o Kit K na primeira trava" },
  { from: "q7", read: "d", pop: "C", to: "q8", push: [], desc: "Usa o Cartão C na segunda trava" },
  { from: "q7", read: "s", pop: "K", to: "q8", push: [], desc: "Usa o Kit K na segunda trava" },
  { from: "q8", read: "f", pop: "Z", to: "q5", push: ["Z"], desc: "Com as duas travas abertas (Z), entra no Cofre" },
  { from: "q5", read: "m", pop: "Z", to: "q5", push: ["M", "Z"], desc: "Coleta 1º malote de dinheiro (+M)" },
  { from: "q5", read: "m", pop: "M", to: "q5", push: ["M", "M"], desc: "Coleta malote adicional (+M)" },
  { from: "q5", read: "r", pop: "M", to: "q6", push: ["M"], desc: "Sai do Cofre para o Corredor de Fuga" },
  { from: "q6", read: "l", pop: "M", to: "q6", push: [], desc: "Oculta malote no fundo falso (pop M)" },
  { from: "q6", read: "e", pop: "Z", to: FINAL_STATE, push: ["Z"], desc: "Todos malotes ocultos (Z): fuga concluída!" },
];

export const TRANSITIONS = Object.freeze(transitionRules.map((rule) => Object.freeze({
  ...rule,
  push: Object.freeze([...rule.push]),
})));

export const createInitialConfiguration = () => ({
  state: INITIAL_STATE,
  stack: [INITIAL_STACK_SYMBOL],
});

export const applyTransition = (configuration, symbol) => {
  const top = configuration.stack.at(-1) ?? null;
  const rule = TRANSITIONS.find(
    (candidate) => candidate.from === configuration.state
      && candidate.read === symbol
      && candidate.pop === top,
  );

  if (!rule) return null;

  // JFLAP writes the replacement with its new top on the left; JS stores the top at the end.
  const stackBelowTop = configuration.stack.slice(0, -1);
  const replacementFromBottom = [...rule.push].reverse();

  return {
    state: rule.to,
    stack: [...stackBelowTop, ...replacementFromBottom],
    rule,
  };
};

export const runSequence = (input) => {
  let configuration = createInitialConfiguration();

  for (const symbol of input) {
    const next = applyTransition(configuration, symbol);
    if (!next) {
      return { ...configuration, accepted: false, failedSymbol: symbol };
    }

    configuration = { state: next.state, stack: next.stack };
  }

  return {
    ...configuration,
    accepted: configuration.state === FINAL_STATE,
  };
};
