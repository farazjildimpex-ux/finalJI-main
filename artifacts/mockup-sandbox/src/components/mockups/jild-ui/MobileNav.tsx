import { useState } from "react";
import {
  BookOpen, FileText, CreditCard, Users, MoreHorizontal,
  Bookmark, Zap, CalendarDays, Settings, X, ChevronRight,
  Bell, Plus, Hash, Image, MapPin, Tag, ChevronDown, Edit3,
  Package
} from "lucide-react";

const PRIMARY_TABS = [
  { name: "Journal",   icon: BookOpen,       path: "/journal" },
  { name: "Contracts", icon: FileText,        path: "/contracts" },
  { name: "Payments",  icon: CreditCard,      path: "/payments" },
  { name: "Contacts",  icon: Users,           path: "/contacts" },
  { name: "More",      icon: MoreHorizontal,  path: null },
];

const MORE_ITEMS = [
  { name: "Sample Book", icon: Package,     badge: null },
  { name: "Lead IQ",     icon: Zap,         badge: "3" },
  { name: "Letters",     icon: Bookmark,    badge: null },
  { name: "Calendar",    icon: CalendarDays,badge: null },
  { name: "Settings",    icon: Settings,    badge: null },
];

const JOURNAL_ENTRIES = [
  {
    id: 1,
    date: "Today, 10:42 AM",
    tags: ["Chennai Leather", "Contract"],
    content: "Spoke with Rajesh about the new vegetable-tanned shipment. He confirmed 1,200 sq ft ready by end of June. Need to chase the LC draft.",
    hasReminder: true,
    reminderTime: "3:00 PM",
    color: "border-l-blue-400",
  },
  {
    id: 2,
    date: "Today, 8:15 AM",
    tags: ["Milano Cuoio", "Payment"],
    content: "Wire of €18,400 still not reflected. Bank says T+2. Follow up tomorrow if still pending.",
    hasReminder: false,
    color: "border-l-amber-400",
  },
  {
    id: 3,
    date: "Yesterday, 5:30 PM",
    tags: ["Sample #SB-112"],
    content: "DHL tracking updated — package cleared customs in Frankfurt. Buyer notified via email.",
    hasReminder: false,
    color: "border-l-emerald-400",
  },
];

export function MobileNav() {
  const [active, setActive] = useState("Journal");
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="w-[390px] h-[844px] bg-gray-50 flex flex-col relative overflow-hidden font-sans">

      {/* Status bar */}
      <div className="h-11 bg-white flex items-center justify-between px-6 shrink-0">
        <span className="text-[13px] font-semibold text-gray-900">9:41</span>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-[3px] items-end h-3.5">
            {[3,5,7,9].map((h,i) => <div key={i} style={{height:h}} className="w-[3px] bg-gray-900 rounded-sm"/>)}
          </div>
          <svg width="16" height="12" viewBox="0 0 16 12" className="fill-gray-900">
            <rect x="0" y="4" width="16" height="8" rx="2"/>
            <rect x="2" y="6" width="12" height="4" rx="1" fill="white"/>
            <rect x="2" y="6" width="8" height="4" rx="1" fill="#22c55e"/>
            <rect x="13" y="5.5" width="2" height="3" rx="1"/>
          </svg>
        </div>
      </div>

      {/* Page header — branding in main content area */}
      <div className="bg-white border-b border-gray-100 px-4 pt-3 pb-3 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[18px] font-black text-gray-900 tracking-tight">JILD IMPEX</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Wednesday, 17 May 2026</p>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <button className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
            </button>
            <button className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-600 text-white">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── JOURNAL PAGE (default/active) ── */}
      {active === "Journal" && !showMore && (
        <div className="flex-1 overflow-y-auto">
          {/* Pinned write bar */}
          <div className="bg-white border-b border-gray-100 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Edit3 className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200">
                <p className="text-[12px] text-gray-400">What happened today? Add a note, tag a company…</p>
              </div>
            </div>
            <div className="flex gap-2 mt-2.5 pl-10">
              <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 text-[10px] font-semibold">
                <Tag className="w-3 h-3" /> Tag
              </button>
              <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 text-[10px] font-semibold">
                <Bell className="w-3 h-3" /> Reminder
              </button>
              <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 text-[10px] font-semibold">
                <Image className="w-3 h-3" /> Photo
              </button>
            </div>
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto no-scrollbar">
            {["All", "Today", "Tagged", "Reminders", "Contracts"].map((f, i) => (
              <button key={f} className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold border
                ${i===0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                {f}
              </button>
            ))}
          </div>

          {/* Journal entries */}
          <div className="px-4 pb-4 space-y-3">
            {JOURNAL_ENTRIES.map(entry => (
              <div key={entry.id} className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${entry.color} overflow-hidden`}>
                <div className="px-4 pt-3 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-[10px] text-gray-400 font-medium">{entry.date}</p>
                    {entry.hasReminder && (
                      <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full shrink-0">
                        <Bell className="w-2.5 h-2.5 text-amber-500" />
                        <span className="text-[9px] font-semibold text-amber-600">{entry.reminderTime}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[12.5px] text-gray-800 leading-relaxed">{entry.content}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {entry.tags.map(tag => (
                      <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-medium text-gray-500">
                        <Hash className="w-2.5 h-2.5" /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Recent across all types */}
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mt-1">Recent Activity</p>
            {[
              { type: "Contract", label: "C-2024-041", sub: "Chennai Leather Co. → Germany", icon: FileText, dot: "bg-blue-400" },
              { type: "Payment",  label: "DN-089",      sub: "€18,400 — Milano Cuoio SRL",    icon: CreditCard, dot: "bg-amber-400" },
              { type: "Sample",   label: "SB-112",      sub: "DHL • Delivered Frankfurt",      icon: Package, dot: "bg-emerald-400" },
              { type: "Contact",  label: "Rajesh Kumar", sub: "Chennai Leather Co.",            icon: Users, dot: "bg-purple-400" },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-100 flex items-center gap-3 px-4 py-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
                  <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">{item.type}: {item.label}</p>
                    <p className="text-[10.5px] text-gray-400 truncate">{item.sub}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── OTHER PAGES ── */}
      {active !== "Journal" && !showMore && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
            {(() => {
              const tab = PRIMARY_TABS.find(t => t.name === active);
              if (!tab) return null;
              const Icon = tab.icon;
              return <Icon className="w-6 h-6 text-gray-300" strokeWidth={1.5} />;
            })()}
          </div>
          <p className="text-[14px] font-semibold text-gray-300">{active}</p>
          <p className="text-[11px] text-gray-200 mt-1">Tap to navigate here</p>
        </div>
      )}

      {/* ── NEW BOTTOM NAV ── */}
      <nav className="shrink-0 bg-white border-t border-gray-100" style={{paddingBottom: 16}}>
        <div className="flex items-stretch h-14">
          {PRIMARY_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = active === tab.name && !showMore;
            const isMore = tab.name === "More";
            const isMoreActive = isMore && showMore;

            return (
              <button
                key={tab.name}
                onClick={() => {
                  if (isMore) { setShowMore(v => !v); }
                  else { setActive(tab.name); setShowMore(false); }
                }}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
              >
                {(isActive || isMoreActive) && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-blue-600 rounded-full" />
                )}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all
                  ${(isActive || isMoreActive) ? 'bg-blue-50' : ''}`}>
                  <Icon
                    className={`transition-colors ${(isActive || isMoreActive) ? 'text-blue-600' : 'text-gray-400'}`}
                    style={{ width: 18, height: 18 }}
                    strokeWidth={(isActive || isMoreActive) ? 2.5 : 1.75}
                  />
                </div>
                <span className={`text-[10px] font-semibold tracking-tight transition-colors
                  ${(isActive || isMoreActive) ? 'text-blue-600' : 'text-gray-400'}`}>
                  {tab.name}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* "More" slide-up drawer */}
      {showMore && (
        <>
          <div
            className="absolute inset-0 bg-black/20 z-10"
            onClick={() => setShowMore(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-2xl">
            {/* drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <p className="text-[15px] font-bold text-gray-900">More pages</p>
              <button onClick={() => setShowMore(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
            <div className="px-4 pb-8 space-y-1">
              {MORE_ITEMS.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => setShowMore(false)}
                    className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-gray-600" strokeWidth={1.75} />
                    </div>
                    <span className="flex-1 text-[14px] font-medium text-gray-800 text-left">{item.name}</span>
                    {item.badge && (
                      <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
