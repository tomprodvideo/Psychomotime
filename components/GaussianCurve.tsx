/**
 * Courbe de Gauss (loi normale) avec zones colorées : Très faible / Faible /
 * Moyenne / Sup / Très supérieur, et axes DS, NS et percentiles.
 * SVG pur -> s'imprime en couleur dans le PDF du bilan.
 */

const DS_MIN = -3.4;
const DS_MAX = 3.4;
const X_LEFT = 175;
const X_RIGHT = 795;
const Y_TOP = 58;
const Y_BASE = 295;

const COLORS = {
  red: "#c0504d",
  orange: "#e8943a",
  green: "#7aab5a",
  lightGreen: "#a9d18e",
  pale: "#d4e3c3",
};

// Couleurs de texte (plus soutenues, lisibles) par zone.
const TEXT = {
  red: "#b23b37",
  orange: "#d17a1e",
  green: "#5a8a37",
  lightGreen: "#7ba653",
  pale: "#93b673",
};

function zoneColor(ds: number) {
  if (ds < -2) return TEXT.red;
  if (ds < -1) return TEXT.orange;
  if (ds <= 1) return TEXT.green;
  if (ds <= 2) return TEXT.lightGreen;
  return TEXT.pale;
}

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
const PERCENTILES: [number, string][] = [
  [-3, "≤ 2,3"],
  [-2, "2,3"],
  [-1, "15"],
  [0, "50"],
  [1, "85"],
  [2, "97,7"],
  [3, "≥ 97,7"],
];

const CATEGORIES: [number, number, string, string, string][] = [
  [DS_MIN, -2, COLORS.red, "Très faible", "#fff"],
  [-2, -1, COLORS.orange, "Faible", "#fff"],
  [-1, 1, COLORS.green, "Moyenne", "#fff"],
  [1, 2, COLORS.lightGreen, "Sup", "#31431f"],
  [2, DS_MAX, COLORS.pale, "Très supérieur", "#31431f"],
];

const BAND_Y = 372;
const BAND_H = 34;

export default function GaussianCurve() {
  return (
    <svg
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

      {/* Lignes verticales aux DS entiers */}
      {DS_TICKS.map((ds) => (
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
          fill={zoneColor(ds)}
        >
          {label}
        </text>
      ))}

      {/* Libellés de lignes (à gauche) */}
      <text x={6} y={315} fontSize={8.5} fontStyle="italic" fill="#444">
        Déviations Standards (DS)
      </text>
      <text x={6} y={337} fontSize={8.5} fontStyle="italic" fill="#444">
        Notes Standards (NS)
      </text>
      <text x={6} y={359} fontSize={8.5} fontStyle="italic" fill="#444">
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
          fill={zoneColor(ds)}
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
          fill={zoneColor((ns - 10) / 3)}
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
          fill={zoneColor(ds)}
        >
          {label}
        </text>
      ))}

      {/* Bande des catégories */}
      {CATEGORIES.map(([a, b, color, label, textColor], i) => {
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
              y={BAND_Y + BAND_H / 2 + 3.5}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fontStyle="italic"
              fill={textColor}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
