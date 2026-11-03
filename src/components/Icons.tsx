import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: "sm" | "xs" | "" };

function Svg({ size = "", className = "", children, ...rest }: P) {
  return (
    <svg className={`ico ${size} ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const IconMenu = (p: P) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h10" /></Svg>;
export const IconSearch = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></Svg>;
export const IconBag = (p: P) => <Svg {...p}><path d="M6 8h12l-1 12H7L6 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></Svg>;
export const IconClose = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IconStar = (p: P) => <Svg {...p}><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" /></Svg>;
export const IconChevronRight = (p: P) => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>;
export const IconChevronLeft = (p: P) => <Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>;
export const IconInstagram = (p: P) => <Svg {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17" cy="7" r=".8" /></Svg>;
export const IconWhatsApp = (p: P) => <Svg {...p}><path d="M4 20l1.3-3.8A8 8 0 1 1 8 19z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-2-2l.8-1-1-2z" /></Svg>;
export const IconChat = (p: P) => <Svg {...p}><path d="M4 20l1.3-3.8A8 8 0 1 1 8 19z" /></Svg>;
export const IconTruck = (p: P) => <Svg {...p}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></Svg>;
export const IconPin = (p: P) => <Svg {...p}><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="m5 12 4.5 4.5L19 7" /></Svg>;
export const IconMinus = (p: P) => <Svg {...p}><path d="M5 12h14" /></Svg>;
export const IconPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconLock = (p: P) => <Svg {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>;
export const IconAlert = (p: P) => <Svg {...p}><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17h.01" /></Svg>;
export const IconInfo = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>;
export const IconList = (p: P) => <Svg {...p}><rect x="4" y="3" width="17" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></Svg>;
export const IconPen = (p: P) => <Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /></Svg>;
export const IconCard = (p: P) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></Svg>;
export const IconUpload = (p: P) => <Svg {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></Svg>;
export const IconGift = (p: P) => <Svg {...p}><rect x="3.5" y="9" width="17" height="11.5" rx="1.5" /><path d="M2.5 9h19V6.5h-19zM12 6.5v14" /><path d="M12 6.5C10.5 3.5 7 3.5 7.5 5.5s4.5 1 4.5 1 4-1 4.5-1S13.5 3.5 12 6.5z" /></Svg>;
export const IconMail = (p: P) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Svg>;
export const IconBook = (p: P) => <Svg {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /><path d="M8 7h8M8 11h6" /></Svg>;
export const IconClock = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const IconPrint = (p: P) => <Svg {...p}><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></Svg>;
