type TabId = "portfolio" | "markets";

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: Array<{ id: TabId; label: string; iconClass: string }> = [
  { id: "portfolio", label: "Portfolio", iconClass: "fa-solid fa-briefcase" },
  { id: "markets", label: "Markets", iconClass: "fa-solid fa-chart-line" },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[32rem] px-4 pb-4">
      <div className="panel mx-auto flex rounded-[28px] px-3 py-2">
        {tabs.map((tab) => {
          const active = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[22px] px-4 py-3 text-sm font-medium transition ${
                active ? "bg-[var(--gold)] text-black" : "text-zinc-500"
              }`}
            >
              <i aria-hidden className={`${tab.iconClass} text-xs`} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
