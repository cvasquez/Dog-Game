// Multiplayer debug logger — throttled, categorized logging for diagnosing desync
// Toggle with backtick (`) key in browser console, or: window.mpDebug.enabled = true

const THROTTLE_MS = 200; // min ms between logs of same category
const lastLog = {};

function shouldLog(category) {
  if (!mpDebug.enabled) return false;
  const now = Date.now();
  if (lastLog[category] && now - lastLog[category] < THROTTLE_MS) return false;
  lastLog[category] = now;
  return true;
}

const mpDebug = {
  enabled: false,

  // Input state sent to server
  input(inputState) {
    if (!shouldLog('input')) return;
    const active = Object.entries(inputState).filter(([, v]) => v).map(([k]) => k);
    if (active.length > 0) {
      console.log(`[MP-INPUT] ${active.join('+')}`);
    }
  },

  // Client prediction result each frame
  prediction(player) {
    if (!shouldLog('predict')) return;
    console.log(`[MP-PREDICT] pos=(${player.x.toFixed(2)},${player.y.toFixed(2)}) vel=(${player.vx.toFixed(2)},${player.vy.toFixed(2)}) grounded=${player.grounded} anim=${player.animState} facing=${player.facing}`);
  },

  // Server state received for local player
  serverState(state, player) {
    if (!shouldLog('server')) return;
    const fields = [];
    if (state.x != null && state.y != null) fields.push(`srvPos=(${state.x.toFixed(2)},${state.y.toFixed(2)})`);
    if (state.stamina != null) fields.push(`stamina=${state.stamina.toFixed(1)}`);
    if (state.exhausted != null) fields.push(`exhausted=${state.exhausted}`);
    if (state.digging != null) fields.push(`digging=${state.digging}`);
    if (state.digTarget) fields.push(`digTarget=(${state.digTarget.x},${state.digTarget.y})`);
    if (state.digProgress != null) fields.push(`digProg=${state.digProgress.toFixed(1)}`);
    if (state.dead != null) fields.push(`dead=${state.dead}`);
    if (state.hp != null) fields.push(`hp=${state.hp.toFixed(1)}`);
    if (fields.length > 0) {
      const dx = (state.x != null && state.y != null) ? (state.x - player.x).toFixed(2) : '-';
      const dy = (state.x != null && state.y != null) ? (state.y - player.y).toFixed(2) : '-';
      console.log(`[MP-SERVER] ${fields.join(' ')} | clientPos=(${player.x.toFixed(2)},${player.y.toFixed(2)}) drift=(${dx},${dy})`);
    }
  },

  // Position correction applied
  posCorrection(type, before, after, serverPos) {
    if (!mpDebug.enabled) return; // always log these (no throttle)
    console.log(`[MP-POS-${type}] (${before.x.toFixed(2)},${before.y.toFixed(2)}) → (${after.x.toFixed(2)},${after.y.toFixed(2)}) server=(${serverPos.x.toFixed(2)},${serverPos.y.toFixed(2)})`);
  },

  // Dig state changes
  dig(event, details) {
    if (!mpDebug.enabled) return;
    console.log(`[MP-DIG] ${event}:`, details);
  },

  // Stamina state
  stamina(player) {
    if (!shouldLog('stamina')) return;
    console.log(`[MP-STAMINA] ${player.stamina.toFixed(1)}/${player.maxStamina.toFixed(1)} exhausted=${player.exhausted}`);
  },

  // Animation state changes
  animChange(from, to, player) {
    if (!mpDebug.enabled) return;
    console.log(`[MP-ANIM] ${from} → ${to} pos=(${player.x.toFixed(2)},${player.y.toFixed(2)}) grounded=${player.grounded} vel=(${player.vx.toFixed(2)},${player.vy.toFixed(2)})`);
  },

  // Grounded state changes
  groundedChange(wasGrounded, isGrounded, player) {
    if (!mpDebug.enabled) return;
    const label = isGrounded ? 'LANDED' : 'AIRBORNE';
    console.log(`[MP-${label}] pos=(${player.x.toFixed(2)},${player.y.toFixed(2)}) vy=${player.vy.toFixed(2)}`);
  },

  // Network latency
  rtt(rttMs) {
    if (!shouldLog('rtt')) return;
    console.log(`[MP-RTT] ${rttMs.toFixed(0)}ms`);
  },
};

// Toggle with backtick key
document.addEventListener('keydown', (e) => {
  if (e.code === 'Backquote') {
    mpDebug.enabled = !mpDebug.enabled;
    console.log(`[MP-DEBUG] ${mpDebug.enabled ? 'ENABLED' : 'DISABLED'} — press \` to toggle`);
  }
});

window.mpDebug = mpDebug;
export default mpDebug;
