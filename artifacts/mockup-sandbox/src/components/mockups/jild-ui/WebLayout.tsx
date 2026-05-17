import { useState } from "react";
import {
  Home, FileText, CreditCard, CalendarDays, Users, Bookmark,
  Zap, Database, Building2, Key, LogOut, ChevronRight,
  Bell, Search, Plus, TrendingUp
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Home",      icon: Home,         path: "/home",        active: true },
  { name: "Contacts",  icon: Users,         path: "/contacts",    active: false },
  { name: "Lead IQ",   icon: Zap,           path: "/sales",       active: false },
  { name: "Contracts", icon: FileText,       path: "/contracts",   active: false },
  { name: "Letters",   icon: Bookmark,      path: "/samples",     active: false },
  { name: "Payments",  icon: CreditCard,    path: "/payments",    active: false },
  { name: "Calendar",  icon: CalendarDays,  path: "/calendar",    active: false },
];

export function WebLayout() {
  const [activeItem, setActiveItem] = useState("Home");
  const [collapsed, setCollapsed] = useState(false);

  const sidebarW = collapsed ? 56 : 200;

  return (
    <div className="w-[1280px] h-[720px] bg-gray-50 flex font-sans overflow-hidden">

      {/* ── SIDEBAR ── */}
      <aside
        className="bg-white border-r border-gray-100 flex flex-col shrink-0 transition-all duration-200"
        style={{ width: sidebarW }}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-3 py-4 border-b border-gray-100 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shrink-0">
            <span className="text-white text-[11px] font-black">JI</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[12px] font-black text-gray-900 leading-tight">JILD IMPEX</p>
              <p className="text-[9px] text-gray-400 leading-tight">Management Portal</p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeItem === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setActiveItem(item.name)}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 mx-0 transition-all
                  ${isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'}
                  ${collapsed ? 'justify-center' : ''}`}
              >
                {/* Active left stripe */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-600 rounded-r-full" />
                )}
                <Icon style={{width:16, height:16, flexShrink:0}} strokeWidth={isActive ? 2.5 : 1.75} />
                {!collapsed && (
                  <span className={`text-[12.5px] font-semibold whitespace-nowrap ${isActive ? 'text-blue-700' : ''}`}>
                    {item.name}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className={`py-3 border-t border-gray-100 space-y-0.5 ${collapsed ? 'flex flex-col items-center' : ''}`}>
          {[
            { icon: Building2, label: "Manage Companies" },
            { icon: Key, label: "Change Password" },
            { icon: LogOut, label: "Logout", danger: true },
          ].map(a => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                className={`flex items-center gap-3 px-3 py-2.5 w-full transition-all rounded-none
                  ${a.danger ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'}
                  ${collapsed ? 'justify-center' : ''}`}
              >
                <Icon style={{width:15, height:15, flexShrink:0}} strokeWidth={1.75} />
                {!collapsed && (
                  <span className={`text-[12px] font-medium ${a.danger ? 'hover:text-red-500' : ''}`}>{a.label}</span>
                )}
              </button>
            );
          })}
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(v => !v)}
            className={`flex items-center gap-3 px-3 py-2 w-full text-gray-300 hover:text-gray-600 transition-all
              ${collapsed ? 'justify-center' : ''}`}
          >
            <ChevronRight
              style={{width:14, height:14, flexShrink:0}}
              className={`transition-transform duration-200 ${!collapsed ? 'rotate-180' : ''}`}
            />
            {!collapsed && <span className="text-[11px] font-medium text-gray-300">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center gap-3 px-5 shrink-0">
          <div className="flex-1">
            <h1 className="text-[15px] font-bold text-gray-900">Home</h1>
            <p className="text-[11px] text-gray-400">Welcome back — Wednesday, 17 May 2026</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                className="h-8 w-56 pl-8 pr-3 text-[12px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                placeholder="Search anything…"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            </div>
            <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">RA</span>
            </div>
          </div>
        </header>

        {/* Dashboard content */}
        <main className="flex-1 overflow-y-auto p-5">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-5">
            {[
              { label: "Active Contracts", value: "12", delta: "+2", icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Open Debit Notes", value: "4", delta: "+1", icon: CreditCard, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Contacts", value: "87", delta: "+5", icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Leads (30d)", value: "23", delta: "+8", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
                  <div className={`${s.bg} w-9 h-9 rounded-xl flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${s.color}`} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-[20px] font-black text-gray-900 leading-tight">{s.value}</p>
                    <p className="text-[11px] text-gray-400 leading-tight">{s.label}</p>
                    <p className="text-[10px] text-emerald-500 font-semibold mt-0.5">{s.delta} this month</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Two column layout */}
          <div className="grid grid-cols-5 gap-4">
            {/* Recent contracts */}
            <div className="col-span-3 bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50">
                <p className="text-[13px] font-bold text-gray-800">Recent Contracts</p>
                <button className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              {[
                { no: "C-2024-041", buyer: "Chennai Leather Co.", dest: "Germany", status: "Active", statusColor: "bg-emerald-100 text-emerald-700" },
                { no: "C-2024-039", buyer: "Milano Cuoio SRL", dest: "Italy", status: "Active", statusColor: "bg-emerald-100 text-emerald-700" },
                { no: "C-2024-037", buyer: "London Leather Ltd", dest: "UK", status: "Pending", statusColor: "bg-amber-100 text-amber-700" },
                { no: "C-2024-035", buyer: "Paris Maroquinerie", dest: "France", status: "Completed", statusColor: "bg-gray-100 text-gray-500" },
              ].map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-t border-gray-50 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800">{c.no} — {c.buyer}</p>
                    <p className="text-[11px] text-gray-400">{c.dest}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${c.statusColor}`}>{c.status}</span>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="col-span-2 space-y-3">
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-[12px] font-bold text-gray-700 mb-3">Quick Actions</p>
                <div className="space-y-2">
                  {[
                    { label: "New Contract",  icon: FileText,   color: "bg-blue-500" },
                    { label: "New Debit Note", icon: CreditCard, color: "bg-emerald-500" },
                    { label: "New Lead",       icon: Zap,        color: "bg-amber-500" },
                  ].map(a => {
                    const Icon = a.icon;
                    return (
                      <button key={a.label} className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className={`${a.color} w-7 h-7 rounded-lg flex items-center justify-center shrink-0`}>
                          <Icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-[12px] font-semibold text-gray-700">{a.label}</span>
                        <Plus className="w-3.5 h-3.5 text-gray-300 ml-auto" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white">
                <p className="text-[11px] font-semibold opacity-70 uppercase tracking-wide">Next Reminder</p>
                <p className="text-[14px] font-bold mt-1">Follow up: Chennai Leather</p>
                <p className="text-[11px] opacity-70 mt-0.5">Today at 3:00 PM</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
