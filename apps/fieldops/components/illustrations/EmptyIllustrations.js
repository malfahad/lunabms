import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "../../theme/tokens";

const p = colors.primary;
const pc = colors.primaryContainer;
const soft = colors.surfaceContainerHighest;
const line = colors.outlineVariant;

/** @param {{ width?: number }} props */
export function IllustrationPipeline({ width = 200 }) {
  const h = (width * 74) / 100;
  return (
    <Svg width={width} height={h} viewBox="0 0 200 148" accessibilityRole="image">
      <Rect x="14" y="86" width="46" height="50" rx="12" fill={pc} opacity={0.35} />
      <Rect x="77" y="56" width="46" height="80" rx="12" fill={p} opacity={0.22} />
      <Rect x="140" y="26" width="46" height="110" rx="12" fill={pc} opacity={0.55} />
      <Path d="M92 8 L118 34 H104 V96 H88 V34 H74 Z" fill={p} />
      <Circle cx="100" cy="118" r="4" fill={p} opacity={0.5} />
    </Svg>
  );
}

/** @param {{ width?: number }} props */
export function IllustrationProjects({ width = 200 }) {
  const h = (width * 74) / 100;
  return (
    <Svg width={width} height={h} viewBox="0 0 200 148" accessibilityRole="image">
      <Rect x="36" y="28" width="128" height="100" rx="14" fill={soft} stroke={line} strokeWidth={2} />
      <Rect x="52" y="48" width="96" height="8" rx="3" fill={pc} opacity={0.6} />
      <Rect x="52" y="66" width="72" height="8" rx={3} fill={p} opacity={0.2} />
      <Rect x="52" y="84" width="84" height={8} rx={3} fill={p} opacity={0.15} />
      <Path d="M52 108h56" stroke={p} strokeWidth={3} strokeLinecap="round" opacity={0.45} />
      <Circle cx="158" cy="42" r="18" fill={pc} />
      <Path
        d="M152 42l6 6 12-14"
        stroke={p}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** @param {{ width?: number }} props */
export function IllustrationUpdates({ width = 200 }) {
  const h = (width * 74) / 100;
  return (
    <Svg width={width} height={h} viewBox="0 0 200 148" accessibilityRole="image">
      <Path
        d="M28 38c0-8 6-14 14-14h72c8 0 14 6 14 14v36c0 8-6 14-14 14H70l-18 16V88H42c-8 0-14-6-14-14V38z"
        fill={soft}
        stroke={line}
        strokeWidth={2}
      />
      <Path
        d="M88 24h70c8 0 14 6 14 14v40c0 8-6 14-14 14h-16l-14 12V92H88c-8 0-14-6-14-14V38c0-8 6-14 14-14z"
        fill={pc}
        fillOpacity={0.4}
        stroke={p}
        strokeWidth={1.5}
        strokeOpacity={0.35}
      />
      <Rect x="48" y="52" width="40" height={6} rx={2} fill={p} opacity={0.35} />
      <Rect x="48" y="64" width="28" height={6} rx={2} fill={p} opacity={0.22} />
      <Rect x="112" y="44" width="48" height={6} rx={2} fill={p} opacity={0.3} />
    </Svg>
  );
}

/** @param {{ width?: number }} props */
export function IllustrationFinance({ width = 200 }) {
  const h = (width * 74) / 100;
  return (
    <Svg width={width} height={h} viewBox="0 0 200 148" accessibilityRole="image">
      <Rect x="40" y="24" width="120" height="96" rx="12" fill={soft} stroke={line} strokeWidth={2} />
      <Rect x="56" y="40" width="88" height="10" rx={3} fill={pc} opacity={0.5} />
      <Rect x="56" y="58" width="64" height={8} rx={2} fill={p} opacity={0.18} />
      <Rect x="56" y="74" width="72" height={8} rx={2} fill={p} opacity={0.14} />
      <Rect x="56" y="90" width="48" height={8} rx={2} fill={p} opacity={0.12} />
      <Circle cx="100" cy="118" r="22" fill={pc} opacity={0.5} />
      <Path
        d="M94 108c0-4 3-6 6-6s6 2 6 6-3 8-6 10c-3-2-6-6-6-10zm6-14v6"
        stroke={p}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** @param {{ width?: number }} props */
export function IllustrationContacts({ width = 200 }) {
  const h = (width * 74) / 100;
  return (
    <Svg width={width} height={h} viewBox="0 0 200 148" accessibilityRole="image">
      <Circle cx="72" cy="52" r="22" fill={pc} opacity={0.55} />
      <Path d="M42 124c0-18 14-32 32-32h-4c-18 0-32 14-32 32v4h36v-4z" fill={pc} opacity={0.4} />
      <Circle cx="136" cy="44" r="26" fill={p} opacity={0.2} />
      <Path d="M98 128c0-22 18-40 40-40s40 18 40 40v4H98v-4z" fill={p} opacity={0.15} />
      <Rect x="118" y="96" width="64" height="8" rx={3} fill={line} opacity={0.5} />
    </Svg>
  );
}

/** @param {{ width?: number }} props */
export function IllustrationTeam({ width = 200 }) {
  const h = (width * 74) / 100;
  return (
    <Svg width={width} height={h} viewBox="0 0 200 148" accessibilityRole="image">
      <Circle cx="56" cy="56" r="18" fill={pc} opacity={0.5} />
      <Path d="M32 118c0-14 11-26 24-26s24 12 24 26v6H32v-6z" fill={pc} opacity={0.35} />
      <Circle cx="100" cy="48" r="22" fill={p} opacity={0.25} />
      <Path d="M72 120c0-16 13-30 28-30s28 14 28 30v8H72v-8z" fill={p} opacity={0.2} />
      <Circle cx="144" cy="56" r="18" fill={pc} opacity={0.45} />
      <Path d="M120 118c0-14 11-26 24-26s24 12 24 26v6h-48v-6z" fill={pc} opacity={0.32} />
    </Svg>
  );
}

/** @param {{ width?: number }} props */
export function IllustrationRetainers({ width = 200 }) {
  const h = (width * 74) / 100;
  return (
    <Svg width={width} height={h} viewBox="0 0 200 148" accessibilityRole="image">
      <Rect x="52" y="36" width="96" height="88" rx="14" fill={soft} stroke={line} strokeWidth={2} />
      <Circle cx="100" cy="68" r="22" fill={pc} opacity={0.55} />
      <Rect x="86" y="62" width="28" height="20" rx={4} fill={p} opacity={0.35} />
      <Path d="M94 72h12M100 66v12" stroke={p} strokeWidth={2.5} strokeLinecap="round" />
      <Rect x="64" y="102" width="72" height={8} rx={3} fill={pc} opacity={0.45} />
      <Rect x="72" y="114" width="56" height={6} rx={2} fill={p} opacity={0.15} />
    </Svg>
  );
}

/** @param {{ width?: number }} props */
export function IllustrationReports({ width = 200 }) {
  const h = (width * 74) / 100;
  return (
    <Svg width={width} height={h} viewBox="0 0 200 148" accessibilityRole="image">
      <Rect x="32" y="88" width="28" height="48" rx={6} fill={pc} opacity={0.45} />
      <Rect x="70" y="64" width="28" height="72" rx={6} fill={p} opacity={0.28} />
      <Rect x="108" y="76" width="28" height="60" rx={6} fill={pc} opacity={0.6} />
      <Rect x="146" y="52" width="28" height="84" rx={6} fill={p} opacity={0.38} />
      <Path d="M24 32h152" stroke={line} strokeWidth={2} strokeLinecap="round" />
      <Path d="M44 24v16M156 24v16" stroke={p} strokeWidth={2} strokeLinecap="round" opacity={0.4} />
    </Svg>
  );
}

/** @param {{ width?: number }} props */
export function IllustrationGeneric({ width = 200 }) {
  const h = (width * 74) / 100;
  return (
    <Svg width={width} height={h} viewBox="0 0 200 148" accessibilityRole="image">
      <Rect x="48" y="32" width="104" height="88" rx="16" fill={soft} stroke={line} strokeWidth={2} />
      <Path d="M72 58h56M72 76h44M72 94h52" stroke={pc} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
      <Circle cx="100" cy="118" r="8" fill={p} opacity={0.25} />
    </Svg>
  );
}

const MAP = {
  pipeline: IllustrationPipeline,
  projects: IllustrationProjects,
  updates: IllustrationUpdates,
  finance: IllustrationFinance,
  contacts: IllustrationContacts,
  team: IllustrationTeam,
  retainers: IllustrationRetainers,
  reports: IllustrationReports,
  generic: IllustrationGeneric,
};

/**
 * @param {{ variant?: keyof typeof MAP; width?: number }} props
 */
export function EmptyIllustration({ variant = "generic", width = 200 }) {
  const Cmp = MAP[variant] ?? IllustrationGeneric;
  return <Cmp width={width} />;
}
