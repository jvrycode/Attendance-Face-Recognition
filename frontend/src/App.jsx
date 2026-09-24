import React, { useState, useEffect } from 'react';
import { Api, TokenStorage } from './api';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginView from './views/LoginView';
import DashboardView from './views/DashboardView';
import ProgramsView from './views/ProgramsView';
import SectionsView from './views/SectionsView';
import UsersView from './views/UsersView';
import LiveScannerView from './views/LiveScannerView';
import ReportsView from './views/ReportsView';

export default function App() {
  const [user, setUser] = useState(TokenStorage.getUser());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const token = TokenStorage.getAccess();
      if (token) {
        try {
          const profile = await Api.getMe();
          setUser(profile);
          TokenStorage.set(token, TokenStorage.getRefresh(), profile);
        } catch {
          TokenStorage.clear();
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    Api.logout();
    setUser(null);
    setActiveTab('dashboard');
    setActiveSessionId(null);
  };

  const getTitle = (tab) => {
    switch (tab) {
      case 'dashboard':
        return 'Dashboard Overview';
      case 'programs':
        return 'Academic Programs';
      case 'sections':
        return 'Class Sections & Timetable';
      case 'schedules':
        return 'Weekly Schedules';
      case 'users':
        return 'User & Faculty Management';
      case 'scanner':
        return 'Live Facial Recognition Attendance';
      case 'reports':
        return 'Attendance Reports & Session Logs';
      default:
        return 'AttendFR';
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="pulse-indicator" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', margin: '0 auto 16px auto' }} />
          <p style={{ fontWeight: '600', fontSize: '14px' }}>Loading AttendFR...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Backdrop for Mobile Drawer */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          style={{ display: 'block' }}
        />
      )}

      {/* Main Content Area */}
      <main className="main-content">
        <Header
          user={user}
          title={getTitle(activeTab)}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onLogout={handleLogout}
        />

        <div style={{ minHeight: 'calc(100vh - 64px)' }}>
          {activeTab === 'dashboard' && (
            <DashboardView user={user} onNavigate={setActiveTab} />
          )}

          {activeTab === 'programs' && (
            <ProgramsView user={user} />
          )}

          {activeTab === 'sections' && (
            <SectionsView
              user={user}
              onNavigate={setActiveTab}
              onStartSession={(sec) => {
                setActiveSessionId(sec.id);
                setActiveTab('scanner');
              }}
            />
          )}

          {activeTab === 'schedules' && (
            <SectionsView
              user={user}
              onNavigate={setActiveTab}
              onStartSession={(sec) => {
                setActiveSessionId(sec.id);
                setActiveTab('scanner');
              }}
            />
          )}

          {activeTab === 'users' && (
            <UsersView user={user} />
          )}

          {activeTab === 'scanner' && (
            <LiveScannerView
              user={user}
              onNavigate={setActiveTab}
              activeSessionId={activeSessionId}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              user={user}
              onNavigate={setActiveTab}
              onStartSession={(s) => {
                setActiveSessionId(s.id);
                setActiveTab('scanner');
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
