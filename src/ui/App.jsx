import React from 'react';
import { useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import TabsNav from './components/TabsNav';
import Dashboard from './components/Dashboard';
import ModelManager from './components/ModelManager';
import ContextManager from './components/ContextManager';
import Playground from './components/Playground';
import LiveLogs from './components/LiveLogs';
import Settings from './components/Settings';
import StatusBar from './components/StatusBar';
import DownloadDrawer from './components/DownloadDrawer';

export default function App() {
  const { activeTab } = useApp();

  return (
    <div className="h-screen w-screen flex flex-col bg-base-100 text-base-content overflow-hidden select-none">
      
      {/* Top Navbar */}
      <Navbar />

      {/* Tabs Navigation */}
      <TabsNav />

      {/* Main View Area (Strict flex-1 min-h-0 container so nothing squishes) */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        {activeTab === 'runner' && <Dashboard />}
        {activeTab === 'models' && <ModelManager />}
        {activeTab === 'context' && <ContextManager />}
        {activeTab === 'playground' && <Playground />}
        {activeTab === 'logs' && <LiveLogs />}
        {activeTab === 'settings' && <Settings />}
      </main>

      {/* Bottom Status Bar */}
      <StatusBar />

      {/* Floating Download Indicator */}
      <DownloadDrawer />

    </div>
  );
}
