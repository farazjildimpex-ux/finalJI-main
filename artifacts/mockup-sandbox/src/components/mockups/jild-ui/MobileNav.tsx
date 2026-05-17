import { useState } from "react";
import {
  Home, FileText, CreditCard, CalendarDays, MoreHorizontal,
  Users, Bookmark, Zap, Database, X, ChevronRight,
  Bell, Search, Plus
} from "lucide-react";

const PRIMARY_TABS = [
  { name: "Home",      icon: Home,         path: "/home" },
  { name: "Contracts", icon: FileText,      path: "/contracts" },
  { name: "Payments",  icon: CreditCard,    path: "/payments" },
  { name: "Calendar",  icon: CalendarDays,  path: "/calendar" },
  { name: "More",      icon: MoreHorizontal, path: null },
];

const MORE_ITEMS = [
  { name: "Contacts",  icon: Users,     badge: null },
  { name: "Lead IQ",   icon: Zap,       badge: "3" },
  { name: "Letters",   icon: Bookmark,  badge: null },
  { name: "Settings",  icon: Database,  badge: null },
];

export function MobileNav() {
  const [active, setActive] = useState("Home");
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="w-[390px] h-[844px] bg-gray-50 flex flex-col relative overflow-hidden font-sans">

      {/* Status bar */}
      <div className="h-11 bg-white flex items-center justify-between px-6 shrink-0 border-b border-gray-100">
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

      {/* App header */}
      <div className="h-14 bg-white flex items-center justify-between px-4 shrink-0 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
            <span className="text-white text-[11px] font-black tracking-tight">JI</span>
          </div>
          <div>
            <p className="text-[13px] font-bold text-gray-900 leading-tight">JILD IMPEX</p>
            <p className="text-[10px] text-gray-400 leading-tight">Management Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100">
            <Search className="w-4 h-4" />
          </button>
          <button className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
          </button>
        </div>
      </div>

      {/* Page content placeholder */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-3">
        {/* Quick stats row */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Active Contracts", value: "12", color: "bg-blue-50 border-blue-100", text: "text-blue-700" },
            { label: "Pending Payments", value: "4", color: "bg-amber-50 border-amber-100", text: "text-amber-700" },
          ].map(s => (
            <div key={s.label} className={`${s.color} border rounded-2xl p-4`}>
              <p className={`text-2xl font-black ${s.text}`}>{s.value}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <p className="text-[13px] font-bold text-gray-800">Recent Activity</p>
            <button className="text-[11px] text-blue-600 font-semibold">See all</button>
          </div>
          {[
            { title: "Contract #C-2024-041", sub: "Chennai Leather Co.", time: "2h ago", dot: "bg-green-400" },
            { title: "Debit Note #DN-089", sub: "Commission settled", time: "1d ago", dot: "bg-blue-400" },
            { title: "Sample #SB-112", sub: "Shipped to Germany", time: "2d ago", dot: "bg-purple-400" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-t border-gray-50">
              <div className={`w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-gray-800 truncate">{item.title}</p>
                <p className="text-[11px] text-gray-400 truncate">{item.sub}</p>
              </div>
              <span className="text-[10px] text-gray-300 shrink-0">{item.time}</span>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[13px] font-bold text-gray-800 mb-3">Quick Actions</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "New Contract", icon: FileText, color: "bg-blue-50 text-blue-600" },
              { label: "New Payment", icon: CreditCard, color: "bg-emerald-50 text-emerald-600" },
              { label: "Add Contact", icon: Users, color: "bg-purple-50 text-purple-600" },
              { label: "New Entry", icon: Plus, color: "bg-amber-50 text-amber-600" },
            ].map(a => (
              <button key={a.label} className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-gray-50">
                <div className={`w-9 h-9 rounded-xl ${a.color} flex items-center justify-center`}>
                  <a.icon className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-semibold text-gray-500 text-center leading-tight">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── NEW BOTTOM NAV ── */}
      <nav className="shrink-0 bg-white border-t border-gray-100 pb-safe" style={{paddingBottom: 16}}>
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
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-all"
              >
                {/* Active pill */}
                {(isActive || isMoreActive) && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
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
            className="absolute inset-0 bg-black/20 backdrop-blur-[1px] z-10"
            onClick={() => setShowMore(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <p className="text-[15px] font-bold text-gray-900">More</p>
              <button
                onClick={() => setShowMore(false)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
            <div className="px-4 pb-6 space-y-1">
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
