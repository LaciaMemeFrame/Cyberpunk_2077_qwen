import { useEffect, useState, type CSSProperties } from "react";
import { KEYART, INTRO_LINES, ENDING_LINES, CONTROLS, fmtTime } from "../game/data";
import type { RunStats } from "../game/engine";
import type { NetStatus } from "../game/net";
import type { PerkDef } from "../game/data";

const Icon = ({ d, color, size = 30 }: { d: string; color: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

function Typewriter({ text, instant, onTyped, className = "" }: { text: string; instant: boolean; onTyped: () => void; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => { setN(0); }, [text]);
  useEffect(() => {
    if (instant) { setN(text.length); return; }
    if (n >= text.length) return;
    const t = setTimeout(() => setN((v) => v + 1), 24);
    return () => clearTimeout(t);
  }, [n, text, instant]);
  useEffect(() => {
    if (n >= text.length) onTyped();
  }, [n, text, onTyped]);
  const done = n >= text.length;
  return <p className={`${className} ${done ? "" : "type-cursor"}`}>{text.slice(0, n)}</p>;
}

function StatsGrid({ stats }: { stats: RunStats }) {
  const rows = [
    ["УБИЙСТВА", String(stats.kills)],
    ["УРОВЕНЬ", String(stats.level)],
    ["ВОЛНА", String(stats.wave)],
    ["ВРЕМЯ", fmtTime(stats.timeSec)],
    ["ТОЧНОСТЬ", `${stats.accuracy}%`],
    ["УРОН", stats.dmgDealt.toLocaleString("ru-RU")],
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {rows.map(([k, v]) => (
        <div key={k} className="panel px-3 py-2 text-center">
          <div className="font-disp text-xl font-bold text-[#fcee0a]">{v}</div>
          <div className="text-[10px] font-semibold tracking-[0.2em] text-[#6a5f8f]">{k}</div>
        </div>
      ))}
    </div>
  );
}

/* ============================ MENU ============================ */

export function MenuScreen({ onStart, onControls, muted, onToggleMute }: {
  onStart: () => void; onControls: () => void; muted: boolean; onToggleMute: () => void;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${KEYART})` }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(100deg, rgba(7,3,15,0.94) 0%, rgba(7,3,15,0.82) 42%, rgba(20,6,30,0.35) 75%, rgba(7,3,15,0.75) 100%)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(7,3,15,0.9) 0%, transparent 30%)" }} />
      <div className="bg-gridfloor" />
      <div className="av-light" style={{ top: "16%", animationDuration: "8s" }} />
      <div className="av-light mag" style={{ top: "26%", animationDuration: "12s", animationDelay: "2s" }} />
      <div className="av-light" style={{ top: "9%", animationDuration: "10s", animationDelay: "4.5s" }} />

      <div className="relative z-10 h-full flex flex-col justify-between p-6 md:p-12 max-w-[1400px] mx-auto">
        {/* top bar */}
        <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.28em] text-[#6a5f8f]">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-[#ff3b4e] rounded-full blink" />
            СИСТЕМА // NC-BAДLANDS.2077 // СЕАНС АКТИВЕН
          </div>
          <div className="hidden md:block">НЕЙРОЛИНК v7.3 · СТАБИЛЬНО</div>
        </div>

        {/* main */}
        <div className="flex items-end gap-10">
          <div className="max-w-[640px] slide-up">
            <div className="font-disp text-[12px] font-bold tracking-[0.5em] text-[#00e5ff] mb-3">CYBERPUNK // ФАНАТСКАЯ 3D-ИСТОРИЯ</div>
            <h1 className="font-disp font-black leading-[0.9] text-[64px] md:text-[104px] text-[#fcee0a] pulse-glow">
              <span className="glitch" data-text="BADLANDS">BADLANDS</span>
            </h1>
            <div className="mt-2 font-disp text-lg md:text-2xl font-bold tracking-[0.3em] text-white">
              ПРОТОКОЛ <span className="text-[#ff2d78]">«ПОБЕГ»</span>
            </div>
            <p className="mt-5 text-[15px] md:text-base leading-relaxed text-[#c9c2e6] max-w-[560px] font-medium">
              Ви угнала «Базилиск» и уезжает из Найт-Сити вместе с Панам. Корпоративные эскадроны уже в пустошах.
              Прикрывай танк, прокачивай <span className="text-[#00e5ff]">киберимпланты</span>, отражай волны — и довези любовь всей своей жизни до маяка эвакуации.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button className="btn btn-y px-8 py-3.5 text-[15px]" onClick={onStart}>▸ ДЖЕК-ИН // НАЧАТЬ</button>
              <button className="btn btn-ghost px-5 py-3.5 text-[13px]" onClick={onControls}>УПРАВЛЕНИЕ</button>
              <button className="btn btn-ghost px-5 py-3.5 text-[13px]" onClick={onToggleMute}>ЗВУК: {muted ? "ВЫКЛ" : "ВКЛ"}</button>
            </div>
            <div className="mt-5 text-[12px] font-semibold tracking-[0.14em] text-[#6a5f8f]">
              Клик — захват мыши · <span className="keycap">ESC</span> — пауза · RPG: уровни, перки, импланты
            </div>
          </div>

          {/* dossier */}
          <div className="hidden lg:block ml-auto mb-2 w-[300px] panel panel-y p-4 fade-in" style={{ animationDelay: "0.25s" }}>
            <div className="flex items-center justify-between">
              <span className="font-disp text-[13px] font-bold tracking-[0.24em] text-[#fcee0a]">ДОСЬЕ // ВИ</span>
              <span className="text-[10px] font-bold tracking-widest text-[#ff2d78] border border-[#ff2d78]/40 px-1.5 py-0.5">ROGUE</span>
            </div>
            <div className="mt-3 space-y-2 text-[13px] font-medium text-[#c9c2e6]">
              {[
                ["Sandevistan MK.V", "замедление времени [Q]"],
                ["Оптика «Кироши»", "крит-анализ целей"],
                ["Рывок-модуль", "уклонение [SHIFT]"],
              ].map(([a, b]) => (
                <div key={a} className="flex items-baseline justify-between gap-2 border-b border-[#2a2148] pb-1.5">
                  <span className="text-[#00e5ff] font-semibold">{a}</span>
                  <span className="text-[11px] text-[#6a5f8f] text-right">{b}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 panel px-3 py-2">
              <div className="text-[10px] font-bold tracking-[0.24em] text-[#ff9a3d]">СПУТНИК // ПАНАМ ПАРМЕР</div>
              <div className="text-[12px] text-[#c9c2e6] mt-1 font-medium">За штурвалом «Базилиска». Не дай корпо сбить её с курса.</div>
            </div>
            <div className="mt-3 text-[11px] font-semibold text-[#6a5f8f] tracking-wider">ЦЕЛЬ: дойти до маяка · 640 М · пустоши</div>
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.2em] text-[#443c63]">
          <span>ПО МОТИВАМ CYBERPUNK 2077 · CD PROJEKT RED</span>
          <span className="hidden md:block">Хостинг: GitHub Pages — инструкция в README.md</span>
        </div>
      </div>
      <div className="scanlines" />
    </div>
  );
}

/* ============================ CONTROLS ============================ */

export function ControlsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0b0614]">
      <div className="bg-gridfloor opacity-60" />
      <div className="relative z-10 panel panel-y p-8 w-[620px] max-w-[92vw] slide-up">
        <div className="font-disp text-2xl font-black text-[#fcee0a] tracking-widest">УПРАВЛЕНИЕ</div>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
          {CONTROLS.map((c) => (
            <div key={c.label} className="flex items-center justify-between border-b border-[#2a2148] pb-2">
              <span className="text-[14px] font-semibold text-[#c9c2e6]">{c.label}</span>
              <span className="flex gap-1">{c.keys.map((k) => <span key={k} className="keycap">{k}</span>)}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 text-[13px] text-[#6a5f8f] font-medium leading-relaxed">
          Убийства дают <span className="text-[#ff2d78]">опыт</span> — каждый уровень предлагает выбор из трёх
          <span className="text-[#00e5ff]"> киберимплантов</span>. Тяжёлые юниты роняют чипы с постоянными бонусами.
          ПКМ — прицеливание, <span className="text-[#fcee0a]">Sandevistan</span> замедляет мир на 68%.
        </div>
        <button className="btn btn-ghost px-6 py-2.5 text-[13px] mt-6" onClick={onBack}>◂ НАЗАД</button>
      </div>
      <div className="scanlines" />
    </div>
  );
}

/* ============================ INTRO ============================ */

export function IntroScreen({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [instant, setInstant] = useState(false);
  const [typed, setTyped] = useState(false);
  const line = INTRO_LINES[idx];
  const last = idx === INTRO_LINES.length - 1;

  const advance = () => {
    if (!typed) { setInstant(true); return; }
    if (last) { onDone(); return; }
    setIdx((v) => v + 1);
    setInstant(false);
    setTyped(false);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); advance(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="absolute inset-0 z-20 cursor-pointer" onClick={advance}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(7,3,15,0.92) 0%, rgba(7,3,15,0.55) 40%, rgba(7,3,15,0.25) 100%)" }} />
      <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-12 max-w-[900px]">
        <div className="font-disp text-[11px] font-bold tracking-[0.4em] text-[#00e5ff] mb-3">
          {line.speaker ? `ПЕРЕДАЧА // ${line.speaker}` : "ЗАПИСЬ // ПАМЯТЬ НЕЙРОЛИНКА"} <span className="text-[#6a5f8f]">[{idx + 1}/{INTRO_LINES.length}]</span>
        </div>
        <Typewriter
          text={line.text}
          instant={instant}
          onTyped={() => setTyped(true)}
          className={`text-xl md:text-[28px] leading-snug font-medium ${line.speaker === "ПАНАМ" ? "text-[#ffb35a]" : line.speaker === "СИСТЕМА" ? "text-[#00e5ff]" : "text-[#e8e4f7]"}`}
        />
        <div className="mt-6 flex items-center gap-4">
          <button className="btn btn-y px-6 py-2.5 text-[13px]" onClick={(e) => { e.stopPropagation(); advance(); }}>
            {typed ? (last ? "▸ В БОЙ" : "ДАЛЕЕ ▸") : "ПРОМОТАТЬ ▸▸"}
          </button>
          {!last && (
            <button className="btn btn-ghost px-4 py-2.5 text-[12px]" onClick={(e) => { e.stopPropagation(); onDone(); }}>
              ПРОПУСТИТЬ
            </button>
          )}
          <span className="text-[11px] font-semibold tracking-[0.2em] text-[#6a5f8f] blink">ENTER / КЛИК</span>
        </div>
      </div>
      <div className="scanlines" />
    </div>
  );
}

/* ============================ PAUSE ============================ */

export function PauseScreen({ onResume, onRestart, onMenu, muted, onToggleMute }: {
  onResume: () => void; onRestart: () => void; onMenu: () => void; muted: boolean; onToggleMute: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#07030f]/72 fade-in">
      <div className="panel panel-y p-8 w-[440px] max-w-[92vw] slide-up">
        <div className="font-disp text-3xl font-black text-[#00e5ff] tracking-[0.2em]">ПАУЗА</div>
        <div className="text-[12px] font-semibold tracking-[0.2em] text-[#6a5f8f] mt-1">НЕЙРОЛИНК ОЖИДАЕТ // ПРОТОКОЛ ПРИОСТАНОВЛЕН</div>
        <div className="mt-6 flex flex-col gap-2.5">
          <button className="btn btn-y px-6 py-3 text-[14px] justify-center" onClick={onResume}>▸ ПРОДОЛЖИТЬ</button>
          <button className="btn btn-ghost px-6 py-3 text-[13px] justify-center" onClick={onRestart}>ЗАНОВО</button>
          <button className="btn btn-ghost px-6 py-3 text-[13px] justify-center" onClick={onToggleMute}>ЗВУК: {muted ? "ВЫКЛ" : "ВКЛ"}</button>
          <button className="btn btn-red px-6 py-3 text-[13px] justify-center" onClick={onMenu}>ВЫЙТИ В МЕНЮ</button>
        </div>
        <div className="mt-5 text-[12px] text-[#6a5f8f] font-medium">
          <span className="keycap">WASD</span> движение · <span className="keycap">Q</span> Sandevistan · <span className="keycap">SHIFT</span> рывок · <span className="keycap">R</span> перезарядка
        </div>
      </div>
      <div className="scanlines" />
    </div>
  );
}

/* ============================ LEVEL UP ============================ */

export function LevelUpScreen({ level, options, onPick }: { level: number; options: PerkDef[]; onPick: (id: string) => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#07030f]/80 fade-in">
      <div className="w-[860px] max-w-[94vw] slide-up">
        <div className="text-center mb-7">
          <div className="font-disp text-[13px] font-bold tracking-[0.5em] text-[#00e5ff]">НЕЙРОПЛАСТИЧНОСТЬ ПОВЫШЕНА</div>
          <div className="font-disp text-5xl font-black text-[#fcee0a] mt-1" style={{ textShadow: "0 0 28px rgba(252,238,10,0.5)" }}>
            УРОВЕНЬ {level}
          </div>
          <div className="text-[13px] font-semibold tracking-[0.3em] text-[#c9c2e6] mt-2">ВЫБЕРИ КИБЕРИМПЛАНТ</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {options.map((p) => (
            <button key={p.id} className="perk-card panel p-5 text-left" style={{ "--pc": p.color } as CSSProperties} onClick={() => onPick(p.id)}>
              <div className="flex items-center justify-between">
                <Icon d={p.icon} color={p.color} size={38} />
                <span className="font-disp text-[10px] font-bold tracking-[0.3em] text-[#6a5f8f]">ИМПЛАНТ</span>
              </div>
              <div className="font-disp text-[17px] font-bold mt-3" style={{ color: p.color }}>{p.name}</div>
              <div className="text-[13px] leading-snug text-[#c9c2e6] mt-2 font-medium">{p.desc}</div>
            </button>
          ))}
        </div>
        <div className="text-center mt-5 text-[11px] font-semibold tracking-[0.24em] text-[#6a5f8f] blink">ВРЕМЯ ОСТАНОВЛЕНО // ВЫБОР НЕОБРАТИМ</div>
      </div>
      <div className="scanlines" />
    </div>
  );
}

/* ============================ DEATH ============================ */

export function DeathScreen({ stats, reason, onRetry, onMenu }: {
  stats: RunStats; reason: string; onRetry: () => void; onMenu: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${KEYART})`, filter: "grayscale(0.7) contrast(1.2)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(40,2,10,0.55) 0%, rgba(7,3,15,0.94) 75%)" }} />
      <div className="relative z-10 h-full flex flex-col items-center justify-center p-6">
        <div className="flatline-title font-disp text-6xl md:text-8xl font-black tracking-widest">FLATLINE</div>
        <div className="mt-3 text-[15px] font-semibold tracking-[0.24em] text-[#ff8095]">{reason.toUpperCase()}</div>
        <div className="mt-7 w-[460px] max-w-[92vw]"><StatsGrid stats={stats} /></div>
        <div className="mt-7 flex gap-3">
          <button className="btn btn-y px-8 py-3 text-[14px]" onClick={onRetry}>▸ ЕЩЁ ПОПЫТКА</button>
          <button className="btn btn-red px-6 py-3 text-[13px]" onClick={onMenu}>В МЕНЮ</button>
        </div>
        <div className="mt-5 text-[12px] text-[#6a5f8f] font-medium">Панам ждёт. В этот раз — доведи «Базилиск» до конца.</div>
      </div>
      <div className="scanlines" />
    </div>
  );
}

/* ============================ VICTORY ============================ */

export function VictoryScreen({ stats, onRetry, onMenu }: { stats: RunStats; onRetry: () => void; onMenu: () => void }) {
  const [idx, setIdx] = useState(0);
  const [instant, setInstant] = useState(false);
  const [typed, setTyped] = useState(false);
  const finished = idx >= ENDING_LINES.length;
  const line = !finished ? ENDING_LINES[idx] : null;

  const advance = () => {
    if (finished) return;
    if (!typed) { setInstant(true); return; }
    setIdx((v) => v + 1);
    setInstant(false);
    setTyped(false);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); advance(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="absolute inset-0 z-40 overflow-hidden cursor-pointer" onClick={advance}>
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${KEYART})` }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(7,3,15,0.95) 0%, rgba(7,3,15,0.45) 45%, rgba(7,3,15,0.3) 100%)" }} />
      <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-12">
        {!finished && line ? (
          <div className="max-w-[820px]">
            <div className="font-disp text-[11px] font-bold tracking-[0.4em] text-[#00e5ff] mb-3">
              {line.speaker ? `ГОЛОС // ${line.speaker}` : "ЭПИЛОГ"} <span className="text-[#6a5f8f]">[{idx + 1}/{ENDING_LINES.length}]</span>
            </div>
            <Typewriter
              text={line.text}
              instant={instant}
              onTyped={() => setTyped(true)}
              className={`text-xl md:text-[27px] leading-snug font-medium ${line.speaker === "ПАНАМ" ? "text-[#ffb35a]" : line.speaker === "ВИ" ? "text-[#fcee0a]" : "text-[#e8e4f7]"}`}
            />
            <div className="mt-6 flex items-center gap-4">
              <button className="btn btn-y px-6 py-2.5 text-[13px]" onClick={(e) => { e.stopPropagation(); advance(); }}>
                {typed ? "ДАЛЕЕ ▸" : "ПРОМОТАТЬ ▸▸"}
              </button>
              <span className="text-[11px] font-semibold tracking-[0.2em] text-[#6a5f8f] blink">ENTER / КЛИК</span>
            </div>
          </div>
        ) : (
          <div className="max-w-[720px] slide-up">
            <div className="font-disp text-5xl md:text-7xl font-black text-[#fcee0a] pulse-glow" style={{ textShadow: "0 0 30px rgba(252,238,10,0.45)" }}>
              СВОБОДА
            </div>
            <div className="mt-2 font-disp text-[13px] font-bold tracking-[0.4em] text-[#00e5ff]">ВИ + ПАНАМ // ПУСТОШИ // РАССВЕТ</div>
            <div className="mt-6"><StatsGrid stats={stats} /></div>
            <div className="mt-6 flex gap-3">
              <button className="btn btn-y px-7 py-3 text-[14px]" onClick={(e) => { e.stopPropagation(); onRetry(); }}>▸ ЕЩЁ ЗАЕЗД</button>
              <button className="btn btn-ghost px-6 py-3 text-[13px]" onClick={(e) => { e.stopPropagation(); onMenu(); }}>В МЕНЮ</button>
            </div>
          </div>
        )}
      </div>
      <div className="scanlines" />
    </div>
  );
}

/* ============================ MULTIPLAYER LOBBY ============================ */

const STATUS_META: Record<NetStatus, { text: string; color: string }> = {
  idle: { text: "КАНАЛ СВОБОДЕН", color: "#6a5f8f" },
  connecting: { text: "РЕГИСТРАЦИЯ НА СЕРВЕРЕ…", color: "#fcee0a" },
  hosting: { text: "КОМНАТА ОТКРЫТА // ОЖИДАНИЕ ОТРЯДА", color: "#00e5ff" },
  joining: { text: "ПОДКЛЮЧЕНИЕ…", color: "#fcee0a" },
  connected: { text: "НЕЙРОЛИНК СТАБИЛЕН", color: "#39ff9d" },
  error: { text: "СБОЙ", color: "#ff3b4e" },
  closed: { text: "КАНАЛ ЗАКРЫТ", color: "#ff9a3d" },
};

export function MultiplayerLobby({ status, info, role, roomCode, ping, players, myName, onHost, onJoin, onStartHost, onBack }: {
  status: NetStatus; info?: string; role: "host" | "guest" | null; roomCode: string; ping: number;
  players: string[]; myName: string;
  onHost: () => void; onJoin: (code: string) => void; onStartHost: () => void; onBack: () => void;
}) {
  const [tab, setTab] = useState<"host" | "join">("host");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const meta = STATUS_META[status];
  const showError = status === "error" || status === "closed";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { setCopied(false); }
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${KEYART})` }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(7,3,15,0.96) 0%, rgba(7,3,15,0.88) 55%, rgba(10,4,22,0.7) 100%)" }} />
      <div className="bg-gridfloor" />

      <div className="relative z-10 h-full flex items-center justify-center p-6">
        <div className="w-[980px] max-w-[96vw] grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-5 slide-up">
          {/* left: terminal */}
          <div className="panel panel-y p-7">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-disp text-[12px] font-bold tracking-[0.4em] text-[#00e5ff]">НЕЙРО-СВЯЗЬ // WEBRTC P2P</div>
                <div className="font-disp text-4xl font-black text-white mt-1">МУЛЬТИПЛЕЕР</div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em]" style={{ color: meta.color }}>
                <span className={`w-2 h-2 rounded-full ${status === "hosting" || status === "connected" ? "blink" : ""}`} style={{ background: meta.color }} />
                {meta.text}
              </div>
            </div>
            {info && <div className="mt-1 text-[12px] font-semibold text-[#6a5f8f]">{info}</div>}
            {showError && info && <div className="mt-2 text-[13px] font-bold text-[#ff3b4e]">{info}</div>}

            {/* tabs */}
            <div className="mt-6 flex gap-2">
              {(["host", "join"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`btn px-5 py-2.5 text-[12px] ${tab === t ? "btn-y" : "btn-ghost"}`}
                >
                  {t === "host" ? "СОЗДАТЬ КОМНАТУ" : "ПРИСОЕДИНИТЬСЯ"}
                </button>
              ))}
            </div>

            {tab === "host" && (
              <div className="mt-6">
                <div className="text-[12px] font-semibold tracking-[0.2em] text-[#6a5f8f]">КОД КОМНАТЫ — ПЕРЕДАЙТЕ НАПАРНИКУ</div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="font-disp text-[52px] font-black tracking-[0.35em] text-[#fcee0a] pulse-glow leading-none">
                    {role === "host" ? roomCode : "————"}
                  </div>
                  {role === "host" && (
                    <button className="btn btn-ghost px-3 py-2 text-[11px]" onClick={copy}>{copied ? "СКОПИРОВАНО" : "КОПИРОВАТЬ"}</button>
                  )}
                </div>

                <div className="mt-5">
                  <div className="text-[12px] font-semibold tracking-[0.2em] text-[#6a5f8f]">ОТРЯД [{players.length + (role === "host" ? 1 : 0)}/4]</div>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between panel px-3 py-2">
                      <span className="font-disp text-[13px] font-bold text-[#fcee0a]">ВИ</span>
                      <span className="text-[11px] font-bold tracking-widest text-[#39ff9d]">ХОСТ // ВЫ</span>
                    </div>
                    {players.map((p, i) => (
                      <div key={p + i} className="flex items-center justify-between panel px-3 py-2 toast-in">
                        <span className="font-disp text-[13px] font-bold text-[#00e5ff]">{p}</span>
                        <span className="text-[11px] font-bold tracking-widest text-[#6a5f8f]">ГОТОВ{ping > 0 ? ` // ${ping}МС` : ""}</span>
                      </div>
                    ))}
                    {players.length === 0 && (
                      <div className="text-[12px] text-[#443c63] font-semibold px-1 pt-1 blink">ОЖИДАНИЕ ПОДКЛЮЧЕНИЯ…</div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <button className="btn btn-y px-8 py-3 text-[14px]" onClick={onStartHost} disabled={role !== "host"}>
                    ▸ {players.length > 0 ? "НАЧАТЬ ЗАЕЗД" : "СТАРТОВАТЬ"}
                  </button>
                  <button className="btn btn-ghost px-5 py-3 text-[12px]" onClick={onBack}>◂ НАЗАД</button>
                </div>
              </div>
            )}

            {tab === "join" && (
              <div className="mt-6">
                <div className="text-[12px] font-semibold tracking-[0.2em] text-[#6a5f8f]">ВВЕДИТЕ КОД КОМНАТЫ ХОСТА</div>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                    onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6) onJoin(code); }}
                    placeholder="······"
                    className="font-disp text-[40px] font-black tracking-[0.4em] text-[#00e5ff] bg-[#120a22] border border-[#00e5ff]/40 px-5 py-1 outline-none w-[340px] text-center placeholder-[#2a2148] focus:border-[#00e5ff]"
                    style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                  />
                </div>
                <div className="mt-6 flex items-center gap-3">
                  <button className="btn btn-y px-8 py-3 text-[14px]" onClick={() => onJoin(code)} disabled={code.length !== 6 || status === "joining"}>
                    ▸ ПОДКЛЮЧИТЬСЯ
                  </button>
                  <button className="btn btn-ghost px-5 py-3 text-[12px]" onClick={onBack}>◂ НАЗАД</button>
                </div>
                {status === "connected" && (
                  <div className="mt-4 text-[14px] font-bold text-[#39ff9d]">ВЫ — {myName} // ЗАПУСК…</div>
                )}
              </div>
            )}
          </div>

          {/* right: briefing */}
          <div className="panel p-7 h-fit">
            <div className="font-disp text-[13px] font-bold tracking-[0.3em] text-[#ff2d78]">БРИФИНГ // КО-ОП</div>
            <div className="mt-4 space-y-3 text-[13.5px] leading-snug font-medium text-[#c9c2e6]">
              <div className="flex gap-3">
                <span className="font-disp text-[#fcee0a] font-black text-lg leading-none mt-0.5">01</span>
                <p>Один игрок создаёт комнату и играет за <span className="text-[#fcee0a] font-bold">Ви</span> — хост ведёт симуляцию мира, волн и «Базилиска».</p>
              </div>
              <div className="flex gap-3">
                <span className="font-disp text-[#00e5ff] font-black text-lg leading-none mt-0.5">02</span>
                <p>Второй вводит 6-значный код и играет за <span className="text-[#00e5ff] font-bold">Панам</span> — соединение прямое, <span className="text-white">WebRTC (PeerJS)</span>, без игровых серверов.</p>
              </div>
              <div className="flex gap-3">
                <span className="font-disp text-[#39ff9d] font-black text-lg leading-none mt-0.5">03</span>
                <p>Вместе отбивайте волны корпо, делите опыт, прокачивайте импланты и доведите танк до маяка. Врагов больше — слава тоже.</p>
              </div>
            </div>
            <div className="mt-5 panel px-3 py-2.5">
              <div className="text-[10px] font-bold tracking-[0.24em] text-[#ff9a3d]">ТЕХНИЧЕСКАЯ СВОДКА</div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] font-semibold text-[#6a5f8f]">
                <span>Сигнализация: PeerJS Cloud</span>
                <span>Данные: DataChannel</span>
                <span>Снэпшоты: 10 Гц</span>
                <span>Инпут: 15 Гц</span>
                <span>Пинг: {ping > 0 ? `${ping} мс` : "—"}</span>
                <span>NAT: STUN-обход</span>
              </div>
            </div>
            <div className="mt-4 text-[11px] font-semibold text-[#443c63] leading-relaxed">
              Нужен интернет и открытый WebRTC. Если напарник за строгим NAT — обмен может не состояться; попробуйте другую сеть.
            </div>
          </div>
        </div>
      </div>
      <div className="scanlines" />
    </div>
  );
}
