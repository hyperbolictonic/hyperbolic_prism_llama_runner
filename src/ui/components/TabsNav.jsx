import React from 'react';
import { useApp } from '../context/AppContext';
import { Activity, Boxes, MessageSquare, Terminal, Settings, Database } from 'lucide-react';

export default function TabsNav() {
  const { activeTab, setActiveTab, localModels, logs, config } = useApp();

  const tabs = [
    { id: 'runner', label: 'Inference Supervisor', icon: Activity },
    { id: 'models', label: 'Model Manager & Hub', icon: Boxes, badge: localModels.length || null },
    { id: 'context', label: 'KV Cache & Context', icon: Database, badge: config.cacheTypeK ? config.cacheTypeK.toUpperCase() : 'Q8_0' },
    { id: 'playground', label: 'Chat Playground', icon: MessageSquare },
    { id: 'logs', label: 'Live Logs', icon: Terminal, badge: logs.length > 0 ? `${logs.length}` : null },
    { id: 'settings', label: 'Settings & Binaries', icon: Settings },
  ];

  return (
    <nav className="bg-base-200/60 border-b border-base-300 px-4 flex items-center shrink-0">
      <div role="tablist" className="tabs tabs-lifted">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              onClick={() => setActiveTab(tab.id)}
              className={`tab h-11 px-4 gap-2 text-xs font-semibold transition-all ${
                isActive ? 'tab-active text-primary bg-base-100' : 'text-base-content/70 hover:text-base-content'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'opacity-70'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`badge badge-xs ml-1 font-mono ${isActive ? 'badge-primary text-black font-bold' : 'badge-neutral'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
