import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

export function WelcomeIllustration({ width = 320, height = 220 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 320 220" fill="none">
      <Defs>
        <LinearGradient id="bgGrad" x1="22" y1="18" x2="285" y2="200" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#b6ebfd" />
          <Stop offset="1" stopColor="#cfe3eb" />
        </LinearGradient>
        <LinearGradient id="cardGrad" x1="80" y1="54" x2="233" y2="184" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#ffffff" />
          <Stop offset="1" stopColor="#eff4ff" />
        </LinearGradient>
      </Defs>

      <Rect x="12" y="16" width="296" height="188" rx="28" fill="url(#bgGrad)" />
      <Circle cx="67" cy="58" r="18" fill="#0e4b5a" opacity="0.18" />
      <Circle cx="262" cy="162" r="22" fill="#00333f" opacity="0.1" />

      <Rect x="78" y="46" width="164" height="128" rx="18" fill="url(#cardGrad)" />
      <Rect x="100" y="72" width="120" height="12" rx="6" fill="#d6e3fb" />
      <Rect x="100" y="96" width="76" height="10" rx="5" fill="#c0c8cb" />
      <Rect x="100" y="116" width="96" height="10" rx="5" fill="#c0c8cb" />
      <Rect x="100" y="140" width="94" height="18" rx="9" fill="#00333f" />

      <Path
        d="M246 56L266 78L233 78C227 78 222 73 222 67V44L246 56Z"
        fill="#0e4b5a"
        opacity="0.24"
      />
    </Svg>
  );
}
