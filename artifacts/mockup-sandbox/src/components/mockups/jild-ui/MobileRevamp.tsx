import { useState } from "react";
import {
  BookOpen, FileText, CreditCard, Users, MoreHorizontal,
  Bookmark, Zap, CalendarDays, Settings, X, ChevronRight,
  Bell, Plus, Search, Edit3, Hash, Clock, ChevronLeft,
  ChevronDown, Package,
} from "lucide-react";

const PRIMARY_TABS = [
  { name: "Journal",   icon: BookOpen      },
  { name: "Contracts", icon: FileText      },
  { name: "Payments",  icon: CreditCard    },
  { name: "Contacts",  icon: Users         },
  { name: "More",      icon: MoreHorizontal },
];

const MORE_ITEMS = [
  { name: "Letters",  icon: Bookmark,     badge: null },
  { name: "Lead IQ",  icon: Zap,          badge: "3"  },
  { name: "Calendar", icon: CalendarDays, badge: null },
  { name: "Settings", icon: Settings,     badge: null },
];

const JOURNAL_ENTRIES = [
  {
    id: 1,
    title: "LC draft — Chennai Leather Co.",
    time: "10:42 AM",
    tags: ["Chennai Leather", "Contract"],
    content: "Spoke with Rajesh about the new vegetable-tanned shipment. He confirmed 1,200 sq ft ready by end of June. Need to chase the LC draft by Friday.",
    reminder: "3:00 PM",
    accent: "bg-blue-500",
  },
  {
    id: 2,
    title: "Wire transfer follow-up",
    time: "8:15 AM",
    tags: ["Milano Cuoio", "Payment"],
    content: "Wire of €18,400 still not reflected. Bank says T+2. Follow up tomorrow if still pending.",
    reminder: null,
    accent: "bg-amber-400",
  },
  {
    id: 3,
    title: "Sample cleared Frankfurt customs",
    time: "Yesterday",
    tags: ["SB-112"],
    content: "DHL tracking updated — package cleared customs in Frankfurt. Buyer notified via email.",
    reminder: null,
    accent: "bg-emerald-500",
  },
];

const RECENT = [
  { icon: FileText,  num: "C-2024-041", sub: "Chennai Leather Co.",  color: "text-indigo-500 bg-indigo-50"  },
  { icon: CreditCard, num: "DN-089",    sub: "€18,400 · Milano Cuoio", color: "text-emerald-600 bg-emerald-50" },
  { icon: Bookmark,  num: "SB-112",     sub: "DHL · Frankfurt",        color: "text-blue-500 bg-blue-50"      },
];

export function MobileRevamp() {
  const [active, setActive] = useState("Journal");
  const [showMore, setShowMore] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="w-[390px] h-[844px] bg-[#f5f5f7] flex flex-col relative overflow-hidden font-sans select-none">

      {/* ── Status bar ── */}
      <div className="h-11 bg-white flex items-center justify-between px-5 shrink-0 z-10">
        <span className="text-[13px] font-bold text-gray-900">9:41</span>
        <div className="flex items-center gap-1.5">
          {/* Signal bars */}
          <div className="flex gap-[2.5px] items-end h-3">
            {[4,6,8,10].map((h,i) => (
              <div key={i} style={{height:h}} className="w-[3px] bg-gray-900 rounded-sm" />
            ))}
          </div>
          {/* Wifi */}
          <svg width="14" height="11" viewBox="0 0 14 11" className="fill-gray-900">
            <path d="M7 8.5a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5z"/>
            <path d="M7 5.5C5.2 5.5 3.6 6.3 2.5 7.5l1.1 1.1A4.6 4.6 0 017 7a4.6 4.6 0 013.4 1.6l1.1-1.1C10.4 6.3 8.8 5.5 7 5.5z" opacity=".7"/>
            <path d="M7 2.5C4.1 2.5 1.5 3.8 0 5.8l1.1 1.1C2.7 5 4.7 4 7 4s4.3 1 5.9 2.9L14 5.8C12.5 3.8 9.9 2.5 7 2.5z" opacity=".4"/>
          </svg>
          {/* Battery */}
          <div className="flex items-center">
            <div className="w-6 h-3 rounded-sm border border-gray-900 relative flex items-center pl-0.5">
              <div className="h-2 w-4 bg-gray-900 rounded-[1px]" />
            </div>
            <div className="w-0.5 h-1.5 bg-gray-900 rounded-r-sm ml-0.5" />
          </div>
        </div>
      </div>

      {/* ── Page header ── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-3 pb-3 shrink-0 z-10">
        {showSearch ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 h-9">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-[13px] text-gray-400">Search journals, contracts…</span>
            </div>
            <button onClick={() => setShowSearch(false)} className="text-[13px] font-semibold text-blue-600">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[20px] font-black text-gray-900 tracking-tight leading-tight">
                <span className="text-blue-600">JILD</span> IMPEX
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Good morning · Wed, 17 May 2026</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowSearch(true)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100"
              >
                <Search className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 relative">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-[1.5px] border-white" />
              </button>
              <button className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-600 text-white shadow-sm">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Journal page ── */}
      {active === "Journal" && !showMore && (
        <div className="flex-1 overflow-y-auto">

          {/* Quick write bar */}
          <div className="mx-4 mt-3 mb-2 bg-white rounded-2xl border border-gray-200 shadow-sm px-3.5 py-3 flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <Edit3 className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-[13px] text-gray-400 flex-1">Write today's note…</p>
            <div className="flex items-center gap-1.5">
              <button className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-bold">
                + Entry
              </button>
            </div>
          </div>

          {/* Date nav */}
          <div className="flex items-center px-4 py-2 gap-2">
            <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button className="flex-1 flex items-center justify-center gap-1.5 h-7 bg-white border border-gray-200 rounded-lg">
              <span className="text-[12px] font-semibold text-gray-800">Wednesday, 17 May 2026</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
            <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Journal entries */}
          <div className="px-4 pb-2 space-y-2.5">
            {JOURNAL_ENTRIES.map(entry => (
              <div key={entry.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                {/* Accent bar */}
                <div className={`h-0.5 w-full ${entry.accent}`} />
                <div className="px-4 pt-3 pb-3.5">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-[14px] font-bold text-gray-900 leading-tight flex-1">{entry.title}</h3>
                    <div className="flex items-center gap-1 shrink-0">
                      {entry.reminder && (
                        <span className="flex items-center gap-0.5 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                          <Clock className="w-2.5 h-2.5 text-amber-500" />
                          <span className="text-[9px] font-bold text-amber-600">{entry.reminder}</span>
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 font-medium">{entry.time}</span>
                    </div>
                  </div>
                  <p className="text-[12.5px] text-gray-600 leading-relaxed line-clamp-3">{entry.content}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {entry.tags.map(tag => (
                      <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-medium text-gray-500">
                        <Hash className="w-2.5 h-2.5" />{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div className="px-4 pb-6">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 mt-1">Recent Activity</p>
            <div className="space-y-2">
              {RECENT.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 flex items-center gap-3 px-3.5 py-3 shadow-sm">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.color}`}>
                      <Icon className="w-4 h-4" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-900">{item.num}</p>
                      <p className="text-[11px] text-gray-400 truncate">{item.sub}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Other pages placeholder ── */}
      {active !== "Journal" && !showMore && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
            {(() => { const tab = PRIMARY_TABS.find(t => t.name === active); if (!tab) return null; const Icon = tab.icon; return <Icon className="w-6 h-6 text-blue-600" strokeWidth={1.75} />; })()}
          </div>
          <p className="text-[15px] font-bold text-gray-700">{active}</p>
          <p className="text-[12px] text-gray-400">This section is fully built in the app</p>
        </div>
      )}

      {/* ── Bottom nav ── */}
      <nav className="shrink-0 bg-white border-t border-gray-100 z-20" style={{ paddingBottom: 20 }}>
        <div className="flex items-stretch h-14">
          {PRIMARY_TABS.map(tab => {
            const Icon = tab.icon;
            const isMore = tab.name === "More";
            const isActive = isMore ? showMore : (active === tab.name && !showMore);

            return (
              <button
                key={tab.name}
                onClick={() => { if (isMore) setShowMore(v => !v); else { setActive(tab.name); setShowMore(false); } }}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-blue-600 rounded-b-full" />
                )}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isActive ? 'bg-blue-50' : ''}`}>
                  <Icon
                    className={`transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
                    style={{ width: 19, height: 19 }}
                    strokeWidth={isActive ? 2.5 : 1.75}
                  />
                </div>
                <span className={`text-[10px] font-semibold tracking-tight ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                  {tab.name}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── More drawer ── */}
      {showMore && (
        <>
          <div className="absolute inset-0 bg-black/25 z-30" onClick={() => setShowMore(false)} />
          <div className="absolute bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl" style={{ paddingBottom: 34 }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <p className="text-[16px] font-bold text-gray-900">More</p>
              <button onClick={() => setShowMore(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
            <div className="px-4 pb-2 space-y-1">
              {MORE_ITEMS.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => setShowMore(false)}
                    className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-gray-700" strokeWidth={1.75} />
                    </div>
                    <span className="flex-1 text-[14px] font-semibold text-gray-800 text-left">{item.name}</span>
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
