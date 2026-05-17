import { useState } from "react";
import {
  BookOpen, FileText, CreditCard, Users, MoreHorizontal,
  Bell, Plus, Search, ChevronLeft, ChevronRight, X,
  Bookmark, Zap, CalendarDays, Settings, ChevronRight as Chevron,
  Clock, CheckCircle2, AlertCircle, Circle,
} from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "journal",   label: "Journal",   Icon: BookOpen       },
  { id: "contracts", label: "Contracts", Icon: FileText       },
  { id: "payments",  label: "Payments",  Icon: CreditCard     },
  { id: "contacts",  label: "Contacts",  Icon: Users          },
  { id: "more",      label: "More",      Icon: MoreHorizontal },
];

const MORE_ITEMS = [
  { label: "Letters",  Icon: Bookmark,     badge: null, color: "bg-sky-100 text-sky-600"    },
  { label: "Lead IQ",  Icon: Zap,          badge: "3",  color: "bg-violet-100 text-violet-600" },
  { label: "Calendar", Icon: CalendarDays, badge: null, color: "bg-rose-100 text-rose-600"   },
  { label: "Settings", Icon: Settings,     badge: null, color: "bg-gray-100 text-gray-600"   },
];

const STATUS: Record<string, { label: string; bg: string; text: string; Icon: any }> = {
  issued:    { label: "Issued",    bg: "bg-blue-100",   text: "text-blue-700",   Icon: Circle        },
  inspected: { label: "Inspected", bg: "bg-amber-100",  text: "text-amber-700",  Icon: AlertCircle   },
  completed: { label: "Completed", bg: "bg-green-100",  text: "text-green-700",  Icon: CheckCircle2  },
  pending:   { label: "Pending",   bg: "bg-orange-100", text: "text-orange-700", Icon: Clock         },
};

const ENTRIES = [
  { id: 1, title: "LC draft — Chennai Leather",  time: "10:42 AM", accent: "#6366f1",
    body: "Spoke with Rajesh re: vegetable-tanned shipment. 1,200 sq ft ready end of June. Chase the LC draft.",
    tags: ["Chennai Leather", "Contract"] },
  { id: 2, title: "Wire transfer follow-up",      time: "8:15 AM",  accent: "#f59e0b",
    body: "Wire of €18,400 not reflected. Bank says T+2. Follow up tomorrow if still pending.",
    tags: ["Milano Cuoio", "Payment"] },
  { id: 3, title: "SB-112 cleared Frankfurt",     time: "Yesterday",accent: "#10b981",
    body: "DHL tracking updated — package cleared Frankfurt customs. Buyer notified.",
    tags: ["Sample"] },
  { id: 4, title: "Walpier enquiry — veg-tan",    time: "Mon",      accent: "#3b82f6",
    body: "Enquiry from Conceria Walpier for full-grain veg-tan. Catalogue sent.",
    tags: ["Lead"] },
];

const CONTRACTS = [
  { num: "C-2024-041", supplier: "Chennai Leather Co.", status: "inspected", date: "12 May" },
  { num: "C-2024-039", supplier: "Gruppo Mastrotto",    status: "completed", date: "2 May"  },
  { num: "C-2024-038", supplier: "Walpier SRL",         status: "issued",    date: "28 Apr" },
];

const PAYMENTS = [
  { num: "DN-089", name: "Milano Cuoio",       amount: "€18,400", status: "pending",   date: "15 May" },
  { num: "DN-087", name: "Chennai Leather",    amount: "₹4,20,000", status: "completed", date: "1 May"  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function MobileRevamp() {
  const [activeTab, setActiveTab] = useState("journal");
  const [showMore, setShowMore]   = useState(false);
  const [search, setSearch]       = useState("");
  const [searching, setSearching] = useState(false);

  const filteredEntries = search.trim()
    ? ENTRIES.filter(e =>
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        e.body.toLowerCase().includes(search.toLowerCase()) ||
        e.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
      )
    : ENTRIES;

  return (
    <div className="w-[390px] h-[844px] flex flex-col overflow-hidden bg-[#f6f7fb] font-sans select-none">

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <div className="h-11 bg-[#1a2332] flex items-center justify-between px-5 shrink-0">
        <span className="text-[14px] font-semibold text-white">9:41</span>
        <div className="flex items-center gap-2">
          <div className="flex gap-[2px] items-end h-3.5">
            {[4, 6, 9, 11].map((h, i) => (
              <div key={i} style={{ height: h }} className="w-[2.5px] bg-white/80 rounded-[1px]" />
            ))}
          </div>
          <div className="w-6 h-3 rounded-[3px] border border-white/60 flex items-center px-0.5">
            <div className="h-1.5 w-4 bg-white/80 rounded-[2px]" />
          </div>
        </div>
      </div>

      {/* ── Top header ──────────────────────────────────────────────────── */}
      <div className="bg-[#1a2332] shrink-0 px-4 pb-3">
        {!searching ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-white/50 uppercase tracking-widest mb-0.5">Workspace</p>
              <p className="text-[20px] font-extrabold text-white leading-tight tracking-tight">
                JILD <span className="text-[#4f8ef7]">IMPEX</span>
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setSearching(true)}
                className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"
              >
                <Search className="text-white/80" style={{ width: 17, height: 17 }} />
              </button>
              <button className="relative w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Bell className="text-white/80" style={{ width: 17, height: 17 }} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-400 rounded-full ring-[1.5px] ring-[#1a2332]" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-[#4f8ef7] flex items-center justify-center text-white font-bold text-[13px]">
                JI
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 h-9">
            <div className="flex-1 flex items-center gap-2 bg-white/15 rounded-xl px-3 h-9">
              <Search className="text-white/50 shrink-0" style={{ width: 14, height: 14 }} />
              <input
                autoFocus
                className="flex-1 bg-transparent text-[14px] text-white placeholder-white/40 outline-none"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")}>
                  <X className="text-white/50" style={{ width: 13, height: 13 }} />
                </button>
              )}
            </div>
            <button
              onClick={() => { setSearching(false); setSearch(""); }}
              className="text-[13px] font-semibold text-[#4f8ef7]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ── Tab bar (top sub-nav) ────────────────────────────────────────── */}
      <div className="bg-[#1a2332] border-b-2 border-[#4f8ef7]/20 flex shrink-0 overflow-x-auto no-scrollbar">
        {TABS.filter(t => t.id !== "more").map(t => {
          const active = activeTab === t.id && !showMore;
          return (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setShowMore(false); }}
              className={`flex-1 flex flex-col items-center py-2.5 relative transition-all ${active ? "opacity-100" : "opacity-40"}`}
            >
              <t.Icon
                className={active ? "text-[#4f8ef7]" : "text-white"}
                style={{ width: 18, height: 18 }}
                strokeWidth={active ? 2.5 : 1.75}
              />
              <span className={`text-[9px] font-bold mt-0.5 uppercase tracking-wider ${active ? "text-[#4f8ef7]" : "text-white"}`}>
                {t.label}
              </span>
              {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2.5px] bg-[#4f8ef7] rounded-t-full" />
              )}
            </button>
          );
        })}
        {/* More tab */}
        <button
          onClick={() => setShowMore(v => !v)}
          className={`flex-1 flex flex-col items-center py-2.5 relative transition-all ${showMore ? "opacity-100" : "opacity-40"}`}
        >
          <MoreHorizontal
            className={showMore ? "text-[#4f8ef7]" : "text-white"}
            style={{ width: 18, height: 18 }}
            strokeWidth={showMore ? 2.5 : 1.75}
          />
          <span className={`text-[9px] font-bold mt-0.5 uppercase tracking-wider ${showMore ? "text-[#4f8ef7]" : "text-white"}`}>
            More
          </span>
          {showMore && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2.5px] bg-[#4f8ef7] rounded-t-full" />}
        </button>
      </div>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── JOURNAL ──────────────────────────────────────────────────── */}
        {activeTab === "journal" && !showMore && (
          <div>
            {/* Date nav */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <button className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600">
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
              <p className="flex-1 text-center text-[12px] font-semibold text-gray-500">
                Wednesday, 17 May 2026
              </p>
              <button className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600">
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {/* "New entry" row */}
            <div className="px-4 pb-3">
              <button className="w-full flex items-center gap-3 bg-white border border-dashed border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm">
                <div className="w-7 h-7 rounded-full bg-[#4f8ef7] flex items-center justify-center shrink-0">
                  <Plus style={{ width: 14, height: 14 }} className="text-white" />
                </div>
                <span className="text-[13px] text-gray-400">Add new entry…</span>
              </button>
            </div>

            {/* Entry cards */}
            <div className="px-4 space-y-2.5 pb-4">
              {search.trim() && filteredEntries.length === 0 && (
                <p className="text-center text-[13px] text-gray-400 py-8">No results for "{search}"</p>
              )}
              {filteredEntries.map(entry => (
                <div
                  key={entry.id}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100/80"
                  style={{ borderLeftColor: entry.accent, borderLeftWidth: 4 }}
                >
                  <div className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-[15px] font-bold text-gray-900 leading-snug flex-1 line-clamp-1">
                        {entry.title}
                      </p>
                      <span className="text-[11px] text-gray-400 font-medium shrink-0 mt-0.5">
                        {entry.time}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-gray-500 leading-relaxed line-clamp-2 mb-2.5">
                      {entry.body}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#f0f4ff] text-[#4f8ef7]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CONTRACTS ─────────────────────────────────────────────────── */}
        {activeTab === "contracts" && !showMore && (
          <div className="px-4 pt-4 pb-6 space-y-2.5">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">All Contracts</p>
            {CONTRACTS.map(c => {
              const s = STATUS[c.status];
              return (
                <div key={c.num} className="bg-white rounded-2xl shadow-sm border border-gray-100/80 flex items-center gap-3 px-4 py-3.5"
                  style={{ borderLeftColor: "#6366f1", borderLeftWidth: 4 }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[14px] font-bold text-gray-900">{c.num}</p>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${s.bg} ${s.text}`}>{s.label}</span>
                    </div>
                    <p className="text-[12px] text-gray-500 truncate">{c.supplier}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-gray-400">{c.date}</p>
                    <Chevron style={{ width: 15, height: 15 }} className="text-gray-300 ml-auto mt-1" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── PAYMENTS ─────────────────────────────────────────────────── */}
        {activeTab === "payments" && !showMore && (
          <div className="px-4 pt-4 pb-6 space-y-2.5">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Debit Notes</p>
            {PAYMENTS.map(p => {
              const s = STATUS[p.status];
              return (
                <div key={p.num} className="bg-white rounded-2xl shadow-sm border border-gray-100/80 flex items-center gap-3 px-4 py-3.5"
                  style={{ borderLeftColor: "#10b981", borderLeftWidth: 4 }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[14px] font-bold text-gray-900">{p.num}</p>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${s.bg} ${s.text}`}>{s.label}</span>
                    </div>
                    <p className="text-[12px] text-gray-500">{p.name} · <span className="font-semibold text-gray-700">{p.amount}</span></p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-gray-400">{p.date}</p>
                    <Chevron style={{ width: 15, height: 15 }} className="text-gray-300 ml-auto mt-1" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── CONTACTS ─────────────────────────────────────────────────── */}
        {activeTab === "contacts" && !showMore && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
            <div className="w-16 h-16 rounded-3xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
              <Users className="text-[#4f8ef7]" style={{ width: 26, height: 26 }} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[16px] font-bold text-gray-800">Contacts</p>
              <p className="text-[12px] text-gray-400 mt-1">Your contact book appears here</p>
            </div>
          </div>
        )}

        {/* ── MORE drawer content ───────────────────────────────────────── */}
        {showMore && (
          <div className="px-4 pt-4 pb-6 space-y-2">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">More Modules</p>
            {MORE_ITEMS.map(item => (
              <button
                key={item.label}
                onClick={() => setShowMore(false)}
                className="w-full flex items-center gap-3.5 bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-gray-100/80"
              >
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${item.color}`}>
                  <item.Icon style={{ width: 18, height: 18 }} strokeWidth={1.75} />
                </div>
                <span className="flex-1 text-[15px] font-semibold text-gray-800 text-left">{item.label}</span>
                {item.badge && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
                <Chevron style={{ width: 16, height: 16 }} className="text-gray-300" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── FAB ──────────────────────────────────────────────────────────── */}
      <button className="absolute right-5 bottom-[90px] w-14 h-14 rounded-full bg-[#4f8ef7] shadow-xl flex items-center justify-center z-20">
        <Plus className="text-white" style={{ width: 24, height: 24 }} strokeWidth={2.5} />
      </button>

      {/* ── Bottom nav ───────────────────────────────────────────────────── */}
      <nav className="bg-white border-t border-gray-100 shrink-0 flex" style={{ paddingBottom: 22 }}>
        {TABS.map(t => {
          const isMore = t.id === "more";
          const active = isMore ? showMore : (activeTab === t.id && !showMore);
          return (
            <button
              key={t.id}
              onClick={() => {
                if (isMore) setShowMore(v => !v);
                else { setActiveTab(t.id); setShowMore(false); }
              }}
              className="flex-1 flex flex-col items-center justify-center pt-2.5 pb-0.5 gap-0.5"
            >
              <t.Icon
                className={active ? "text-[#4f8ef7]" : "text-gray-400"}
                style={{ width: 20, height: 20 }}
                strokeWidth={active ? 2.5 : 1.75}
              />
              <span className={`text-[9.5px] font-semibold ${active ? "text-[#4f8ef7]" : "text-gray-400"}`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
