/** Operação Cofre LIFO — interface do jogo e planta baixa visual top-down. */
import {
  FINAL_STATE,
  INPUT_SYMBOLS,
  TRANSITIONS,
  applyTransition,
  createInitialConfiguration,
} from "./src/pda.js";
import {
  STATES_META,
  SYMBOL_DESC,
  gateActionForDirection,
  physicalRoomByState,
} from "./src/game-config.js";

let pda = {
  ...createInitialConfiguration(),
  tape: [],
  cursor: -1,
  status: "running",
  statusMessage: "Aguardando entrada em q₀ (Beco / Entrada).",
  logs: [],
  agentPos: { x: STATES_META.q0.x, y: STATES_META.q0.y + 10 },
  waypoints: [],
  walkPhase: 0
};

let autoTimer = null;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const elState = document.getElementById("current-state");
const elStateName = document.getElementById("current-state-name");
const elSymbol = document.getElementById("current-symbol");
const elSymbolDesc = document.getElementById("current-symbol-desc");
const elStackTop = document.getElementById("stack-top");
const elTape = document.getElementById("tape-container");
const elStack = document.getElementById("stack-container");
const elLog = document.getElementById("transition-log");
const elBanner = document.getElementById("status-banner");
const elDetail = document.getElementById("status-detail");
const elScriptInput = document.getElementById("script-input");
const elToast = document.getElementById("toast-feedback");

let toastTimeout = null;
function showToast(msg, isError = false) {
  elToast.textContent = msg;
  elToast.className = isError ? "toast error" : "toast";
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    elToast.classList.add("hidden");
  }, 2600);
}

function getStackTop() {
  return pda.stack.length > 0 ? pda.stack[pda.stack.length - 1] : null;
}

function resetPDA(keepInput = true) {
  clearInterval(autoTimer);
  autoTimer = null;
  pda = {
    ...createInitialConfiguration(),
    tape: [],
    cursor: -1,
    status: "running",
    statusMessage: "Pronto em q₀. Mova com WASD ou execute um roteiro.",
    logs: [],
    agentPos: { x: STATES_META.q0.x, y: STATES_META.q0.y + 10 },
    waypoints: [],
    walkPhase: 0
  };
  if (!keepInput) elScriptInput.value = "";
  updateUI();
}

function enqueueMovement(fromSt, toSt) {
  const fromRoom = physicalRoomByState[fromSt];
  const toRoom = physicalRoomByState[toSt];

  if (fromRoom === toRoom) {
    return;
  }

  const dest = { x: STATES_META[toSt].x, y: STATES_META[toSt].y + 10 };
  if (fromRoom === "q4" && toRoom === "q5") {
    pda.waypoints = [
      { x: 590, y: 105 + 10 },
      dest
    ];
  } else {
    pda.waypoints = [dest];
  }
}

function stepSymbol(symbol, fromScript = false) {
  if (pda.status === "rejected") {
    showToast("Execução já rejeitada. Reinicie para tentar novamente.", true);
    return false;
  }

  const top = getStackTop();
  if (!fromScript) {
    pda.tape.push(symbol);
    pda.cursor = pda.tape.length - 1;
  }

  const result = applyTransition(pda, symbol);

  if (!result) {
    pda.status = "rejected";
    const reason = `Sem transição δ(${pda.state}, '${symbol}', ${top || "ε"}).`;
    pda.statusMessage = `REJEITADA: ${reason}`;
    pda.logs.unshift({
      ok: false,
      text: `✖ REJEITADA em ${pda.state} lendo '${symbol}' com topo '${top || "ε"}'`
    });
    showToast(`Bloqueado! ${reason}`, true);
    updateUI(symbol);
    return false;
  }

  const prevState = pda.state;
  const { rule } = result;
  pda.stack = result.stack;
  pda.state = result.state;
  enqueueMovement(prevState, pda.state);

  const pushedStr = rule.push.length ? rule.push.join("") : "λ";
  pda.logs.unshift({
    ok: true,
    text: `δ(${prevState}, ${symbol}, ${top}) → (${pda.state}, ${pushedStr}) • ${rule.desc}`
  });

  if (!fromScript) {
    if (pda.state === FINAL_STATE) {
      pda.status = "accepted";
      pda.statusMessage = "ACEITA! O agente alcançou a Garagem (qf) com a pilha válida.";
      showToast("Missão cumprida! Sequência ACEITA pelo PDA.");
    } else {
      pda.status = "running";
      pda.statusMessage = `${rule.desc} (Estado atual: ${pda.state})`;
    }
  }

  updateUI(symbol);
  return true;
}

let scriptQueue = [];
let scriptIndex = 0;

function prepareScript() {
  const raw = elScriptInput.value.trim().toLowerCase();
  if (!raw) {
    showToast("Digite ou selecione uma sequência de símbolos primeiro.", true);
    return false;
  }
  resetPDA(true);
  scriptQueue = raw.split("");
  scriptIndex = 0;
  pda.tape = [...scriptQueue];
  updateUI();
  return true;
}

function advanceScriptStep() {
  if (scriptIndex >= scriptQueue.length) {
    clearInterval(autoTimer);
    autoTimer = null;
    if (pda.status !== "rejected") {
      if (pda.state === FINAL_STATE) {
        pda.status = "accepted";
        pda.statusMessage = "ACEITA! Toda a fita foi consumida e o autômato parou no estado final qf.";
      } else {
        pda.status = "rejected";
        pda.statusMessage = `REJEITADA! A fita terminou em ${pda.state}, que não é estado final (qf).`;
        pda.logs.unshift({
          ok: false,
          text: `✖ Fim da fita em ${pda.state} (esperado: qf)`
        });
      }
      updateUI();
    }
    return false;
  }

  const sym = scriptQueue[scriptIndex];
  pda.cursor = scriptIndex;
  scriptIndex++;
  const ok = stepSymbol(sym, true);

  if (!ok) {
    clearInterval(autoTimer);
    autoTimer = null;
    return false;
  }

  if (scriptIndex === scriptQueue.length) {
    clearInterval(autoTimer);
    autoTimer = null;
    if (pda.state === FINAL_STATE) {
      pda.status = "accepted";
      pda.statusMessage = "ACEITA! Toda a fita foi consumida e o autômato alcançou qf.";
      showToast("Sequência ACEITA pelo PDA!");
    } else {
      pda.status = "rejected";
      pda.statusMessage = `REJEITADA! A entrada acabou em ${pda.state} (não atingiu qf).`;
      pda.logs.unshift({
        ok: false,
        text: `✖ Fim da entrada em ${pda.state} (não é estado final)`
      });
      showToast("Sequência REJEITADA: não chegou a qf.", true);
    }
    updateUI(sym);
  }
  return true;
}

document.getElementById("btn-run").addEventListener("click", () => {
  if (!prepareScript()) return;
  autoTimer = setInterval(() => {
    advanceScriptStep();
  }, 600);
});

document.getElementById("btn-step").addEventListener("click", () => {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
  if (scriptQueue.length === 0 || pda.cursor === -1 || pda.status !== "running") {
    if (!prepareScript()) return;
  }
  advanceScriptStep();
});

document.getElementById("btn-reset").addEventListener("click", () => {
  scriptQueue = [];
  scriptIndex = 0;
  resetPDA(true);
});

document.querySelectorAll(".example-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const seq = btn.getAttribute("data-seq");
    elScriptInput.value = seq;
    if (prepareScript()) {
      autoTimer = setInterval(() => {
        advanceScriptStep();
      }, 550);
    }
  });
});

function handleDirection(dir) {
  if (autoTimer) return;
  if (pda.status === "rejected" || pda.status === "accepted") {
    showToast("Clique em Reiniciar (q₀) para iniciar uma nova tentativa.", true);
    return;
  }

  scriptQueue = [];
  scriptIndex = 0;

  const st = pda.state;
  let symbolToEmit = null;

  if (st === "q0") {
    if (dir === "D") symbolToEmit = "i";
    else showToast("Em q₀ (Beco), pressione D (Leste) para entrar no Saguão.");
  } else if (st === "q1") {
    if (dir === "W") symbolToEmit = "c";
    else if (dir === "S") symbolToEmit = "k";
    else if (dir === "D") symbolToEmit = "p";
    else showToast("No Saguão (q₁): W (Segurança), S (TI) ou D (Portão).");
  } else if (st === "q2") {
    if (dir === "S") symbolToEmit = "v";
    else if (dir === "W") symbolToEmit = "c";
    else showToast("Na Sala de Segurança (q₂): pressione S para voltar ao Saguão.");
  } else if (st === "q3") {
    if (dir === "W") symbolToEmit = "v";
    else showToast("Na Sala de TI (q₃): pressione W para voltar ao Saguão.");
  } else if (st === "q4") {
    symbolToEmit = gateActionForDirection(st, dir);
    if (!symbolToEmit) showToast("No Portão (q₄), use W (Cartão) ou S (Kit). D abre o cofre somente em q₈.");
  } else if (st === "q7") {
    symbolToEmit = gateActionForDirection(st, dir);
    if (!symbolToEmit) showToast("No Portão (q₇), use W ou S para apresentar a segunda credencial. D ainda não abre o cofre.");
  } else if (st === "q8") {
    symbolToEmit = gateActionForDirection(st, dir);
    if (!symbolToEmit) showToast("No Portão (q₈), use D para abrir o cofre; W e S tentam uma credencial restante.");
  } else if (st === "q5") {
    if (dir === "A" || dir === "W") symbolToEmit = "m";
    else if (dir === "S" || dir === "D") symbolToEmit = "r";
    else showToast("No Cofre (q₅): W (pegar malote) ou S/D (Corredor de Fuga).");
  } else if (st === "q6") {
    if (dir === "A" || dir === "W") symbolToEmit = "l";
    else if (dir === "S" || dir === "D") symbolToEmit = "e";
    else showToast("No Corredor (q₆): W (ocultar malote) ou S/D (escapar na Garagem).");
  }

  if (symbolToEmit) {
    stepSymbol(symbolToEmit, false);
  }
}

document.addEventListener("keydown", (e) => {
  if (document.activeElement === elScriptInput) return;
  const key = e.key.toUpperCase();
  if (key === "W" || e.key === "ArrowUp") { e.preventDefault(); handleDirection("W"); }
  if (key === "A" || e.key === "ArrowLeft") { e.preventDefault(); handleDirection("A"); }
  if (key === "S" || e.key === "ArrowDown") { e.preventDefault(); handleDirection("S"); }
  if (key === "D" || e.key === "ArrowRight") { e.preventDefault(); handleDirection("D"); }
});

document.querySelectorAll(".key-btn").forEach((btn) => {
  btn.addEventListener("click", () => handleDirection(btn.getAttribute("data-dir")));
});

function updateUI(lastSymbol = null) {
  elState.textContent = pda.state;
  elStateName.textContent = STATES_META[pda.state].name;
  elSymbol.textContent = lastSymbol || "-";
  elSymbolDesc.textContent = lastSymbol ? (SYMBOL_DESC[lastSymbol] || "") : "Nenhum ainda";
  elStackTop.textContent = getStackTop() || "ε";

  elBanner.className = `status-banner ${pda.status}`;
  const titleEl = elBanner.querySelector(".status-title");
  if (pda.status === "accepted") titleEl.textContent = "✔ CADEIA ACEITA";
  else if (pda.status === "rejected") titleEl.textContent = "✖ CADEIA REJEITADA";
  else titleEl.textContent = "● EM EXECUÇÃO";
  elDetail.textContent = pda.statusMessage;

  if (pda.tape.length === 0) {
    elTape.innerHTML = `<span class="tape-empty">Nenhum símbolo processado</span>`;
  } else {
    elTape.innerHTML = pda.tape
      .map((ch, idx) => {
        let cls = "tape-cell";
        if (idx < pda.cursor) cls += " done";
        else if (idx === pda.cursor) {
          cls += pda.status === "rejected" ? " error" : " active";
        }
        return `<div class="${cls}">${ch}</div>`;
      })
      .join("");
  }

  elStack.innerHTML = pda.stack
    .map((sym, idx) => {
      const isTop = idx === pda.stack.length - 1;
      const topTag = isTop ? " ◀ TOPO" : "";
      if (sym === "Z") {
        return `<div class="stack-item base">Z <small>(Fundo)${topTag}</small></div>`;
      }
      return `<div class="stack-item sym-${sym}">${sym}${topTag}</div>`;
    })
    .join("");

  elLog.innerHTML = pda.logs
    .map((item) => `<li class="${item.ok ? "ok" : "err"}">${item.text}</li>`)
    .join("");
}

/* ============================================================================
 * DESENHO DA PLANTA BAIXA DO BANCO (TOP-DOWN ARQUITETÔNICO + CENÁRIO)
 * ============================================================================ */

function drawTree(x, y, r) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath(); ctx.arc(x + 4, y + 5, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#14532d";
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#166534";
  ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.72, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#22c55e";
  ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawCorridorFloor(points, label, offset = { x: 0, y: 0 }) {
  ctx.save();
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 42;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 34;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.setLineDash([]);

  if (label) {
    const midIdx = Math.floor((points.length - 1) / 2);
    const mx = (points[midIdx].x + points[midIdx + 1].x) / 2 + offset.x;
    const my = (points[midIdx].y + points[midIdx + 1].y) / 2 + offset.y;

    ctx.font = "bold 11px monospace";
    const tw = ctx.measureText(label).width + 12;
    ctx.fillStyle = "#090d16";
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mx - tw / 2, my - 10, tw, 18, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#e0f2fe";
    ctx.textAlign = "center";
    ctx.fillText(label, mx, my + 3);
  }
  ctx.restore();
}

function drawRoomProps(key, rx, ry, w, h) {
  ctx.save();
  if (key === "q0") {
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(rx + 28, ry + 75, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx + 21, ry + 75); ctx.lineTo(rx + 35, ry + 75); ctx.stroke();
    ctx.fillStyle = "#78350f";
    ctx.fillRect(rx + 145, ry + 64, 24, 18);
    ctx.strokeStyle = "#b45309";
    ctx.strokeRect(rx + 145, ry + 64, 24, 18);
  } else if (key === "q1") {
    ctx.fillStyle = "#334155";
    ctx.fillRect(rx + 36, ry + 34, 112, 12);
    ctx.strokeStyle = "#64748b";
    ctx.strokeRect(rx + 36, ry + 34, 112, 12);
    ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
    ctx.fillRect(rx + 46, ry + 54, 92, 34);
  } else if (key === "q2") {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(rx + 25, ry + 32, 85, 16);
    ctx.fillStyle = "#0ea5e9";
    ctx.fillRect(rx + 32, ry + 34, 18, 6);
    ctx.fillRect(rx + 56, ry + 34, 18, 6);
    ctx.fillRect(rx + 80, ry + 34, 18, 6);
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath(); ctx.roundRect(rx + 132, ry + 42, 32, 20, 4); ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(rx + 132, ry + 47, 32, 4);
    ctx.font = "bold 9px monospace";
    ctx.fillText("C", rx + 154, ry + 59);
  } else if (key === "q3") {
    for (let i = 0; i < 3; i++) {
      const sx = rx + 20 + i * 32;
      ctx.fillStyle = "#090d16";
      ctx.fillRect(sx, ry + 32, 24, 36);
      ctx.strokeStyle = "#475569";
      ctx.strokeRect(sx, ry + 32, 24, 36);
      ctx.fillStyle = i % 2 === 0 ? "#22c55e" : "#a78bfa";
      ctx.fillRect(sx + 4, ry + 38, 4, 4);
      ctx.fillRect(sx + 12, ry + 38, 4, 4);
    }
    ctx.fillStyle = "#8b5cf6";
    ctx.beginPath(); ctx.roundRect(rx + 132, ry + 42, 32, 22, 4); ctx.fill();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 10px monospace";
    ctx.fillText("KIT", rx + 148, ry + 56);
  } else if (key === "q4") {
    const unlocked = getStackTop() === "Z" && (pda.state === "q8" || pda.state === "q5" || pda.state === "q6" || pda.state === "qf");
    ctx.fillStyle = "#475569";
    ctx.fillRect(rx + 144, ry + 26, 14, 18);
    ctx.fillRect(rx + 144, ry + 72, 14, 18);
    ctx.strokeStyle = unlocked ? "#10b981" : "#ef4444";
    ctx.lineWidth = unlocked ? 2 : 4;
    if (unlocked) ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(rx + 151, ry + 44);
    ctx.lineTo(rx + 151, ry + 72);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(rx + 22, ry + 36, 14, 14);
    ctx.fillStyle = "#a78bfa";
    ctx.fillRect(rx + 22, ry + 56, 14, 14);
  } else if (key === "q5") {
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(rx + 28, ry + 56, 16, 0, Math.PI * 2); ctx.stroke();
    const goldCoords = [[126, 36], [148, 36], [137, 52], [126, 68], [148, 68]];
    goldCoords.forEach(([gx, gy]) => {
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(rx + gx, ry + gy, 18, 10);
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 1;
      ctx.strokeRect(rx + gx, ry + gy, 18, 10);
    });
  } else if (key === "q6") {
    ctx.fillStyle = "#334155";
    ctx.fillRect(rx + 22, ry + 34, 28, 22);
    ctx.fillStyle = "#f472b6";
    ctx.font = "bold 9px monospace";
    ctx.fillText("STASH", rx + 36, ry + 48);
    ctx.fillStyle = "rgba(239, 68, 68, 0.14)";
    ctx.beginPath();
    ctx.moveTo(rx + 165, ry + 32);
    ctx.lineTo(rx + 115, ry + 55);
    ctx.lineTo(rx + 145, ry + 78);
    ctx.closePath();
    ctx.fill();
  } else if (key === "qf") {
    const cx = rx + 116;
    const cy = ry + 38;
    ctx.fillStyle = "#10b981";
    ctx.beginPath(); ctx.roundRect(cx, cy, 52, 28, 6); ctx.fill();
    ctx.fillStyle = "#064e3b";
    ctx.fillRect(cx + 30, cy + 4, 12, 20);
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(cx + 49, cy + 4, 3, 5);
    ctx.fillRect(cx + 49, cy + 19, 3, 5);
  }
  ctx.restore();
}

function drawRoom(key, meta) {
  const isCurrent = physicalRoomByState[pda.state] === physicalRoomByState[key];
  const currentMeta = isCurrent ? STATES_META[pda.state] : meta;
  const displayedState = isCurrent ? pda.state : key;
  const w = 186;
  const h = 108;
  const rx = meta.x - w / 2;
  const ry = meta.y - h / 2;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.roundRect(rx + 5, ry + 6, w, h, 10);
  ctx.fill();

  if (key === "q0") ctx.fillStyle = "#1e293b";
  else if (key === "qf") ctx.fillStyle = "#0f172a";
  else ctx.fillStyle = "#131c31";

  ctx.strokeStyle = isCurrent ? currentMeta.color : "#475569";
  ctx.lineWidth = isCurrent ? 3.5 : 2.5;
  ctx.beginPath();
  ctx.roundRect(rx, ry, w, h, 10);
  ctx.fill();
  ctx.stroke();

  drawRoomProps(key, rx, ry, w, h);

  ctx.fillStyle = "rgba(9, 13, 22, 0.86)";
  ctx.beginPath();
  ctx.roundRect(rx + 2, ry + 2, w - 4, 24, [8, 8, 0, 0]);
  ctx.fill();

  ctx.fillStyle = currentMeta.color;
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "left";
  ctx.fillText(displayedState, rx + 10, ry + 18);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(currentMeta.name, rx + w - 10, ry + 18);

  ctx.fillStyle = "rgba(9, 13, 22, 0.82)";
  ctx.beginPath();
  ctx.roundRect(rx + 2, ry + h - 22, w - 4, 20, [0, 0, 8, 8]);
  ctx.fill();

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "10.5px monospace";
  ctx.textAlign = "center";
  const hints = {
    q0: "[D] Entrar no Banco (i)",
    q1: "[W]Seg [S]TI [D]Portão",
    q2: "+Cartão(C) • [S]Voltar",
    q3: "+Kit(K) • [W]Voltar",
    q4: "[W]-C [S]-K",
    q7: "[W]/[S] segunda credencial",
    q8: "[D] Abrir Cofre",
    q5: "[W]+Malote • [D]Fuga(r)",
    q6: "[W]-Malote • [D]Sair(e)",
    qf: "FUGA CONCLUÍDA (ACEITA)"
  };
  ctx.fillText(hints[displayedState] || hints[key] || "", meta.x, ry + h - 8);
  ctx.restore();
}

function drawAgent(x, y, isMoving) {
  const bob = isMoving ? Math.sin(pda.walkPhase) * 2.5 : 0;
  const footSwing = isMoving ? Math.sin(pda.walkPhase) * 4 : 0;

  ctx.save();
  ctx.translate(x, y + bob);

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 14 - bob, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.beginPath(); ctx.arc(-5, 11 + footSwing, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(5, 11 - footSwing, 3.5, 0, Math.PI * 2); ctx.fill();

  const hasItems = pda.stack.length > 1;
  ctx.fillStyle = hasItems ? "#f59e0b" : "#334155";
  ctx.beginPath();
  ctx.roundRect(-13, -4, 6, 12, 2);
  ctx.fill();

  ctx.fillStyle = pda.status === "rejected" ? "#ef4444" : "#1e293b";
  ctx.strokeStyle = pda.status === "accepted" ? "#10b981" : "#38bdf8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 2, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(0, -4, 7.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pda.status === "rejected" ? "#ef4444" : "#0284c7";
  ctx.fillRect(-5, -6, 10, 3.5);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(-4, -5.5, 3, 2);
  ctx.fillRect(1, -5.5, 3, 2);

  ctx.restore();
}

function renderLoop() {
  let isMoving = false;
  if (pda.waypoints.length > 0) {
    const wp = pda.waypoints[0];
    const dx = wp.x - pda.agentPos.x;
    const dy = wp.y - pda.agentPos.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 3) {
      isMoving = true;
      pda.walkPhase += 0.35;
      pda.agentPos.x += dx * 0.16;
      pda.agentPos.y += dy * 0.16;
    } else {
      pda.agentPos.x = wp.x;
      pda.agentPos.y = wp.y;
      pda.waypoints.shift();
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#080f1e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.fillStyle = "#0c1527";
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(232, 24, 710, 532, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(148, 163, 184, 0.28)";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "right";
  ctx.fillText("PLANTA BAIXA • BANCO CENTRAL LIFO", 926, 44);
  ctx.restore();

  drawTree(45, 70, 22);
  drawTree(95, 48, 16);
  drawTree(175, 65, 20);
  drawTree(50, 175, 18);
  drawTree(48, 415, 21);
  drawTree(110, 485, 24);
  drawTree(178, 515, 17);

  drawCorridorFloor([{ x: 115, y: 290 }, { x: 350, y: 290 }], "i", { x: -12, y: -26 });
  drawCorridorFloor([{ x: 350, y: 290 }, { x: 350, y: 100 }], "c / v", { x: 42, y: 0 });
  drawCorridorFloor([{ x: 350, y: 290 }, { x: 350, y: 480 }], "k / v", { x: 42, y: 0 });
  drawCorridorFloor([{ x: 350, y: 290 }, { x: 590, y: 290 }], "p", { x: 0, y: -26 });
  drawCorridorFloor([{ x: 590, y: 290 }, { x: 590, y: 105 }, { x: 830, y: 105 }], "f (Z)", { x: -42, y: 0 });
  drawCorridorFloor([{ x: 830, y: 105 }, { x: 830, y: 290 }], "r", { x: 36, y: 0 });
  drawCorridorFloor([{ x: 830, y: 290 }, { x: 830, y: 475 }], "e (Z)", { x: 42, y: 0 });

  Object.entries(STATES_META)
    .filter(([key]) => physicalRoomByState[key] === key)
    .forEach(([key, meta]) => drawRoom(key, meta));
  drawAgent(pda.agentPos.x, pda.agentPos.y, isMoving);

  requestAnimationFrame(renderLoop);
}

const modal = document.getElementById("diagram-modal");
document.getElementById("btn-diagram").addEventListener("click", () => modal.classList.remove("hidden"));
document.getElementById("btn-close-modal").addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.add("hidden");
});

function populateDeltaTable() {
  const tbody = document.getElementById("delta-table-body");
  tbody.innerHTML = TRANSITIONS.map(
    (t) => `
    <tr>
      <td><strong>${t.from}</strong></td>
      <td><code>${t.read}</code></td>
      <td><code>${t.pop}</code></td>
      <td><strong>${t.to}</strong></td>
      <td><code>${t.push.length ? t.push.join("") : "λ (desempilha)"}</code></td>
      <td>${t.desc}</td>
    </tr>`
  ).join("");
}

function populateSymbolLegend() {
  const legend = document.getElementById("symbol-legend");
  legend.innerHTML = INPUT_SYMBOLS.map((symbol) => (
    `<div><code>${symbol}</code> ${SYMBOL_DESC[symbol]}</div>`
  )).join("");
}

populateDeltaTable();
populateSymbolLegend();
resetPDA();
renderLoop();
