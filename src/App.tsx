import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine, type HudData, type GameEv, type RunStats } from "./game/engine";
import { Sfx } from "./game/audio";
import type { PerkDef } from "./game/data";
import Hud, { type FloatItem, type ToastItem, type BannerItem } from "./components/hud";
import {
  MenuScreen, ControlsScreen, IntroScreen, PauseScreen, LevelUpScreen, DeathScreen, VictoryScreen,
} from "./components/screens";

type Phase = "menu" | "controls" | "intro" | "playing" | "paused" | "levelup" | "dead" | "won";

let UID = 1;

function GameStage({ onReady, onHud, onEvent }: {
  onReady: (e: GameEngine) => void;
  onHud: (h: HudData) => void;
  onEvent: (ev: GameEv) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cbRef = useRef({ onHud, onEvent });
  cbRef.current = { onHud, onEvent };
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const engine = new GameEngine(canvasRef.current!, {
      onHud: (h) => cbRef.current.onHud(h),
      onEvent: (e) => cbRef.current.onEvent(e),
    });
    readyRef.current(engine);
    return () => {
      engine.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ background: "#0b0614" }} />;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [started, setStarted] = useState(false);
  const [hud, setHud] = useState<HudData | null>(null);
  const [floats, setFloats] = useState<FloatItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [banner, setBanner] = useState<BannerItem | null>(null);
  const [hurtKey, setHurtKey] = useState(0);
  const [perkOptions, setPerkOptions] = useState<PerkDef[]>([]);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [deathReason, setDeathReason] = useState("Ви пала в пустошах");
  const [muted, setMuted] = useState(false);

  const engineRef = useRef<GameEngine | null>(null);
  const mutedRef = useRef(false);
  const uiSfxRef = useRef<Sfx | null>(null);

  const click = useCallback(() => {
    if (!uiSfxRef.current) uiSfxRef.current = new Sfx();
    uiSfxRef.current.ensure();
    uiSfxRef.current.ui();
  }, []);

  const handleEvent = useCallback((ev: GameEv) => {
    switch (ev.t) {
      case "toast": {
        const id = UID++;
        setToasts((t) => [...t.slice(-3), { id, text: ev.text, tone: ev.tone }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
        break;
      }
      case "float": {
        const id = UID++;
        setFloats((f) => [...f.slice(-16), { id, x: ev.x, y: ev.y, text: ev.text, crit: ev.crit, heal: ev.heal }]);
        setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 900);
        break;
      }
      case "banner": {
        const key = UID++;
        setBanner({ key, text: ev.text, sub: ev.sub });
        setTimeout(() => setBanner((b) => (b && b.key === key ? null : b)), 2700);
        break;
      }
      case "hurt":
        setHurtKey((k) => k + 1);
        break;
      case "levelup":
        setPerkOptions(ev.options);
        setPhase("levelup");
        break;
      case "death":
        setStats(ev.stats);
        setDeathReason(ev.reason);
        setPhase("dead");
        break;
      case "victory":
        setStats(ev.stats);
        setPhase("won");
        break;
      case "pause":
        setPhase("paused");
        break;
    }
  }, []);

  const handleHud = useCallback((h: HudData) => setHud(h), []);
  const handleReady = useCallback((e: GameEngine) => {
    engineRef.current = e;
    e.setMuted(mutedRef.current);
  }, []);

  const clearRunUi = useCallback(() => {
    setFloats([]);
    setToasts([]);
    setBanner(null);
    setHurtKey(0);
  }, []);

  /* ------- flow ------- */
  const startGame = () => { click(); clearRunUi(); setStarted(true); setPhase("intro"); };
  const introDone = () => { click(); engineRef.current?.start(); setPhase("playing"); };
  const choosePerk = (id: string) => { click(); engineRef.current?.choosePerk(id); setPhase("playing"); };
  const resumeGame = () => { click(); engineRef.current?.resume(); setPhase("playing"); };
  const restartRun = () => {
    click(); clearRunUi();
    const e = engineRef.current;
    if (e) { e.reset(); e.start(); }
    setPhase("playing");
  };
  const toMenu = () => { click(); setStarted(false); setPhase("menu"); engineRef.current = null; setHud(null); };
  const toggleMute = () => {
    click();
    setMuted((m) => {
      const n = !m;
      mutedRef.current = n;
      engineRef.current?.setMuted(n);
      return n;
    });
  };

  /* Esc fallback: if pointer lock is unavailable, Esc toggles pause manually */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      if (phase === "playing" && document.pointerLockElement === null) setPhase("paused");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [phase]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0b0614]">
      {started && <GameStage onReady={handleReady} onHud={handleHud} onEvent={handleEvent} />}

      {started && (phase === "playing" || phase === "paused" || phase === "levelup") && (
        <Hud hud={hud} floats={floats} toasts={toasts} banner={banner} hurtKey={hurtKey} />
      )}
      {started && phase !== "intro" && (
        <>
          <div className="crt-vignette" />
          <div className="scanlines" />
        </>
      )}

      {phase === "menu" && (
        <MenuScreen onStart={startGame} onControls={() => { click(); setPhase("controls"); }} muted={muted} onToggleMute={toggleMute} />
      )}
      {phase === "controls" && <ControlsScreen onBack={() => { click(); setPhase("menu"); }} />}
      {phase === "intro" && started && <IntroScreen onDone={introDone} />}
      {phase === "paused" && (
        <PauseScreen onResume={resumeGame} onRestart={restartRun} onMenu={toMenu} muted={muted} onToggleMute={toggleMute} />
      )}
      {phase === "levelup" && (
        <LevelUpScreen level={hud?.level ?? 1} options={perkOptions} onPick={choosePerk} />
      )}
      {phase === "dead" && stats && (
        <DeathScreen stats={stats} reason={deathReason} onRetry={restartRun} onMenu={toMenu} />
      )}
      {phase === "won" && stats && <VictoryScreen stats={stats} onRetry={restartRun} onMenu={toMenu} />}
    </div>
  );
}
