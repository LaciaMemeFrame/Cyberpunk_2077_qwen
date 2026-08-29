export const KEYART =
  "https://image.qwenlm.ai/generated-images/9e844d87-e999-4f9f-b69e-8cc0d53899d8/_result.png";

/* ---------------- weapons ---------------- */
export interface WeaponDef {
  id: number;
  name: string;
  kind: "pistol" | "smg" | "shotgun";
  auto: boolean;
  dmg: number;
  rof: number; // shots per second
  mag: number;
  reload: number; // seconds
  spread: number;
  pellets: number;
  kick: number;
  unlockWave: number;
}

export const WEAPONS: WeaponDef[] = [
  { id: 0, name: "КЭНСИН", kind: "pistol", auto: true, dmg: 24, rof: 4.6, mag: 12, reload: 1.05, spread: 0.008, pellets: 1, kick: 0.014, unlockWave: 1 },
  { id: 1, name: "HJKE «ХИКЭЦУ»", kind: "smg", auto: true, dmg: 11, rof: 11.5, mag: 42, reload: 1.5, spread: 0.022, pellets: 1, kick: 0.006, unlockWave: 2 },
  { id: 2, name: "«ИГЛА»", kind: "shotgun", auto: false, dmg: 13, rof: 1.7, mag: 6, reload: 1.9, spread: 0.06, pellets: 7, kick: 0.055, unlockWave: 4 },
];

/* ---------------- perks (RPG) ---------------- */
export interface PerkDef {
  id: string;
  name: string;
  desc: string;
  icon: string; // svg path (24x24)
  color: string;
  max: number;
}

export const PERKS: PerkDef[] = [
  { id: "ribs", name: "ТИТАНОВЫЕ РЁБРА", desc: "+40 к макс. здоровью. Скелет укреплён сплавом Ti-77.", icon: "M12 2 L21 7 V15 L12 22 L3 15 V7 Z M12 6.5 L16.5 9 V13.5 L12 16 L7.5 13.5 V9 Z", color: "#ff3b4e", max: 3 },
  { id: "regen", name: "НАНО-РЕГЕНЕРАЦИЯ", desc: "+1.4 HP/сек. Колонии наноботов штопают плоть в реальном времени.", icon: "M12 3 C7 3 4 6.5 4 10 c0 5 8 11 8 11 s8 -6 8 -11 c0 -3.5 -3 -7 -8 -7 Z M12 7 v6 M9 10 h6", color: "#39ff9d", max: 3 },
  { id: "adrenal", name: "СИНТЕТИЧЕСКИЕ СВЯЗКИ", desc: "+10% к скорости передвижения. Мышцы на сервоприводах.", icon: "M13 2 L5 13 h5 l-1.5 9 L19 10 h-5.5 Z", color: "#fcee0a", max: 3 },
  { id: "tech", name: "УМНЫЕ БОЕПРИПАСЫ", desc: "+18% урона всего оружия. Микродетонаторы в каждой пуле.", icon: "M4 12 h4 l2 -6 3 12 2.5 -8 1.5 2 h4", color: "#ff9a3d", max: 3 },
  { id: "kiroshi", name: "ФОКУС «КИРОШИ»", desc: "+10% шанс крита, +25% крит. урон. Оптика подсвечивает уязвимые точки.", icon: "M12 4 C6 4 2.5 12 2.5 12 S6 20 12 20 s9.5 -8 9.5 -8 S18 4 12 4 Z M12 9 a3 3 0 1 0 0 6 a3 3 0 0 0 0 -6 Z", color: "#00e5ff", max: 3 },
  { id: "overclock", name: "РАЗГОН «SANDEVISTAN»", desc: "−25% к перезарядке Sandevistan. Хроно-ускоритель работает на пределе.", icon: "M12 2 a10 10 0 1 0 10 10 M12 2 v10 l7 -7 M12 8 v4 l3 2", color: "#00e5ff", max: 2 },
  { id: "leech", name: "ГЕМО-СИНТЕЗАТОР", desc: "+6 HP за каждое убийство. Биомонитор перерабатывает адреналин врагов.", icon: "M12 2 C8 8 5 11 5 15 a7 7 0 0 0 14 0 c0 -4 -3 -7 -7 -13 Z M9 15 a3 3 0 0 0 3 3", color: "#ff2d78", max: 2 },
  { id: "plating", name: "ПОДКОЖНАЯ БРОНЯ", desc: "−12% входящего урона. Кевларовая сетка под эпидермисом.", icon: "M12 2 L20 5 V11 C20 16.5 16.5 20.5 12 22 C7.5 20.5 4 16.5 4 11 V5 Z M8 10 h8 M8 14 h8", color: "#b7a9ff", max: 2 },
  { id: "loader", name: "МАГ-УСКОРИТЕЛЬ", desc: "+30% магазин, −25% время перезарядки. Магнитные захваты в ладонях.", icon: "M5 9 h14 v4 h-3 l-2 4 h-4 l-2 -4 H5 Z M12 3 v4 M8 3 v3 M16 3 v3", color: "#fcee0a", max: 2 },
  { id: "mantis", name: "КЛИНКИ «БОМОМОЛ»", desc: "РЫВОК (Shift) рассекает врагов на пути: 90 урона. Хромовые лезвия в предплечьях.", icon: "M4 20 C10 14 16 8 20 4 M7 21 C12 16 17 11 21 7 M4 20 l3 1 M4 20 l1 -3", color: "#ff2d78", max: 1 },
  { id: "ice", name: "ДЭЙМОН «СХЛОП»", desc: "25% шанс, что убитый враг взорвётся и заденет соседей. Лёд взламывает батареи дронов.", icon: "M12 2 v20 M4 6 l16 12 M20 6 L4 18 M12 7 l3 -2 M12 7 l-3 -2 M12 17 l3 2 M12 17 l-3 2", color: "#00e5ff", max: 1 },
  { id: "coproc", name: "БАЛЛИСТИЧЕСКИЙ СОПРОЦЕССОР", desc: "−40% разброса оружия. Микроруление стволом через нейролинк.", icon: "M12 2 a10 10 0 1 0 0 20 a10 10 0 0 0 0 -20 Z M12 8 v8 M8 12 h8 M12 12 m-1.6 0 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0", color: "#b7a9ff", max: 1 },
];

/* ---------------- cyberware chips (drops) ---------------- */
export const CHIP_BONUSES = [
  { id: "chip_hp", name: "Усиленные ткани", desc: "+15 макс. HP", icon: "♥" },
  { id: "chip_dmg", name: "Катализатор урона", desc: "+8% урона", icon: "◆" },
  { id: "chip_regen", name: "Биомонитор v2", desc: "+1 HP/сек", icon: "+" },
  { id: "chip_crit", name: "Нейро-фокус", desc: "+5% крита", icon: "◎" },
  { id: "chip_cd", name: "Хроно-стабилизатор", desc: "−10% КД Sandevistan", icon: "◔" },
] as const;

/* ---------------- enemies ---------------- */
export interface EnemyDef {
  kind: "drone" | "soldier" | "heavy";
  hp: number;
  speed: number;
  dmg: number;
  xp: number;
}
export const ENEMY_DEFS: Record<"drone" | "soldier" | "heavy", EnemyDef> = {
  drone: { kind: "drone", hp: 34, speed: 7.5, dmg: 26, xp: 16 },
  soldier: { kind: "soldier", hp: 72, speed: 4.4, dmg: 9, xp: 26 },
  heavy: { kind: "heavy", hp: 300, speed: 2.7, dmg: 12, xp: 70 },
};

/* ---------------- story ---------------- */
export const INTRO_LINES: { speaker?: string; text: string }[] = [
  { text: "Найт-Сити остался позади. Неоновые башни тают в закатной дымке — и впервые за долгие годы ты не оглядываешься с тоской." },
  { text: "Ты — Ви. Киберпанк. Наёмница с хромом в крови. Сегодня ты сбегаешь из города навсегда — вместе с Панам и Альдекальдос." },
  { speaker: "ПАНАМ", text: "Ви! Корпораты повисли на хвосте — «Арасака» не отпускает свою собственность. Прикрывай «Базилиск», пока гипердвигатель копит заряд!" },
  { speaker: "СИСТЕМА", text: "Отбей волны преследователей и доведи «Базилиск» до маяка эвакуации. Прокачивай импланты. Не дай пустыне забрать тех, кого любишь." },
];

export const RADIO_LINES: { at: number; text: string }[] = [
  { at: 0.04, text: "Панам: «Держись рядом, Ви! Я чувствую твою руку даже через нейролинк.»" },
  { at: 0.25, text: "Панам: «Четверть пути! Альдекальдос уже разожгли костры на той стороне.»" },
  { at: 0.5, text: "Панам: «Половина!.. Ви, ради этого стоило угнать танк у „Арасаки“.»" },
  { at: 0.75, text: "Панам: «Вижу маяк! Ещё чуть-чуть, любимая. Не смей умирать — слышишь?»" },
  { at: 0.93, text: "Панам: «ГИПЕРДВИГАТЕЛЬ НА ПРЕДЕЛЕ! Держись, сейчас рванём!»" },
];

export const WAVE_QUIPS = [
  "Панам: «Опять дроны? Серьёзно? У них что, склад резиновых псов?»",
  "Панам: «Меньше болтовни — больше пуль, Ви!»",
  "Панам: «Эти корпо даже в пустыне не дадут спокойно покурить.»",
  "Панам: «Базилиску нужен заряд. Тебе — прицел. Работаем.»",
];

export const ENDING_LINES: { speaker?: string; text: string }[] = [
  { text: "Гипердвигатель взревел белым пламенем. «Базилиск» рванулся к горизонту, оставив корпоративных псов глотать пустынную пыль." },
  { speaker: "ПАНАМ", text: "Мы сделали это, Ви. Найт-Сити больше не наша клетка." },
  { text: "Панам нашла твою ладонь среди проводов и хрома. Закат Багровых пустошей горел рыжим и розовым — как обещание." },
  { speaker: "ВИ", text: "Куда теперь? — Куда угодно. Лишь бы вместе." },
  { text: "Две фигуры у капота остывающего танка. Город-тюрьма погас за спиной. Впереди — целая планета." },
];

export const CONTROLS: { keys: string[]; label: string }[] = [
  { keys: ["W", "A", "S", "D"], label: "Движение" },
  { keys: ["МЫШЬ"], label: "Обзор / прицел" },
  { keys: ["ЛКМ"], label: "Огонь" },
  { keys: ["R"], label: "Перезарядка" },
  { keys: ["1", "2", "3"], label: "Смена оружия" },
  { keys: ["Q"], label: "Sandevistan — замедление времени" },
  { keys: ["SHIFT"], label: "Рывок (клинками — если установлены)" },
  { keys: ["SPACE"], label: "Прыжок" },
  { keys: ["ESC"], label: "Пауза" },
];

export const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
};
