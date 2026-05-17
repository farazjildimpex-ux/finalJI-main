import { CheckCircle2, Smartphone, Monitor, ScrollText, Zap, LayoutTemplate } from "lucide-react";

const CHANGES = [
  {
    category: "Mobile Navigation",
    icon: Smartphone,
    color: "bg-blue-500",
    bg: "bg-blue-50",
    border: "border-blue-100",
    text: "text-blue-700",
    items: [
      { title: "Remove drag-to-reorder", desc: "Replace the long-press reorder system with a clean fixed tab bar. Simpler and faster to navigate." },
      { title: "5-tab fixed layout", desc: "Home · Contracts · Payments · Calendar · More. The 'More' tab opens a smooth slide-up drawer for secondary pages." },
      { title: "Pill active indicator", desc: "Active tab gets a pill highlight and a top bar accent line — more polished than the current tiny dot." },
      { title: "No horizontal scroll", desc: "All 5 primary tabs are always visible without any horizontal swipe. No item ever goes off-screen." },
    ]
  },
  {
    category: "Desktop Sidebar",
    icon: Monitor,
    color: "bg-indigo-500",
    bg: "bg-indigo-50",
    border: "border-indigo-100",
    text: "text-indigo-700",
    items: [
      { title: "Collapsible with labels", desc: "Sidebar can expand to show icon + text labels, or collapse to icon-only. User's preference is remembered." },
      { title: "Top bar with search", desc: "Add a persistent top header bar with page title, global search, notifications bell, and user avatar." },
      { title: "Active state highlight", desc: "Active nav item gets a soft blue background highlight with the left stripe — more visually distinct." },
    ]
  },
  {
    category: "Scroll & Touch",
    icon: ScrollText,
    color: "bg-rose-500",
    bg: "bg-rose-50",
    border: "border-rose-100",
    text: "text-rose-700",
    items: [
      { title: "Fix journal thread pull-to-refresh", desc: "Add overscroll-behavior: contain to the thread scroll container so scrolling up/down inside the thread never triggers a page reload." },
      { title: "Scrollable modals", desc: "Any modal with long content (like the journal thread) clips scroll to inside the modal — tapping outside closes it cleanly." },
    ]
  },
  {
    category: "Forms & Data Entry",
    icon: LayoutTemplate,
    color: "bg-emerald-500",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    text: "text-emerald-700",
    items: [
      { title: "Date fields left-aligned", desc: "Date pickers now show the calendar icon and selected date flush-left, matching all other form fields." },
      { title: "Invoice dropdown", desc: "Payment form auto-loads invoices linked to the selected contract and lets you pick from a dropdown to autofill date and value." },
      { title: "Sticky form action bar", desc: "On mobile, the Save / Export / Delete button row stays fixed at the bottom of the screen while scrolling long forms." },
    ]
  },
  {
    category: "General Polish",
    icon: Zap,
    color: "bg-amber-500",
    bg: "bg-amber-50",
    border: "border-amber-100",
    text: "text-amber-700",
    items: [
      { title: "Wider tap targets", desc: "All buttons and list items raised to a minimum 44px tap height on mobile — fewer mis-taps." },
      { title: "Toast notifications", desc: "Inline error messages replaced with edge toast notifications that auto-dismiss — less disruptive to reading." },
      { title: "Section cards on mobile", desc: "Form section cards get horizontal padding tightened on small screens so content doesn't feel cramped." },
    ]
  }
];

export function UISummary() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
            <span className="text-white text-[11px] font-black">JI</span>
          </div>
          <div>
            <p className="text-[15px] font-black text-gray-900">UI Improvement Plan</p>
            <p className="text-[11px] text-gray-400">JILD IMPEX — Web & Mobile</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 space-y-4 max-w-[680px] mx-auto">
        {/* Count badge */}
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <p className="text-[13px] text-gray-600">
            <span className="font-bold text-gray-900">15 improvements</span> across navigation, forms, scroll behaviour, and visual polish
          </p>
        </div>

        {CHANGES.map(section => {
          const Icon = section.icon;
          return (
            <div key={section.category} className={`bg-white rounded-2xl border ${section.border} overflow-hidden`}>
              {/* Section header */}
              <div className={`flex items-center gap-3 px-5 py-4 ${section.bg} border-b ${section.border}`}>
                <div className={`w-8 h-8 rounded-xl ${section.color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <p className={`text-[13px] font-bold ${section.text}`}>{section.category}</p>
                <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-lg ${section.color} text-white`}>
                  {section.items.length}
                </span>
              </div>

              {/* Items */}
              <div className="divide-y divide-gray-50">
                {section.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${section.color} mt-2 shrink-0`} />
                    <div>
                      <p className="text-[12.5px] font-semibold text-gray-800">{item.title}</p>
                      <p className="text-[11.5px] text-gray-400 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <p className="text-center text-[11px] text-gray-300 pb-4">
          Review the mockups on the left and right to see the Mobile Nav and Desktop Sidebar changes.
        </p>
      </div>
    </div>
  );
}
