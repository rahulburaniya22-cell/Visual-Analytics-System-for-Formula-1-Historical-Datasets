// Team logo + driver headshot asset helpers.
// Logos live in /public/teams-logos, headshots in /public/headshots,
// fallback photos in /public/photos, and the F1 logo at /public/f1.svg.

// Normalized constructor name -> logo filename (in /public/teams-logos).
// Key = team name lowercased with all non-alphanumerics stripped.
const TEAM_LOGO_FILES = {
  ferrari: "ferrari-ges.png",
  mclaren: "mclaren.png",
  mercedes: "Mercedes-Logo.svg",
  redbull: "red-bull-logo-2831.png",
  williams: "williams.png",
  alpine: "alpine-f1-logo.png",
  alpinef1team: "alpine-f1-logo.png",
  astonmartin: "aston-martin.png",
  alfaromeo: "alfaromeo-removebg-preview.png",
  sauber: "Logo_Sauber_F1.png",
  bmwsauber: "Logo_Sauber_F1.png",
  haas: "haas.png",
  haasf1team: "haas.png",
  racingpoint: "Racing_Point.svg",
  forceindia: "Force_India_allmode.png",
  tororosso: "torro rosso.png",
  scuderiatororosso: "torro rosso.png",
  alphatauri: "2026racingbullslogo.png",
  rbf1team: "2026racingbullslogo.png",
  rb: "2026racingbullslogo.png",
  racingbulls: "2026racingbullslogo.png",
  lotus: "lotus-f1-team.svg",
  lotusf1team: "lotus-f1-team.svg",
  teamlotus: "lotus-f1-team.svg",
  manor: "manor-racing-seeklogo.svg",
  manormarussia: "manor-racing-seeklogo.svg",
  marussia: "Marussia_Motors_allmode.png",
  virgin: "virgin-1.svg",
  virginracing: "virgin-1.svg",
  audi: "2026audilogo.png",
};

function normalizeTeam(team) {
  return (team || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** True when we ship a real logo image for this constructor. */
export function hasTeamLogo(team) {
  return !!TEAM_LOGO_FILES[normalizeTeam(team)];
}

/**
 * Resolve a constructor name to a logo URL.
 * Falls back to the F1 logo when no team logo exists.
 */
export function getTeamLogo(team) {
  const file = TEAM_LOGO_FILES[normalizeTeam(team)];
  if (!file) return "/f1.svg";
  return "/teams-logos/" + encodeURIComponent(file);
}

// Per-team display scale — some logos read small at the shared box size.
const TEAM_LOGO_SCALE = {
  ferrari: 1.6,
  redbull: 1.4,
  mclaren: 1.6,
  alfaromeo: 1.3,
  astonmartin: 1.4,
};

/** Extra zoom factor for a team's logo (1 = no change). */
export function getTeamLogoScale(team) {
  return TEAM_LOGO_SCALE[normalizeTeam(team)] || 1;
}

// Every image file base name available under /headshots and /photos.
// Driver ids in the data are inconsistent: some are full Ergast ids
// ("max_verstappen"), most are bare surnames ("perez", "norris"), so we
// index each file by BOTH its full name and its last token (surname).
const DRIVER_FILE_BASES = [
  "Adrian_Sutil", "Alex_Yoong", "Alexander_Albon", "Alexander_Rossi",
  "Alexander_Wurz", "Allan_McNish", "Andre_Lotterer", "Andrea_Kimi_Antonelli",
  "Anthony_Davidson", "Antonio_Giovinazzi", "Antonio_Pizzonia", "Brendon_Hartley",
  "Bruno_Senna", "Carlos_Sainz", "Charles_Leclerc", "Charles_Pic",
  "Christian_Klien", "Christijan_Albers", "Cristiano_da_Matta", "Daniel_Ricciardo",
  "Daniil_Kvyat", "David_Coulthard", "Eddie_Irvine", "Enrique_Bernoldi",
  "Esteban_Gutierrez", "Esteban_Ocon", "Felipe_Massa", "Felipe_Nasr",
  "Fernando_Alonso", "Franck_Montagny", "Franco_Colapinto", "Gaston_Mazzacane",
  "George_Russell", "Giancarlo_Fisichella", "Gianmaria_Bruni", "Giedo_van_der_Garde",
  "Giorgio_Pantano", "Guanyu_Zhou", "Heikki_Kovalainen", "Heinz-Harald_Frentzen",
  "Jack_Aitken", "Jack_Doohan", "Jacques_Villeneuve", "Jaime_Alguersuari",
  "Jarno_Trulli", "Jean_Alesi", "Jean-Eric_Vergne", "Jenson_Button",
  "Jerome_dAmbrosio", "Johnny_Herbert", "Jolyon_Palmer", "Jos_Verstappen",
  "Juan_Pablo_Montoya", "Jules_Bianchi", "Justin_Wilson", "Kamui_Kobayashi",
  "Karun_Chandhok", "Kazuki_Nakajima", "Kevin_Magnussen", "Kimi_Raikkonen",
  "Lance_Stroll", "Lando_Norris", "Lewis_Hamilton", "Liam_Lawson",
  "Logan_Sargeant", "Luca_Badoer", "Lucas_di_Grassi", "Luciano_Burti",
  "Marc_Gene", "Marcus_Ericsson", "Mark_Webber", "Markus_Winkelhock",
  "Max_Chilton", "Max_Verstappen", "Michael_Schumacher", "Mick_Schumacher",
  "Mika_Hakkinen", "Mika_Salo", "Narain_Karthikeyan", "Nelson_Piquet_Jr",
  "Nicholas_Latifi", "Nick_Heidfeld", "Nico_Hulkenberg", "Nico_Rosberg",
  "Nicolas_Kiesa", "Nikita_Mazepin", "Nyck_de_Vries", "Oliver_Bearman",
  "Olivier_Panis", "Oscar_Piastri", "Pascal_Wehrlein", "Pastor_Maldonado",
  "Patrick_Friesacher", "Paul_di_Resta", "Pedro_de_la_Rosa", "Pedro_Diniz",
  "Pierre_Gasly", "Pietro_Fittipaldi", "Ralf_Schumacher", "Ralph_Firman",
  "Ricardo_Zonta", "Rio_Haryanto", "Robert_Doornbos", "Robert_Kubica",
  "Roberto_Merhi", "Romain_Grosjean", "Rubens_Barrichello", "Sakon_Yamamoto",
  "Scott_Speed", "Sebastian_Vettel", "Sebastien_Bourdais", "Sebastien_Buemi",
  "Sergey_Sirotkin", "Sergio_Perez", "Stoffel_Vandoorne", "Takuma_Sato",
  "Tarso_Marques", "Tiago_Monteiro", "Timo_Glock", "Tomas_Enge",
  "Valtteri_Bottas", "Vitaly_Petrov", "Vitantonio_Liuzzi", "Will_Stevens",
  "Yuji_Ide", "Yuki_Tsunoda", "Zsolt_Baumgartner",
];

const DRIVER_FULL_INDEX = {};
const DRIVER_SURNAME_INDEX = {};
for (const base of DRIVER_FILE_BASES) {
  const key = base.toLowerCase();
  DRIVER_FULL_INDEX[key] = base;
  const tokens = key.split("_");
  const surname = tokens[tokens.length - 1];
  // First writer wins; full-id lookups resolve ambiguous surnames anyway.
  if (!(surname in DRIVER_SURNAME_INDEX)) DRIVER_SURNAME_INDEX[surname] = base;
}

// Convert a driver id like "max_verstappen" -> "Max_Verstappen"
function driverToFileBase(driver) {
  return (driver || "")
    .split("_")
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join("_");
}

// Resolve a driver id to the best-matching file base, or null.
function resolveDriverBase(driver) {
  const key = (driver || "").toLowerCase();
  if (DRIVER_FULL_INDEX[key]) return DRIVER_FULL_INDEX[key];
  const tokens = key.split("_");
  const surname = tokens[tokens.length - 1];
  if (DRIVER_SURNAME_INDEX[surname]) return DRIVER_SURNAME_INDEX[surname];
  return null;
}

/**
 * Ordered list of candidate image URLs for a driver.
 * Prefer the curated headshot, then fall back to the wider photo set.
 * Handles both full Ergast ids ("max_verstappen") and bare surnames ("perez").
 */
export function getDriverImageCandidates(driver) {
  const bases = [];
  const resolved = resolveDriverBase(driver);
  if (resolved) bases.push(resolved);
  const naive = driverToFileBase(driver);
  if (naive && !bases.includes(naive)) bases.push(naive);

  const urls = [];
  for (const base of bases) {
    urls.push(`/headshots/${base}.png`, `/photos/${base}.jpg`, `/photos/${base}.png`);
  }
  return urls;
}
