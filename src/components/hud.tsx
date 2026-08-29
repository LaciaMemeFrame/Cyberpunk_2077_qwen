import { useEffect, useRef } from "react";
import type { HudData } from "../game/engine";
import { fmtTime } from "../game/data";

export interface FloatItem { id: number; x: number; y: number; text: string; crit: boolean; heal?: boolean }
export interface ToastItem { id: number; text: string; tone: "panam" | "sys" | "chip" | "warn" }
export interface BannerItem { key: number; text: string; sub?: string }

const toneStyle: Record<ToastItem["tone"], { border: string; label: string; color: string }> = {
  panam: { border: "border-l-[#ff9a3d]", label: "ПАНАМ // РАЦИЯ", color: "text-[#ffb35a]" },
  sys: { border: "border-l-[#00e5ff]", label: "СИСТЕМА", color: "text-[#00e5ff]" },
  chip: { border: "border-l-[#fcee0a]", label: "КИБЕРДЕКА", color: "text-[#fcee0a]" },
  warn: { border: "border-l-[#ff3b4e]", label: "ТРЕВОГА", color: "text-[#ff3b4e]" },
};

function Radar({ hud }: { hud: HudData }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const S = 136, R = S / 2 - 4;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.fillStyle = "rgba(6,4,16,0.72)";
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(0,229,255,0.35)";
    ctx.lineWidth = 1;
    [0.33, 0.66, 1].forEach((k) => { ctx.beginPath(); ctx.arc(0, 0, R * k, 0, Math.PI * 2); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(R, 0); ctx.moveTo(0, -R); ctx.lineTo(0, R); ctx.stroke();
    const ang = (hud.time * 1.4) % (Math.PI * 2);
    const grad = ctx.createConicGradient ? ctx.createConicGradient(ang, 0, 0) : null;
    if (grad) {
      grad.addColorStop(0, "rgba(0,229,255,0.28)");
      grad.addColorStop(0.12, "rgba(0,229,255,0)");
      grad.addColorStop(1, "rgba(0,229,255,0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    }
    const fwdX = -Math.sin(hud.yaw), fwdZ = -Math.cos(hud.yaw);
    const rightX = Math.cos(hud.yaw), rightZ = -Math.sin(hud.yaw);
    const plot = (x: number, z: number): [number, number, boolean] => {
      const cx = x * rightX + z * rightZ;
      const cz = x * fwdX + z * fwdZ;
      const len = Math.hypot(cx, cz);
      const edge = len > R - 6;
      const k = edge ? (R - 6) / len : 1;
      return [cx * k, -cz * k, edge];
    };
    for (const r of hud.radar) {
      const [px, pz, edge] = plot(r.x, r.z);
      ctx.globalAlpha = edge ? 0.55 : 1;
      if (r.k === "soldier") ctx.fillStyle = "#ff5060";
      else if (r.k === "drone") ctx.fillStyle = "#ff2d78";
      else if (r.k === "heavy") ctx.fillStyle = "#ff9a3d";
      else if (r.k === "med") ctx.fillStyle = "#39ff9d";
      else if (r.k === "chip") ctx.fillStyle = "#fcee0a";
      else if (r.k === "basilisk") ctx.fillStyle = "#00e5ff";
      else ctx.fillStyle = "#7ad7ff";
      if (r.k === "beacon") {
        ctx.save();
        ctx.translate(px, pz); ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.6;
        ctx.strokeRect(-3.4, -3.4, 6.8, 6.8);
        ctx.restore();
      } else if (r.k === "basilisk") {
        ctx.fillRect(px - 3, pz - 3, 6, 6);
      } else if (r.k === "heavy") {
        ctx.beginPath(); ctx.arc(px, pz, 3.6, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(px, pz, r.k === "med" || r.k === "chip" ? 2.2 : 2.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fcee0a";
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }, [hud]);
  return <canvas ref={ref} width={136} height={136} />;
}

function AbilitySlot({ label, frac, active, name }: { label: string; frac: number; active: boolean; name: string }) {
  const ready = frac >= 1;
  return (
    <div className={`panel w-[74px] h-[74px] flex flex-col items-center justify-center gap-0.5 ${active ? "!border-[#00e5ff]" : ""}`}
      style={active ? { boxShadow: "0 0 18px rgba(0,229,255,0.5), inset 0 0 12px rgba(0,229,255,0.25)" } : undefined}>
      <div className="relative w-9 h-9">
        <div className="absolute inset-0 rounded-full border border-[#3a2f63]" />
        {!ready && !active && (
          <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(rgba(0,229,255,0.55) ${frac * 360}deg, rgba(20,14,40,0.9) 0deg)` }} />
        )}
        {active && <div className="absolute inset-0 rounded-full bg-[#00e5ff]/70 animate-pulse" />}
        <div className="absolute inset-0 flex items-center justify-center font-disp text-[13px] font-bold text-white drop-shadow">{label}</div>
      </div>
      <div className={`text-[10px] font-semibold tracking-[0.14em] ${ready || active ? "text-[#00e5ff]" : "text-[#6a5f8f]"}`}>{name}</div>
    </div>
  );
}

export default function Hud({ hud, floats, toasts, banner, hurtKey }: {
  hud: HudData | null;
  floats: FloatItem[];
  toasts: ToastItem[];
  banner: BannerItem | null;
  hurtKey: number;
}) {
  if (!hud) return null;
  const hpFrac = hud.hp / hud.maxHp;
  const lowHp = hpFrac < 0.3;
  const activeW = hud.weapons[hud.weaponIdx];
  const gap = Math.round(hud.spread);

  return (
    <div className="absolute inset-0 z-30 pointer-events-none select-none overflow-hidden">
      {/* hit / heal floats */}
      {floats.map((f) => (
        <div key={f.id} className="float-dmg"
          style={{
            left: f.x, top: f.y,
            color: f.heal ? "#39ff9d" : f.crit ? "#fcee0a" : "#ffffff",
            fontSize: f.crit ? 26 : f.heal ? 17 : 19,
          }}>
          {f.text}
        </div>
      ))}

      {/* hurt flash */}
      {hurtKey > 0 && (
        <div key={hurtKey} className="hurt-flash absolute inset-0 z-40"
          style={{ background: "radial-gradient(ellipse at center, transparent 42%, rgba(255,30,50,0.5) 100%)" }} />
      )}
      {hud.sandeActive && <div className="sande-overlay" />}
      {lowHp && <div className="lowhp-overlay" />}

      {/* crosshair */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative w-0 h-0">
          {[
            { t: `translate(-50%,-50%) rotate(0deg) translateY(-${gap}px)`, w: 2, h: 9 },
            { t: `translate(-50%,-50%) rotate(180deg) translateY(-${gap}px)`, w: 2, h: 9 },
            { t: `translate(-50%,-50%) rotate(90deg) translateY(-${gap}px)`, w: 2, h: 9 },
            { t: `translate(-50%,-50%) rotate(270deg) translateY(-${gap}px)`, w: 2, h: 9 },
          ].map((l, i) => (
            <div key={i} className="absolute bg-[#fcee0a]" style={{ width: l.w, height: l.h, transform: l.t, boxShadow: "0 0 6px rgba(252,238,10,0.8)", transition: "transform 90ms ease-out" }} />
          ))}
          <div className="absolute w-[3px] h-[3px] -translate-x-1/2 -translate-y-1/2 bg-[#00e5ff] rounded-full" style={{ boxShadow: "0 0 8px #00e5ff" }} />
        </div>
      </div>

      {/* sandevistan label */}
      {hud.sandeActive && (
        <div className="absolute left-1/2 top-[62%] -translate-x-1/2 font-disp text-[13px] tracking-[0.5em] text-[#00e5ff] blink">
          SANDEVISTAN
        </div>
      )}

      {/* banner */}
      {banner && (
        <div key={banner.key} className="absolute left-1/2 top-[24%] -translate-x-1/2 text-center banner-in">
          <div className="font-disp text-4xl md:text-5xl font-black text-[#fcee0a]" style={{ textShadow: "0 0 24px rgba(252,238,10,0.6), 0 0 60px rgba(252,238,10,0.3)" }}>
            {banner.text}
          </div>
          {banner.sub && <div className="mt-2 text-sm md:text-base font-semibold tracking-[0.34em] uppercase text-[#00e5ff]">{banner.sub}</div>}
        </div>
      )}

      {/* top-left: objective */}
      <div className="absolute left-4 top-4 w-[300px] space-y-2">
        <div className="panel px-3 py-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold tracking-[0.24em] text-[#6a5f8f]">ЦЕЛЬ // МАЯК ЭВАКУАЦИИ</span>
            <span className="font-disp text-sm font-bold text-[#00e5ff]">{Math.round(hud.progress * 100)}%</span>
          </div>
          <div className="hud-bar h-[9px] mt-1">
            <div className="hud-fill" style={{ width: `${hud.progress * 100}%`, background: "linear-gradient(90deg,#007a8a,#00e5ff)", boxShadow: "0 0 10px rgba(0,229,255,0.7)" }} />
            <div className="hud-ticks absolute inset-0" />
          </div>
        </div>
        <div className="panel px-3 py-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold tracking-[0.24em] text-[#6a5f8f]">«БАЗИЛИСК» // ПАНАМ</span>
            <span className="font-disp text-sm font-bold" style={{ color: hud.basiliskHp / hud.basiliskMax > 0.35 ? "#fcee0a" : "#ff3b4e" }}>
              {hud.basiliskHp}
            </span>
          </div>
          <div className="hud-bar h-[9px] mt-1">
            <div className="hud-fill" style={{
              width: `${(hud.basiliskHp / hud.basiliskMax) * 100}%`,
              background: hud.basiliskHp / hud.basiliskMax > 0.35 ? "linear-gradient(90deg,#8a7a00,#fcee0a)" : "linear-gradient(90deg,#8a1020,#ff3b4e)",
            }} />
            <div className="hud-ticks absolute inset-0" />
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {hud.implants.map((im) => (
            <span key={im} className="text-[10px] font-semibold tracking-wider text-[#00e5ff]/85 border border-[#00e5ff]/25 bg-[#00e5ff]/5 px-1.5 py-0.5 clip-path-none">
              ⌁ {im}
            </span>
          ))}
        </div>
      </div>

      {/* top-right: radar + stats */}
      <div className="absolute right-4 top-4 flex flex-col items-end gap-1.5">
        <div className="panel p-1.5">
          <Radar hud={hud} />
        </div>
        <div className="panel px-3 py-1.5 flex items-center gap-4 font-disp text-[12px] font-bold">
          <span className="text-[#6a5f8f]">ВОЛНА <span className="text-[#ff2d78]">{hud.wave}</span></span>
          <span className="text-[#6a5f8f]">УБИЙСТВА <span className="text-[#fcee0a]">{hud.kills}</span></span>
          <span className="text-[#6a5f8f]">{fmtTime(hud.time)}</span>
        </div>
      </div>

      {/* bottom-left: vitals */}
      <div className="absolute left-4 bottom-4 w-[320px]">
        <div className="flex items-end gap-3">
          <div className="panel panel-y w-[64px] h-[64px] flex flex-col items-center justify-center shrink-0">
            <span className="font-disp text-2xl font-black text-[#fcee0a] leading-none">{hud.level}</span>
            <span className="text-[9px] font-bold tracking-[0.2em] text-[#6a5f8f] mt-1">УРОВЕНЬ</span>
          </div>
          <div className="flex-1">
            <div className="flex items-baseline justify-between">
              <span className="font-disp text-3xl font-black leading-none" style={{ color: lowHp ? "#ff3b4e" : "#e8e4f7", textShadow: lowHp ? "0 0 14px rgba(255,59,78,0.8)" : "none" }}>
                {hud.hp}
              </span>
              <span className="text-[11px] font-semibold tracking-[0.2em] text-[#6a5f8f]">ВИТАЛЬНЫЕ ДАННЫЕ // {hud.maxHp}</span>
            </div>
            <div className="hud-bar h-[16px] mt-1.5">
              <div className="hud-fill" style={{
                width: `${hpFrac * 100}%`,
                background: lowHp ? "linear-gradient(90deg,#7a0d1c,#ff3b4e)" : "linear-gradient(90deg,#0d7a4a,#39ff9d)",
                boxShadow: lowHp ? "0 0 14px rgba(255,59,78,0.6)" : "0 0 10px rgba(57,255,157,0.4)",
              }} />
              <div className="hud-ticks absolute inset-0" />
            </div>
            <div className="hud-bar h-[6px] mt-1.5">
              <div className="hud-fill" style={{ width: `${(hud.xp / hud.xpNext) * 100}%`, background: "linear-gradient(90deg,#7a00c8,#ff2d78)", boxShadow: "0 0 8px rgba(255,45,120,0.5)" }} />
            </div>
            <div className="text-[10px] font-semibold tracking-[0.18em] text-[#6a5f8f] mt-0.5">
              ОПЫТ {hud.xp}/{hud.xpNext}
            </div>
          </div>
        </div>
      </div>

      {/* bottom-right: weapons + abilities */}
      <div className="absolute right-4 bottom-4 flex items-end gap-3">
        <div className="flex flex-col gap-1.5 items-end">
          {hud.weapons.map((w) => (
            <div key={w.id} className={`panel px-2.5 py-1 flex items-center gap-2 text-[11px] font-bold tracking-wider transition-all ${w.active ? "!border-[#fcee0a] text-[#fcee0a] translate-x-[-4px]" : w.unlocked ? "text-[#8f86b5]" : "text-[#443c63] opacity-60"}`}
              style={w.active ? { boxShadow: "0 0 12px rgba(252,238,10,0.25)" } : undefined}>
              <span className="keycap !text-[10px] !min-w-[18px]">{w.id + 1}</span>
              <span>{w.unlocked ? w.name : "ЗАБЛОКИРОВАНО"}</span>
            </div>
          ))}
        </div>
        <div className="panel px-4 py-2.5 text-right">
          <div className="text-[10px] font-bold tracking-[0.22em] text-[#6a5f8f]">{activeW.name}</div>
          <div className="flex items-baseline justify-end gap-1.5">
            <span className="font-disp text-[34px] font-black leading-none text-[#fcee0a]" style={{ textShadow: "0 0 14px rgba(252,238,10,0.45)" }}>
              {activeW.mag}
            </span>
            <span className="font-disp text-base font-bold text-[#6a5f8f]">/ ∞</span>
          </div>
          {hud.reloading ? (
            <div className="hud-bar h-[5px] mt-1.5 w-[120px] ml-auto">
              <div className="hud-fill" style={{ width: `${hud.reloadFrac * 100}%`, background: "#00e5ff" }} />
            </div>
          ) : (
            <div className="text-[10px] font-semibold tracking-[0.16em] text-[#443c63] mt-1">[R] ПЕРЕЗАРЯДКА</div>
          )}
        </div>
        <div className="flex gap-2">
          <AbilitySlot label="Q" frac={hud.sandeFrac} active={hud.sandeActive} name="SANDEVISTAN" />
          <AbilitySlot label="⇧" frac={hud.dashFrac} active={false} name="РЫВОК" />
        </div>
      </div>

      {/* toasts */}
      <div className="absolute left-4 bottom-[150px] w-[360px] space-y-1.5">
        {toasts.map((t) => {
          const s = toneStyle[t.tone];
          return (
            <div key={t.id} className={`toast-in panel border-l-4 ${s.border} px-3 py-1.5 bg-[#0c0818]/85`}>
              <div className={`text-[9px] font-bold tracking-[0.24em] ${s.color}`}>{s.label}</div>
              <div className="text-[13px] font-medium leading-snug text-[#e8e4f7]">{t.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
