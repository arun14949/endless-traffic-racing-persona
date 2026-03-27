// ============ SOUND & HAPTICS ENGINE ============
// Road Rash Rush - Web Audio API synthesis + Vibration API haptics

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function ensureAudio(){ if(!audioCtx) audioCtx = new AudioCtx(); }

// ---- HAPTICS ----
const haptics = {
  _can: !!(navigator.vibrate),
  light()   { if(this._can) navigator.vibrate(15); },
  medium()  { if(this._can) navigator.vibrate(40); },
  heavy()   { if(this._can) navigator.vibrate(80); },
  crash()   { if(this._can) navigator.vibrate([60,30,120,30,80]); },
  pothole() { if(this._can) navigator.vibrate([30,20,50]); },
  nearMiss(){ if(this._can) navigator.vibrate([10,15,10]); },
  milestone(){ if(this._can) navigator.vibrate([20,30,20,30,20]); },
};

// ---- ENGINE SOUND ----
function playEngine(freq, vol=0.08){
  ensureAudio();
  const now = audioCtx.currentTime;

  // Main oscillator (sawtooth for gritty engine tone)
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sawtooth';
  o.frequency.value = freq;
  g.gain.value = vol;

  // Sub-oscillator (square wave, 1 octave lower for rumble)
  const o2 = audioCtx.createOscillator();
  const g2 = audioCtx.createGain();
  o2.type = 'square';
  o2.frequency.value = freq * 0.5;
  g2.gain.value = vol * 0.3;

  // Low-pass filter on main osc for warmth
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = freq * 4;
  lp.Q.value = 1.5;

  o.connect(lp);
  lp.connect(g);
  o2.connect(g2);
  g.connect(audioCtx.destination);
  g2.connect(audioCtx.destination);
  o.start(); o2.start();

  return {
    osc:o, osc2:o2, gain:g, gain2:g2, filter:lp,
    setFreq(f){
      o.frequency.value = f;
      o2.frequency.value = f * 0.5;
      lp.frequency.value = f * 4;
    },
    setVol(v){
      g.gain.value = v;
      g2.gain.value = v * 0.3;
    },
    stop(){
      const t = audioCtx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.001, t+0.3);
      g2.gain.exponentialRampToValueAtTime(0.001, t+0.3);
      setTimeout(()=>{ o.stop(); o2.stop(); }, 400);
    }
  };
}

// ---- CRASH ----
function playCrash(){
  ensureAudio();
  const sr = audioCtx.sampleRate;
  const len = sr * 0.6;

  // White noise burst with sharp decay
  const buf = audioCtx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  for(let i=0; i<len; i++){
    d[i] = (Math.random()*2-1) * Math.exp(-i/(sr*0.07));
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;

  // Impact thud (low sine)
  const thud = audioCtx.createOscillator();
  const thudG = audioCtx.createGain();
  thud.type = 'sine';
  thud.frequency.value = 55;
  thud.frequency.exponentialRampToValueAtTime(25, audioCtx.currentTime+0.3);
  thudG.gain.value = 0.4;
  thudG.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+0.35);

  // Metal crunch (high-passed noise)
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2000;

  const noiseG = audioCtx.createGain();
  noiseG.gain.value = 0.5;

  src.connect(hp);
  hp.connect(noiseG);
  noiseG.connect(audioCtx.destination);
  thud.connect(thudG);
  thudG.connect(audioCtx.destination);

  // Also play the raw noise for body
  const rawG = audioCtx.createGain();
  rawG.gain.value = 0.3;
  src.connect(rawG);
  rawG.connect(audioCtx.destination);

  src.start();
  thud.start();
  thud.stop(audioCtx.currentTime + 0.4);

  haptics.crash();
}

// ---- POTHOLE ----
function playPothole(){
  ensureAudio();
  const now = audioCtx.currentTime;

  // Deep thump
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.value = 80;
  o.frequency.exponentialRampToValueAtTime(30, now+0.3);
  g.gain.value = 0.25;
  g.gain.exponentialRampToValueAtTime(0.001, now+0.4);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(now+0.5);

  // Rattle noise
  const sr = audioCtx.sampleRate;
  const buf = audioCtx.createBuffer(1, sr*0.15, sr);
  const d = buf.getChannelData(0);
  for(let i=0; i<d.length; i++){
    d[i] = (Math.random()*2-1) * Math.exp(-i/(sr*0.03)) * 0.15;
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 400;
  bp.Q.value = 2;
  src.connect(bp); bp.connect(audioCtx.destination);
  src.start();

  haptics.pothole();
}

// ---- LANE CHANGE (tire screech) ----
function playLaneChange(){
  ensureAudio();
  const now = audioCtx.currentTime;

  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.value = 300;
  o.frequency.exponentialRampToValueAtTime(500, now+0.08);
  g.gain.value = 0.06;
  g.gain.exponentialRampToValueAtTime(0.001, now+0.12);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(now+0.15);

  haptics.light();
}

// ---- HORN (player or traffic) ----
function playHorn(type='car'){
  ensureAudio();
  const now = audioCtx.currentTime;

  const freqs = {
    car:   [320, 400],
    auto:  [500, 620],
    bus:   [180, 220],
    lorry: [160, 200],
    ambulance: [600, 800],
  };
  const [f1, f2] = freqs[type] || freqs.car;
  const dur = type==='ambulance' ? 0.6 : 0.3;

  const o1 = audioCtx.createOscillator();
  const o2 = audioCtx.createOscillator();
  const g = audioCtx.createGain();

  o1.type = 'square'; o1.frequency.value = f1;
  o2.type = 'square'; o2.frequency.value = f2;

  g.gain.value = 0.07;
  g.gain.exponentialRampToValueAtTime(0.001, now+dur);

  o1.connect(g); o2.connect(g); g.connect(audioCtx.destination);
  o1.start(); o2.start();
  o1.stop(now+dur+0.05);
  o2.stop(now+dur+0.05);
}

// ---- TRAFFIC WHOOSH (vehicle passing by) ----
function playWhoosh(speed){
  ensureAudio();
  const now = audioCtx.currentTime;
  const dur = Math.max(0.15, 0.4 - speed*0.005);

  const sr = audioCtx.sampleRate;
  const len = Math.floor(sr * dur);
  const buf = audioCtx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  for(let i=0; i<len; i++){
    const env = Math.sin(Math.PI * i/len);
    d[i] = (Math.random()*2-1) * env * 0.08;
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;

  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 600 + speed*10;
  bp.Q.value = 0.8;

  src.connect(bp); bp.connect(audioCtx.destination);
  src.start();
}

// ---- NEAR-MISS (close dodge) ----
function playNearMiss(){
  ensureAudio();
  const now = audioCtx.currentTime;

  // Quick ascending chime
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'triangle';
  o.frequency.value = 800;
  o.frequency.exponentialRampToValueAtTime(1400, now+0.1);
  g.gain.value = 0.08;
  g.gain.exponentialRampToValueAtTime(0.001, now+0.2);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(now+0.25);

  haptics.nearMiss();
}

// ---- SCORE MILESTONE ----
function playMilestone(){
  ensureAudio();
  const now = audioCtx.currentTime;

  // Two-note fanfare
  const notes = [523, 784]; // C5, G5
  notes.forEach((freq, i)=>{
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    const t = now + i*0.12;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t+0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t+0.25);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t+0.3);
  });

  haptics.milestone();
}

// ---- HIGH SCORE BEAT ----
function playHighScore(){
  ensureAudio();
  const now = audioCtx.currentTime;

  // Ascending arpeggio
  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  notes.forEach((freq, i)=>{
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    const t = now + i*0.1;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t+0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t+0.35);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t+0.4);
  });

  haptics.milestone();
}

// ---- AMBULANCE SIREN (looping) ----
let sirenNode = null;
function startSiren(){
  ensureAudio();
  if(sirenNode) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  const lfo = audioCtx.createOscillator();
  const lfoG = audioCtx.createGain();

  o.type = 'sine';
  o.frequency.value = 700;
  lfo.type = 'sine';
  lfo.frequency.value = 2;    // wail rate
  lfoG.gain.value = 200;      // wail depth

  lfo.connect(lfoG);
  lfoG.connect(o.frequency);
  g.gain.value = 0.03;

  o.connect(g); g.connect(audioCtx.destination);
  o.start(); lfo.start();

  sirenNode = {osc:o, lfo, gain:g,
    setVol(v){ g.gain.value = v; },
    stop(){
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+0.2);
      setTimeout(()=>{ o.stop(); lfo.stop(); }, 300);
      sirenNode = null;
    }
  };
  return sirenNode;
}
function stopSiren(){
  if(sirenNode) sirenNode.stop();
}

// ---- UI CLICK ----
function playClick(){
  ensureAudio();
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.value = 1000;
  g.gain.value = 0.05;
  g.gain.exponentialRampToValueAtTime(0.001, now+0.06);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(now+0.08);
  haptics.light();
}

// ---- ENGINE PREVIEW (character select) ----
function playEnginePreview(freq){
  ensureAudio();
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sawtooth';
  o.frequency.value = freq;
  g.gain.value = 0.06;
  g.gain.exponentialRampToValueAtTime(0.001, now+0.6);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(now+0.7);
}
