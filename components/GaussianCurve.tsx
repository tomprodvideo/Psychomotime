/**
 * Courbe de Gauss (loi normale) : Très faible / Faible / Moyenne / Supérieur /
 * Très supérieur, et axes DS, NS et percentiles.
 * SVG pur -> s'imprime dans le PDF du bilan.
 *
 * ── CE QUE CETTE FIGURE DOIT SURVIVRE : UNE IMPRIMANTE NOIR ET BLANC ───────
 *
 * `globals.css` pose `print-color-adjust: exact`. Sur une imprimante
 * monochrome, cela ne préserve pas la couleur : cela force le pilote à
 * CONVERTIR chaque couleur en gris. Tout ce qui était codé par la couleur
 * devient donc codé par un niveau de gris — et c'est là que l'ancienne palette
 * cassait.
 *
 * Mesuré sur les valeurs déclarées (luminance relative sRGB, ré-encodée en
 * gris perçu, aplat composité à son opacité réelle sur blanc) :
 *
 *     AVANT   125 -> 174 -> 165 -> 202 -> 224
 *                      \______/
 *              « Faible » s'imprimait PLUS CLAIR que « Moyenne ».
 *
 * Sur une courbe où le clair se lit spontanément comme « tout va bien », la
 * bande de fragilité paraissait plus rassurante que la bande moyenne. Ce
 * n'était pas une perte d'information : c'était une information fausse.
 *
 *     APRÈS   147 -> 170 -> 192 -> 212 -> 232
 *
 * La teinte et la saturation de chacune des cinq couleurs sont CONSERVÉES —
 * seule la clarté bouge, juste assez pour que l'échelle de gris soit
 * monotone. La figure reste rouge-orangé-vert ; elle s'imprime en dégradé
 * lisible. AUCUN SEUIL N'EST DÉPLACÉ : les frontières restent à -2, -1, +1 et
 * +2 DS, et le vocabulaire des bandes est inchangé. La question ouverte
 * `Q-202` porte sur les MOTS et les seuils ; elle n'est pas tranchée ici et
 * n'a pas à l'être pour corriger un défaut de rendu.
 *
 * ── LA COULEUR N'EST PLUS JAMAIS LE SEUL CANAL ────────────────────────────
 *
 * 1. Les quatre frontières de classification sont TRACÉES. Un trait reste un
 *    trait en noir et blanc, même là où les deux bandes qu'il sépare
 *    s'impriment au même gris.
 * 2. Chaque bande ÉCRIT son intervalle en DS. La classification ne dépend plus
 *    de savoir lire une position sur l'axe.
 *
 * ── CONTRASTE ─────────────────────────────────────────────────────────────
 *
 * Les étiquettes de bande étaient en blanc sur trois des cinq bandes :
 * 4,10:1, 2,23:1 et 2,45:1 — trois échecs de 1.4.3 (AA), sur un document remis
 * à des familles. Et les libellés d'axe portaient cinq teintes dont QUATRE
 * échouaient (3,22 / 4,10 / 2,83 / 2,29:1) à 8,5 px.
 *
 * Tout le texte est donc en `ENCRE`, vérifié >= 4,5:1 sur blanc ET sur chacun
 * des cinq aplats à leur opacité réelle. Les numéros d'axe ne sont plus
 * teintés par zone : cinq teintes distinctes qui passent toutes le seuil sont
 * impossibles à 8,5 px, et cette information est mieux portée par la bande
 * juste en dessous, qui a la place de l'écrire.
 *
 * [Contrastes calculés sur les valeurs déclarées ici. Un profil d'impression
 * peut les déplacer : cela suffit à corriger, pas à certifier.]
 */

const DS_MIN = -3.4;
const DS_MAX = 3.4;
const X_LEFT = 175;
const X_RIGHT = 795;
const Y_TOP = 58;
const Y_BASE = 295;

/** Clarté choisie pour que l'échelle de gris imprimée soit croissante. */
const COLORS = {
  red: "#cc716f",
  orange: "#e78f30",
  green: "#a2c58c",
  lightGreen: "#b9daa3",
  pale: "#deead1",
};

/** Une seule encre. 4,77:1 au pire (sur l'aplat rouge), 14,9:1 sur blanc. */
const ENCRE = "#1e293b";
/** Le trait des frontières et de l'axe. */
const TRAIT = "#334155";

function X(ds: number) {
  return X_LEFT + ((ds - DS_MIN) / (DS_MAX - DS_MIN)) * (X_RIGHT - X_LEFT);
}
function gauss(x: number) {
  return Math.exp((-x * x) / 2);
}
function Y(ds: number) {
  return Y_BASE - gauss(ds) * (Y_BASE - Y_TOP);
}

function areaPath(a: number, b: number) {
  const pts: string[] = [];
  for (let ds = a; ds <= b + 1e-9; ds += 0.04) {
    pts.push(`${X(ds).toFixed(1)},${Y(ds).toFixed(1)}`);
  }
  pts.push(`${X(b).toFixed(1)},${Y(b).toFixed(1)}`);
  return `M ${X(a).toFixed(1)},${Y_BASE} L ${pts.join(" L ")} L ${X(b).toFixed(
    1,
  )},${Y_BASE} Z`;
}

function curveLine() {
  const pts: string[] = [];
  for (let ds = DS_MIN; ds <= DS_MAX + 1e-9; ds += 0.04) {
    pts.push(`${X(ds).toFixed(1)},${Y(ds).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")}`;
}

const BANDS: [number, number, string][] = [
  [DS_MIN, -2, COLORS.red],
  [-2, -1, COLORS.orange],
  [-1, 1, COLORS.green],
  [1, 2, COLORS.lightGreen],
  [2, DS_MAX, COLORS.pale],
];

const PCTS: [number, string][] = [
  [-3.2, "0,13 %"],
  [-2.5, "2,14 %"],
  [-1.5, "13,6 %"],
  [-0.5, "34,13 %"],
  [0.5, "34,13 %"],
  [1.5, "13,6 %"],
  [2.5, "2,14 %"],
  [3.2, "0,13 %"],
];

const DS_TICKS = [-3, -2, -1, 0, 1, 2, 3];

/** Les quatre DS où une bande change. Tracées ; les autres restent décoratives. */
const FRONTIERES = [-2, -1, 1, 2];

const PERCENTILES: [number, string][] = [
  [-3, "≤ 2,3"],
  [-2, "2,3"],
  [-1, "15"],
  [0, "50"],
  [1, "85"],
  [2, "97,7"],
  [3, "≥ 97,7"],
];

/** [début, fin, aplat, nom, intervalle écrit] */
const CATEGORIES: [number, number, string, string, string][] = [
  [DS_MIN, -2, COLORS.red, "Très faible", "< -2 DS"],
  [-2, -1, COLORS.orange, "Faible", "-2 à -1 DS"],
  [-1, 1, COLORS.green, "Moyenne", "-1 à +1 DS"],
  [1, 2, COLORS.lightGreen, "Supérieur", "+1 à +2 DS"],
  [2, DS_MAX, COLORS.pale, "Très supérieur", "> +2 DS"],
];

const BAND_Y = 372;
const BAND_H = 34;

export default function GaussianCurve() {
  return (
    /* UN LECTEUR D'ÉCRAN RECEVAIT UNE SUITE DE FRAGMENTS — « -3 -2 -1 0 1 2 3
       34,13 % 13,6 % … » — sans structure ni sens. `role="img"` referme le
       dessin sur lui-même et le fait annoncer d'une phrase.
       La description dit ce que la figure MONTRE, sans rien conclure : la
       position d'un résultat dans cette courbe s'interprète par le
       psychomotricien, pas par une étiquette. */
    <svg
      role="img"
      aria-label="Courbe de répartition en cloche, graduée en déviations standard de -3 à +3, avec le pourcentage attendu dans chaque intervalle. Cinq zones sont délimitées par un trait et nommées avec leur intervalle : très faible en dessous de -2 DS, faible de -2 à -1 DS, moyenne de -1 à +1 DS, supérieur de +1 à +2 DS, très supérieur au-dessus de +2 DS."
      viewBox="0 0 820 430"
      className="w-full h-auto"
      style={{
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {/* Aires colorées sous la courbe */}
      {BANDS.map(([a, b, color], i) => (
        <path key={i} d={areaPath(a, b)} fill={color} fillOpacity={0.9} />
      ))}

      {/* Graduations décoratives : les DS entiers qui ne sont PAS une frontière. */}
      {DS_TICKS.filter((ds) => !FRONTIERES.includes(ds)).map((ds) => (
        <line
          key={ds}
          x1={X(ds)}
          x2={X(ds)}
          y1={Y(ds)}
          y2={Y_BASE}
          stroke="#ffffff"
          strokeWidth={0.8}
          strokeOpacity={0.7}
        />
      ))}

      {/* LES FRONTIÈRES DE CLASSIFICATION, TRACÉES.
          Deux segments, pour ne pas barrer les trois rangées de chiffres qui
          s'intercalent entre la courbe et la bande des catégories. */}
      {FRONTIERES.map((ds) => (
        <g key={`f${ds}`}>
          <line
            x1={X(ds)}
            x2={X(ds)}
            y1={Y(ds)}
            y2={Y_BASE}
            stroke={TRAIT}
            strokeWidth={1}
          />
          <line
            x1={X(ds)}
            x2={X(ds)}
            y1={BAND_Y}
            y2={BAND_Y + BAND_H}
            stroke={TRAIT}
            strokeWidth={1}
          />
        </g>
      ))}

      {/* Contour de la courbe */}
      <path d={curveLine()} fill="none" stroke="#5b7d3e" strokeWidth={1.4} />

      {/* Axe horizontal */}
      <line
        x1={X_LEFT - 40}
        x2={X_RIGHT + 15}
        y1={Y_BASE}
        y2={Y_BASE}
        stroke="#8a8a8a"
        strokeWidth={1.5}
      />

      {/* Pourcentages */}
      {PCTS.map(([ds, label], i) => (
        <text
          key={i}
          x={X(ds)}
          y={Y_BASE - 6}
          textAnchor="middle"
          fontSize={8.5}
          fontStyle="italic"
          fill={ENCRE}
        >
          {label}
        </text>
      ))}

      {/* Libellés de lignes (à gauche) */}
      <text x={6} y={315} fontSize={8.5} fontStyle="italic" fill={ENCRE}>
        Déviations Standards (DS)
      </text>
      <text x={6} y={337} fontSize={8.5} fontStyle="italic" fill={ENCRE}>
        Notes Standards (NS)
      </text>
      <text x={6} y={359} fontSize={8.5} fontStyle="italic" fill={ENCRE}>
        Percentiles
      </text>

      {/* Row DS */}
      {DS_TICKS.map((ds) => (
        <text
          key={ds}
          x={X(ds)}
          y={315}
          textAnchor="middle"
          fontSize={9}
          fontWeight={600}
          fill={ENCRE}
        >
          {ds > 0 ? `+${ds}` : ds} DS
        </text>
      ))}

      {/* Row NS (1..19) */}
      {Array.from({ length: 19 }, (_, k) => k + 1).map((ns) => (
        <text
          key={ns}
          x={X((ns - 10) / 3)}
          y={337}
          textAnchor="middle"
          fontSize={8.5}
          fontWeight={600}
          fill={ENCRE}
        >
          {ns}
        </text>
      ))}

      {/* Row percentiles */}
      {PERCENTILES.map(([ds, label]) => (
        <text
          key={ds}
          x={X(ds)}
          y={359}
          textAnchor="middle"
          fontSize={8.5}
          fontWeight={600}
          fill={ENCRE}
        >
          {label}
        </text>
      ))}

      {/* Bande des catégories : le nom, puis l'intervalle qui le définit. */}
      {CATEGORIES.map(([a, b, color, label, intervalle], i) => {
        const x = X(a);
        const w = X(b) - X(a);
        return (
          <g key={i}>
            <rect
              x={x}
              y={BAND_Y}
              width={w}
              height={BAND_H}
              fill={color}
              fillOpacity={0.92}
            />
            <text
              x={x + w / 2}
              y={BAND_Y + 14}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fontStyle="italic"
              fill={ENCRE}
            >
              {label}
            </text>
            <text
              x={x + w / 2}
              y={BAND_Y + 26}
              textAnchor="middle"
              fontSize={7.5}
              fill={ENCRE}
            >
              {intervalle}
            </text>
          </g>
        );
      })}

      {/* Le cadre de la bande, pour que les frontières tracées s'y appuient. */}
      <rect
        x={X(DS_MIN)}
        y={BAND_Y}
        width={X(DS_MAX) - X(DS_MIN)}
        height={BAND_H}
        fill="none"
        stroke={TRAIT}
        strokeWidth={1}
      />
    </svg>
  );
}
