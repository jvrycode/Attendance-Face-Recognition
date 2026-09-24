import React, { useState, useEffect } from 'react';
import { Api, TokenStorage } from './api';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginView from './views/LoginView';
import DashboardView from './views/DashboardView';
import ProgramsView from './views/ProgramsView';
import SectionCatalogView from './views/SectionCatalogView';
import SectionsView from './views/SectionsView';
import SubjectsView from './views/SubjectsView';
import SchedulesView from './views/SchedulesView';
import UsersView from './views/UsersView';
import FaceEnrollmentView from './views/FaceEnrollmentView';
import SectionReportView from './views/SectionReportView';
import ReportsView from './views/ReportsView';
import ProfileView from './views/ProfileView';
import LiveScannerView from './views/LiveScannerView';

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
        return user?.role === 'admin'
          ? 'Admin Dashboard'
          : user?.role === 'teacher'
          ? 'Teacher Dashboard'
          : 'Student Dashboard';
      case 'programs':
        return 'Academic Programs';
      case 'section_catalog':
        return 'Section Catalog (Master List)';
      case 'sections':
        return user?.role === 'student'
          ? 'My Schedule'
          : user?.role === 'teacher'
          ? 'Sections & Schedules'
          : 'Class Sections';
      case 'subjects':
        return 'Subjects';
      case 'schedules':
        return 'Schedules';
      case 'users':
        return 'Users';
      case 'face_enrollment':
        return 'Select Student to Enroll';
      case 'section_report':
        return user?.role === 'teacher' ? 'Attendance Reports' : 'Section Attendance Report';
      case 'session_logs':
        return user?.role === 'student' ? 'My Attendance Records' : 'Session Logs';
      case 'profile':
        return 'My Profile';
      case 'scanner':
        return 'Live Attendance';
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
            <DashboardView
              user={user}
              onNavigate={setActiveTab}
              onStartSession={(sec) => {
                setActiveSessionId(sec?.id);
                setActiveTab('scanner');
              }}
            />
          )}

          {activeTab === 'programs' && (
            <ProgramsView user={user} />
          )}

          {activeTab === 'section_catalog' && (
            <SectionCatalogView user={user} />
          )}

          {activeTab === 'sections' && (
            <SectionsView
              user={user}
              onNavigate={setActiveTab}
              onStartSession={(sec) => {
                setActiveSessionId(sec?.id);
                setActiveTab('scanner');
              }}
            />
          )}

          {activeTab === 'subjects' && (
            <SubjectsView user={user} />
          )}

          {activeTab === 'schedules' && (
            <SchedulesView user={user} />
          )}

          {activeTab === 'users' && (
            <UsersView user={user} />
          )}

          {activeTab === 'face_enrollment' && (
            <FaceEnrollmentView user={user} />
          )}

          {activeTab === 'section_report' && (
            <SectionReportView user={user} />
          )}

          {activeTab === 'session_logs' && (
            <ReportsView
              user={user}
              onNavigate={setActiveTab}
              onStartSession={(s) => {
                setActiveSessionId(s.id);
                setActiveTab('scanner');
              }}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView user={user} onUserUpdated={setUser} />
          )}

          {activeTab === 'scanner' && (
            <LiveScannerView
              user={user}
              onNavigate={setActiveTab}
              activeSessionId={activeSessionId}
            />
          )}
        </div>
      </main>
    </div>
  );
}
