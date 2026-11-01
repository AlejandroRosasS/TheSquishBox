import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: "sm" | "" };

function Svg({ size = "", className = "", children, ...rest }: P) {
  return (
    <svg className={`ico ${size} ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

/* Íconos del panel (tomados de las pantallas A-*). */
export const AIHome = (p: P) => <Svg {...p}><path d="M4 11 12 4l8 7v9H4z" /><path d="M10 20v-6h4v6" /></Svg>;
export const AIOrders = (p: P) => <Svg {...p}><path d="M4 4h16v16H4z" /><path d="M4 14h5l1 2h4l1-2h5" /></Svg>;
export const AIGift = (p: P) => <Svg {...p}><path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13" /><path d="M12 7C10 3 6.5 4 7.5 7M12 7c2-4 5.5-3 4.5 0" /></Svg>;
export const AIBox = (p: P) => <Svg {...p}><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4M12 11v10" /></Svg>;
export const AIInstagram = (p: P) => <Svg {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17" cy="7" r=".8" /></Svg>;
export const AIChart = (p: P) => <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>;
export const AIBell = (p: P) => <Svg {...p}><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></Svg>;
export const AISettings = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></Svg>;
export const AIPalette = (p: P) => <Svg {...p}><path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-1-.8-1.3-.8-2.2 0-.8.7-1.3 1.5-1.3H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="15" cy="7" r="1" /></Svg>;
export const AIText = (p: P) => <Svg {...p}><path d="M5 6V4h14v2M12 4v16M9 20h6" /></Svg>;
export const AISearch = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></Svg>;
export const AIGlobe = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></Svg>;
export const AIMore = (p: P) => <Svg {...p}><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></Svg>;
export const AIBack = (p: P) => <Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>;
export const AIChevron = (p: P) => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>;
export const AIUp = (p: P) => <Svg {...p}><path d="m6 15 6-6 6 6" /></Svg>;
export const AIDown = (p: P) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>;
export const AISparkle = (p: P) => <Svg {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></Svg>;
export const AICheck = (p: P) => <Svg {...p}><path d="m5 12 4.5 4.5L19 7" /></Svg>;
export const AIAlert = (p: P) => <Svg {...p}><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17h.01" /></Svg>;
export const AIInfo = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>;
export const AILink = (p: P) => <Svg {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Svg>;
export const AIRefresh = (p: P) => <Svg {...p}><path d="M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2" /><path d="M20 4v5h-5M4 20v-5h5" /></Svg>;
export const AIWhatsApp = (p: P) => <Svg {...p}><path d="M4 20l1.3-3.8A8 8 0 1 1 8 19z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-2-2l.8-1-1-2z" /></Svg>;
export const AIMail = (p: P) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Svg>;
export const AICard = (p: P) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></Svg>;
export const AITelegram = (p: P) => <Svg {...p}><path d="M21 4 3 11l6 2 2 6 3-4 5 4z" /><path d="m9 13 8-6" /></Svg>;
export const AIEye = (p: P) => <Svg {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>;
export const AIClose = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const AIUndo = (p: P) => <Svg {...p}><path d="M4 10h11a5 5 0 0 1 0 10H9" /><path d="m8 6-4 4 4 4" /></Svg>;
export const AIPlay = (p: P) => <Svg {...p} style={{ fill: "currentColor", stroke: "none" }}><path d="M8 5v14l11-7z" /></Svg>;
export const AIGrip = (p: P) => <Svg {...p}><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></Svg>;
export const AIPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const AITrash = (p: P) => <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>;
export const AIImage = (p: P) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></Svg>;
export const AICrop = (p: P) => <Svg {...p}><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" /></Svg>;
export const AIUpload = (p: P) => <Svg {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v4h16v-4" /></Svg>;
