import { useState } from "react";
import {
  BookOpen, FileText, CreditCard, Users, MoreHorizontal,
  Bookmark, Zap, CalendarDays, Settings, X, ChevronRight,
  Bell, Plus, Search, Edit3, Hash, Clock, ChevronLeft, ChevronDown,
} from "lucide-react";

const PRIMARY_TABS = [
  { name: "Journal",   icon: BookOpen       },
  { name: "Contracts", icon: FileText       },
  { name: "Payments",  icon: CreditCard     },
  { name: "Contacts",  icon: Users          },
  { name: "More",      icon: MoreHorizontal },
];

const MORE_ITEMS = [
  { name: "Letters",  icon: Bookmark,     badge: null },
  { name: "Lead IQ",  icon: Zap,          badge: "3"  },
  { name: "Calendar", icon: CalendarDays, badge: null },
  { name: "Settings", icon: Settings,     badge: null },
];

const ENTRIES = [
  {
    id: 1, title: "LC draft — Chennai Leather",
    time: "10:42 AM", tags: ["Chennai Leather", "Contract"],
    body: "Spoke with Rajesh about the new vegetable-tanned shipment. He confirmed 1,200 sq ft ready by end of June. Need to chase the LC draft.",
    reminder: "3:00 PM", color: "bg-indigo-500",
  },
  {
    id: 2, title: "Wire transfer follow-up",
    time: "8:15 AM", tags: ["Milano Cuoio", "Payment"],
    body: "Wire of €18,400 still not reflected. Bank says T+2. Follow up tomorrow if still pending.",
    reminder: null, color: "bg-amber-400",
  },
  {
    id: 3, title: "SB-112 cleared Frankfurt",
    time: "Yesterday", tags: ["Sample"],
    body: "DHL tracking updated — package cleared customs in Frankfurt. Buyer notified via email.",
    reminder: null, color: "bg-emerald-500",
  },
  {
    id: 4, title: "New enquiry — Italian tannery",
    time: "Mon", tags: ["Lead"],
    body: "Received enquiry from Conceria Walpier for full-grain veg-tan. Sent catalogue.",
    reminder: null, color: "bg-blue-400",
  },
];

const RECENT = [
  { icon: FileText,  num: "C-2024-041", sub: "Chennai Leather Co.",  bg: "bg-indigo-50", fg: "text-indigo-600" },
  { icon: CreditCard, num: "DN-089",    sub: "€18,400 · Milano Cuoio", bg: "bg-emerald-50", fg: "text-emerald-600" },
  { icon: Bookmark,  num: "SB-112",     sub: "DHL · Frankfurt",        bg: "bg-blue-50", fg: "text-blue-600" },
];

export function MobileRevamp() {
  const [active, setActive] = useState("Journal");
  const [showMore, setShowMore] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? ENTRIES.filter(e => e.title.toLowerCase().includes(search.toLowerCase()) || e.body.toLowerCase().includes(search.toLowerCase()) || e.tags.some(t => t.toLowerCase().includes(search.toLowerCase())))
    : ENTRIES;

  return (
    <div className="w-[390px] h-[844px] bg-[#f2f2f7] flex flex-col relative overflow-hidden font-sans select-none">

      {/* Status bar */}
      <div className="h-12 bg-white flex items-center justify-between px-5 shrink-0">
        <span className="text-[15px] font-semibold text-gray-900">9:41</span>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-[2px] items-end h-3.5">
            {[4,6,9,11].map((h,i) => <div key={i} style={{height:h}} className="w-[3px] bg-gray-900 rounded-[1px]" />)}
          </div>
          <svg width="16" height="12" viewBox="0 0 24 12" className="fill-gray-900">
            <path d="M1 3.5A3.5 3.5 0 014.5 0h13A3.5 3.5 0 0121 3.5v5A3.5 3.5 0 0117.5 12h-13A3.5 3.5 0 011 8.5v-5zm1.5 0v5A2 2 0 004.5 10.5h13A2 2 0 0019.5 8.5v-5A2 2 0 0017.5 2h-13A2 2 0 002.5 3.5z" opacity=".35"/>
            <path d="M4 4a1 1 0 011-1h9a1 1 0 010 2H5a1 1 0 01-1-1z" transform="translate(0 1.5)" />
            <path d="M21 5v4a2 2 0 000-4z" opacity=".4"/>
          </svg>
        </div>
      </div>

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3 shrink-0 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
        {/* Top row */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[22px] font-black leading-tight tracking-tight">
              <span className="text-blue-600">JILD</span>
              <span className="text-gray-900"> IMPEX</span>
            </p>
            <p className="text-[12px] text-gray-400 mt-0.5 font-medium">Good morning · Wednesday, 17 May</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative w-9 h-9 rounded-xl flex items-center justify-center bg-gray-100 text-gray-600">
              <Bell className="w-4.5 h-4.5" style={{width:18,height:18}} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            </button>
            <button className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-600 text-white shadow-sm">
              <Plus style={{width:18,height:18}} />
            </button>
          </div>
        </div>

        {/* Search bar — always visible */}
        <div className="flex items-center gap-2.5 bg-gray-100 rounded-xl px-3.5 h-10">
          <Search className="text-gray-400 shrink-0" style={{width:15,height:15}} />
          <input
            className="flex-1 bg-transparent text-[14px] text-gray-800 placeholder-gray-400 outline-none"
            placeholder="Search journals, contracts, contacts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-gray-400">
              <X style={{width:14,height:14}} />
            </button>
          )}
        </div>
      </div>

      {/* ── Journal page ── */}
      {active === "Journal" && !showMore && (
        <div className="flex-1 overflow-y-auto">

          {/* Date nav */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 shrink-0">
              <ChevronLeft style={{width:14,height:14}} />
            </button>
            <button className="flex-1 h-8 flex items-center justify-center gap-1.5 bg-white border border-gray-200 rounded-xl text-[12px] font-semibold text-gray-700">
              Wednesday, 17 May 2026
              <ChevronDown style={{width:12,height:12}} className="text-gray-400" />
            </button>
            <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 shrink-0">
              <ChevronRight style={{width:14,height:14}} />
            </button>
          </div>

          {/* Quick compose */}
          <div className="mx-4 mt-2 mb-3">
            <button className="w-full flex items-center gap-3 bg-white rounded-2xl border border-dashed border-blue-200 px-4 py-3 text-left shadow-sm">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <Edit3 style={{width:13,height:13}} className="text-white" />
              </div>
              <span className="text-[13px] text-gray-400">Write today's note…</span>
              <div className="ml-auto px-3 py-1 bg-blue-600 rounded-lg text-white text-[11px] font-bold shrink-0">
                + Entry
              </div>
            </button>
          </div>

          {/* Entry list */}
          <div className="px-4 space-y-2.5 pb-4">
            {search.trim() && filtered.length === 0 && (
              <p className="text-center text-[13px] text-gray-400 py-6">No results for "{search}"</p>
            )}
            {filtered.map(entry => (
              <div key={entry.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                <div className={`h-[3px] ${entry.color}`} />
                <div className="px-4 pt-3 pb-3.5">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="flex-1">
                      <p className="text-[15px] font-bold text-gray-900 leading-snug">{entry.title}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      {entry.reminder && (
                        <span className="flex items-center gap-0.5 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                          <Clock style={{width:9,height:9}} className="text-amber-500" />
                          <span className="text-[9px] font-bold text-amber-600">{entry.reminder}</span>
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400 font-medium">{entry.time}</span>
                    </div>
                  </div>
                  <p className="text-[13px] text-gray-600 leading-relaxed line-clamp-3">{entry.body}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {entry.tags.map(tag => (
                      <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-md text-[10px] font-semibold text-gray-500">
                        <Hash style={{width:9,height:9}} /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Recent Activity */}
            {!search.trim() && (
              <>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pt-1 pb-0.5">Recent Activity</p>
                {RECENT.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 flex items-center gap-3 px-3.5 py-3 shadow-sm">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.bg}`}>
                        <Icon className={item.fg} style={{width:17,height:17}} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-gray-900">{item.num}</p>
                        <p className="text-[11px] text-gray-400 truncate">{item.sub}</p>
                      </div>
                      <ChevronRight style={{width:15,height:15}} className="text-gray-300 shrink-0" />
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Other pages ── */}
      {active !== "Journal" && !showMore && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
          <div className="w-16 h-16 rounded-3xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
            {(() => { const t = PRIMARY_TABS.find(t => t.name === active); if (!t) return null; const I = t.icon; return <I className="text-blue-600" style={{width:26,height:26}} strokeWidth={1.75} />; })()}
          </div>
          <div>
            <p className="text-[16px] font-bold text-gray-800">{active}</p>
            <p className="text-[12px] text-gray-400 mt-1">Full view available in the app</p>
          </div>
        </div>
      )}

      {/* ── Bottom nav ── */}
      <nav className="shrink-0 bg-white border-t border-gray-100 z-20" style={{paddingBottom: 24}}>
        <div className="flex items-stretch h-[54px]">
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
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? 'bg-blue-50' : ''}`}>
                  <Icon
                    className={isActive ? 'text-blue-600' : 'text-gray-400'}
                    style={{width: 19, height: 19}}
                    strokeWidth={isActive ? 2.5 : 1.75}
                  />
                </div>
                <span className={`text-[10px] font-semibold ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
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
          <div className="absolute inset-0 bg-black/30 z-30" onClick={() => setShowMore(false)} />
          <div className="absolute bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl" style={{paddingBottom: 40}}>
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3">
              <p className="text-[17px] font-bold text-gray-900">More</p>
              <button onClick={() => setShowMore(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                <X style={{width:14,height:14}} className="text-gray-500" />
              </button>
            </div>
            <div className="px-4 space-y-1">
              {MORE_ITEMS.map(item => {
                const Icon = item.icon;
                return (
                  <button key={item.name} onClick={() => setShowMore(false)}
                    className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <Icon style={{width:18,height:18}} className="text-gray-700" strokeWidth={1.75} />
                    </div>
                    <span className="flex-1 text-[15px] font-semibold text-gray-800 text-left">{item.name}</span>
                    {item.badge && (
                      <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{item.badge}</span>
                    )}
                    <ChevronRight style={{width:16,height:16}} className="text-gray-300" />
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
