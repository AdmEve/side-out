/**
 * Every word the player reads. Persian is the primary language, English the
 * secondary — both live here so neither can drift out of sync, and adding a
 * third is a column, not a refactor.
 */

export type Locale = 'fa' | 'en';

export const STRINGS = {
  // --- identity -----------------------------------------------------------
  you: { fa: 'شما', en: 'YOU' },
  survivalArena: { fa: 'میدان بازمانده', en: 'SURVIVAL ARENA' },
  gameTagline: { fa: '۸ بازیکن · یک بازمانده', en: '8 PLAYERS · ONE SURVIVOR' },
  gameRule: {
    fa: 'هر کس یک دیوار · دو باخت یعنی حذف · آخرین‌نفر برنده است',
    en: 'ONE WALL EACH · TWO MISSES AND YOU SHATTER · LAST ONE STANDING WINS',
  },
  footerTag: { fa: 'یک پونگ بازمانده‌ی هشت‌نفره', en: 'AN 8-PLAYER SURVIVAL PONG' },

  // --- menu ----------------------------------------------------------------
  play: { fa: 'شروع بازی', en: 'PLAY' },
  playersOnDevice: { fa: 'تعداد بازیکن روی این دستگاه', en: 'PLAYERS ON THIS DEVICE' },
  difficulty: { fa: 'سطح حریفان', en: 'OPPONENT LEVEL' },
  easy: { fa: 'آسان', en: 'EASY' },
  normal: { fa: 'متوسط', en: 'NORMAL' },
  hard: { fa: 'سخت', en: 'HARD' },
  soundOn: { fa: 'صدا روشن', en: 'SOUND ON' },
  soundOff: { fa: 'صدا خاموش', en: 'SOUND OFF' },
  bestRun: { fa: 'بهترین دوام', en: 'BEST RUN' },
  wins: { fa: 'برد', en: 'WINS' },
  noRunsYet: { fa: 'هنوز بازی نکرده‌اید', en: 'NO MATCHES YET' },
  schemeTouch: { fa: 'لمس، موس یا کلید جهت‌نما', en: 'TOUCH / MOUSE / ARROWS' },
  schemeAD: { fa: 'کلید A و D', en: 'A AND D' },
  schemeJL: { fa: 'کلید J و L', en: 'J AND L' },
  schemeNumpad: { fa: 'کلید ۴ و ۶ عددی', en: 'NUMPAD 4 AND 6' },

  // --- match HUD ------------------------------------------------------------
  left: { fa: 'باقی‌مانده', en: 'LEFT' },
  balls: { fa: 'توپ', en: 'BALLS' },
  pause: { fa: 'توقف', en: 'PAUSE' },
  paused: { fa: 'بازی متوقف شد', en: 'PAUSED' },
  resume: { fa: 'ادامه', en: 'RESUME' },
  quitToMenu: { fa: 'خروج به منو', en: 'QUIT TO MENU' },
  resumeHint: { fa: 'برای ادامه ESC یا P را بزنید', en: 'ESC OR P TO RESUME' },
  slideHint: { fa: 'انگشت خود را بکشید تا راکت حرکت کند', en: 'SLIDE TO MOVE YOUR PADDLE' },
  hotseatHint: { fa: 'هر بازیکن از دیوار خودش دفاع می‌کند', en: 'EACH PLAYER DEFENDS THEIR OWN WALL' },

  // --- escalation banners -----------------------------------------------
  finalDuel: { fa: 'دوئل پایانی', en: 'FINAL DUEL' },
  arenaClosing: { fa: 'میدان تنگ‌تر می‌شود', en: 'ARENA CLOSING IN' },
  arenaClosed: { fa: 'میدان به کمترین اندازه رسید', en: 'ARENA FULLY CLOSED' },
  ballIn: { fa: '{s} ثانیه تا توپ {n}', en: 'BALL {n} IN {s}s' },
  ballNumber: { fa: 'توپ {n}', en: 'BALL {n}' },
  go: { fa: 'شروع!', en: 'GO' },

  // --- events --------------------------------------------------------------
  youreOut: { fa: 'شما حذف شدید', en: "YOU'RE OUT" },
  isOut: { fa: '{name} حذف شد', en: '{name} IS OUT' },

  // --- sabotage --------------------------------------------------------
  sabotageTitle: {
    fa: 'حذف شدید — برای خرابکاری روی میدان بزنید',
    en: "YOU'RE OUT — TAP THE ARENA TO SABOTAGE",
  },
  hazardPeg: { fa: 'میخ', en: 'PEG' },
  hazardWell: { fa: 'گرداب', en: 'WELL' },
  hazardBar: { fa: 'میله', en: 'BAR' },
  ready: { fa: 'آماده', en: 'READY' },
  recharging: { fa: 'شارژ مجدد {s} ثانیه', en: 'RECHARGING {s}s' },
  readySoon: { fa: 'به‌زودی آماده می‌شود', en: 'READY SOON' },
  tooCloseToWall: { fa: 'به دیوار خیلی نزدیک است', en: 'TOO CLOSE TO A WALL' },

  // --- power-ups -------------------------------------------------------
  powerWide: { fa: 'راکت بزرگ', en: 'BIG PADDLE' },
  powerShield: { fa: 'سپر', en: 'SHIELD' },
  powerSlow: { fa: 'کندی زمان', en: 'SLOW TIME' },
  powerLife: { fa: 'جان اضافه', en: 'EXTRA LIFE' },

  // --- results ---------------------------------------------------------
  youWin: { fa: 'شما قهرمان شدید', en: 'YOU WIN' },
  placeOf: { fa: 'نفر {n} از {total}', en: '#{n} OF {total}' },
  someoneWins: { fa: '{name} برنده شد', en: '{name} WINS' },
  survivedFor: { fa: 'دوام {time} · {saves} برگشت', en: 'SURVIVED {time} · {saves} SAVES' },
  matchLength: { fa: 'مدت بازی {time}', en: 'MATCH LENGTH {time}' },
  colPlayer: { fa: 'بازیکن', en: 'PLAYER' },
  colSurvived: { fa: 'دوام', en: 'SURVIVED' },
  colSaves: { fa: 'برگشت', en: 'SAVES' },
  rematch: { fa: 'بازی دوباره', en: 'REMATCH' },
  menu: { fa: 'منو', en: 'MENU' },
} as const;

export type StringKey = keyof typeof STRINGS;
