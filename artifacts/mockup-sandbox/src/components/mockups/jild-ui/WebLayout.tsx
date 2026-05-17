import { useState } from "react";
import {
  BookOpen, FileText, CreditCard, Users, Bookmark,
  Zap, CalendarDays, Settings, Building2, LogOut, ChevronRight,
  Bell, Plus, Hash, Tag, Edit3, Package, ChevronDown,
  MapPin, X
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Journal",    icon: BookOpen,    path: "/journal" },
  { name: "Contracts",  icon: FileText,    path: "/contracts" },
  { name: "Payments",   icon: CreditCard,  path: "/payments" },
  { name: "Contacts",   icon: Users,       path: "/contacts" },
  { name: "Sample Book",icon: Package,     path: "/samples" },
  { name: "Lead IQ",    icon: Zap,         path: "/sales",   badge: "3" },
  { name: "Letters",    icon: Bookmark,    path: "/letters" },
  { name: "Calendar",   icon: CalendarDays,path: "/calendar" },
];

const RECENT_ALL = [
  { type: "Journal",  label: "Spoke with Rajesh — LC draft pending", sub: "Today, 10:42 AM",          icon: BookOpen,  dot: "bg-blue-400",    typeColor: "text-blue-600 bg-blue-50" },
  { type: "Contract", label: "C-2024-041 — Chennai Leather Co.",     sub: "Active · Germany",          icon: FileText,  dot: "bg-indigo-400",  typeColor: "text-indigo-600 bg-indigo-50" },
  { type: "Journal",  label: "€18,400 wire still pending — follow up", sub: "Today, 8:15 AM",          icon: BookOpen,  dot: "bg-blue-400",    typeColor: "text-blue-600 bg-blue-50" },
  { type: "Payment",  label: "DN-089 — Milano Cuoio SRL",            sub: "€18,400 · In progress",     icon: CreditCard,dot: "bg-amber-400",   typeColor: "text-amber-600 bg-amber-50" },
  { type: "Sample",   label: "SB-112 — Goat Nappa, Natural",         sub: "DHL · Delivered Frankfurt",  icon: Package,   dot: "bg-emerald-400", typeColor: "text-emerald-600 bg-emerald-50" },
  { type: "Contract", label: "C-2024-039 — Milano Cuoio SRL",        sub: "Active · Italy",            icon: FileText,  dot: "bg-indigo-400",  typeColor: "text-indigo-600 bg-indigo-50" },
  { type: "Contact",  label: "Rajesh Kumar — Chennai Leather",        sub: "+91 98400 12345",            icon: Users,     dot: "bg-purple-400",  typeColor: "text-purple-600 bg-purple-50" },
  { type: "Payment",  label: "DN-088 — London Leather Ltd",          sub: "£12,000 · Settled",          icon: CreditCard,dot: "bg-amber-400",   typeColor: "text-amber-600 bg-amber-50" },
  { type: "Sample",   label: "SB-110 — Cow Pull-Up, Cognac",         sub: "FedEx · In transit",         icon: Package,   dot: "bg-emerald-400", typeColor: "text-emerald-600 bg-emerald-50" },
];

const JOURNAL_ENTRY = {
  content: "Spoke with Rajesh about the new vegetable-tanned shipment. He confirmed 1,200 sq ft ready by end of June. Need to chase the LC draft.",
  tags: ["Chennai Leather", "Contract", "LC"],
  reminder: "Today at 3:00 PM",
};

export function WebLayout() {
  const [activeItem, setActiveItem] = useState("Journal");
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState("All");

  const sidebarW = collapsed ? 52 : 196;

  const filters = ["All", "Journal", "Contracts", "Payments", "Samples", "Contacts"];
  const filtered = filter === "All" ? RECENT_ALL : RECENT_ALL.filter(r => r.type === filter.replace(/s$/, "").replace("Sample", "Sample"));

  return (
    <div className="w-[1280px] h-[720px] bg-gray-50 flex font-sans overflow-hidden">

      {/* ── SIDEBAR ── */}
      <aside
        className="bg-white border-r border-gray-100 flex flex-col shrink-0 transition-all duration-200"
        style={{ width: sidebarW }}
      >
        {/* Logo mark only — branding is in main content */}
        <div className={`flex items-center ${collapsed ? 'justify-center px-0' : 'px-3'} py-4 border-b border-gray-100`}>
          <div
            className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shrink-0 cursor-pointer"
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="text-white text-[11px] font-black">JI</span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeItem === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setActiveItem(item.name)}
                className={`relative w-full flex items-center gap-2.5 py-2.5 transition-all
                  ${collapsed ? 'justify-center px-0' : 'px-3'}
                  ${isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}
                title={collapsed ? item.name : undefined}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-600 rounded-r-full" />
                )}
                <div className="relative shrink-0">
                  <Icon style={{width:15, height:15}} strokeWidth={isActive ? 2.5 : 1.75} />
                  {item.badge && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                {!collapsed && (
                  <span className={`text-[12px] font-semibold whitespace-nowrap flex-1 text-left ${isActive ? 'text-blue-700' : ''}`}>
                    {item.name}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className={`py-2 border-t border-gray-100 ${collapsed ? 'flex flex-col items-center' : ''}`}>
          {[
            { icon: Building2, label: "Companies" },
            { icon: Settings,  label: "Settings" },
            { icon: LogOut,    label: "Logout", danger: true },
          ].map(a => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                className={`flex items-center gap-2.5 py-2.5 w-full transition-all
                  ${collapsed ? 'justify-center px-0' : 'px-3'}
                  ${a.danger ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}
                title={collapsed ? a.label : undefined}
              >
                <Icon style={{width:15, height:15, flexShrink:0}} strokeWidth={1.75} />
                {!collapsed && <span className="text-[12px] font-medium">{a.label}</span>}
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top header — BRANDING HERE, not in sidebar */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center gap-4 px-6 shrink-0">
          <div className="flex-1">
            <div className="flex items-baseline gap-3">
              <h1 className="text-[16px] font-black text-gray-900 tracking-tight">JILD IMPEX</h1>
              <span className="text-[11px] text-gray-400 font-medium">Management Portal</span>
            </div>
            <p className="text-[10px] text-gray-400">Wednesday, 17 May 2026</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
            <button className="flex items-center gap-2 h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> New entry
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex gap-0">

          {/* ── LEFT: Journal compose + today's entries ── */}
          <div className="w-[380px] shrink-0 border-r border-gray-100 flex flex-col overflow-hidden bg-white">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-[13px] font-bold text-gray-800 mb-2.5">Journal</p>
              {/* Write box */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <textarea
                  className="w-full px-3 pt-3 pb-2 text-[12px] text-gray-700 resize-none focus:outline-none placeholder-gray-300 leading-relaxed"
                  rows={3}
                  placeholder="What happened today? Note a call, meeting, follow-up…"
                />
                <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50">
                  <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-gray-400 hover:bg-gray-200 text-[10px] font-semibold">
                    <Tag className="w-3 h-3" /> Tag
                  </button>
                  <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-gray-400 hover:bg-gray-200 text-[10px] font-semibold">
                    <Bell className="w-3 h-3" /> Remind
                  </button>
                  <button className="ml-auto flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-semibold">
                    Save
                  </button>
                </div>
              </div>
            </div>

            {/* Today's journal entries */}
            <div className="flex-1 overflow-y-auto py-2">
              {[
                {
                  time: "10:42 AM",
                  content: "Spoke with Rajesh about vegetable-tanned shipment. 1,200 sq ft by end of June. Chase LC draft.",
                  tags: ["Chennai Leather", "Contract"],
                  reminder: "3:00 PM",
                  bar: "bg-blue-400",
                },
                {
                  time: "8:15 AM",
                  content: "Wire of €18,400 still not reflected. Bank says T+2. Follow up tomorrow if still pending.",
                  tags: ["Milano Cuoio", "Payment"],
                  reminder: null,
                  bar: "bg-amber-400",
                },
              ].map((e, i) => (
                <div key={i} className={`mx-3 mb-2 bg-gray-50 rounded-xl border-l-4 ${e.bar} border border-gray-100 px-3 py-3`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-gray-400 font-medium">{e.time}</span>
                    {e.reminder && (
                      <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full">
                        <Bell className="w-2.5 h-2.5 text-amber-500" />
                        <span className="text-[9px] font-semibold text-amber-600">{e.reminder}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11.5px] text-gray-700 leading-relaxed">{e.content}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {e.tags.map(t => (
                      <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-[9px] font-medium text-gray-500">
                        <Hash className="w-2 h-2" /> {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Recent activity across all types ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-5 pt-4 pb-0 border-b border-gray-100 bg-white">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-bold text-gray-800">Recent Activity</p>
                <span className="text-[10px] text-gray-400">Contracts · Payments · Samples · Contacts</span>
              </div>
              {/* Filter pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-3 no-scrollbar">
                {filters.map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`shrink-0 px-3 py-1 rounded-full text-[10.5px] font-semibold border transition-all
                      ${filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {RECENT_ALL.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 flex items-center gap-3 px-4 py-3 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${item.typeColor}`}>
                        <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${item.typeColor}`}>{item.type.toUpperCase()}</span>
                          <p className="text-[12px] font-semibold text-gray-800 truncate">{item.label}</p>
                        </div>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{item.sub}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
