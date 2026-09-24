import React, { useState, useEffect, useCallback } from 'react';
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
  const [headerInfo, setHeaderInfo] = useState({
    title: '',
    subtitle: '',
    headerActions: null,
  });

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

  const getTitle = useCallback((tab) => {
    switch (tab) {
      case 'dashboard':
        return user?.role === 'admin'
          ? 'Admin Dashboard'
          : user?.role === 'teacher'
          ? 'Instructor Dashboard'
          : 'My Dashboard';
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
        return user?.role === 'student' ? 'My Records' : 'Session Logs';
      case 'profile':
        return 'My Profile';
      case 'scanner':
        return 'Live Attendance';
      default:
        return 'AttendFR';
    }
  }, [user?.role]);

  const updateHeaderInfo = useCallback((info) => {
    setHeaderInfo((prev) => {
      if (
        prev.title === info.title &&
        prev.subtitle === info.subtitle &&
        prev.headerActions === info.headerActions
      ) {
        return prev;
      }
      return { ...prev, ...info };
    });
  }, []);

  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
    setHeaderInfo({
      title: getTitle(newTab),
      subtitle: '',
      headerActions: null,
    });
  }, [getTitle]);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    handleTabChange('dashboard');
  };

  const handleLogout = () => {
    Api.logout();
    setUser(null);
    handleTabChange('dashboard');
    setActiveSessionId(null);
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
      {/* Sidebar Navigation (100% copycat of templates/base.html) */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
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
          title={headerInfo.title || getTitle(activeTab)}
          subtitle={headerInfo.subtitle}
          headerActions={headerInfo.headerActions}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        <div style={{ minHeight: 'calc(100vh - 64px)' }}>
          {activeTab === 'dashboard' && (
            <DashboardView
              user={user}
              onNavigate={handleTabChange}
              onSetHeaderInfo={updateHeaderInfo}
              onStartSession={(sec) => {
                setActiveSessionId(sec?.id);
                handleTabChange('scanner');
              }}
            />
          )}

          {activeTab === 'programs' && (
            <ProgramsView
              user={user}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'section_catalog' && (
            <SectionCatalogView
              user={user}
              onNavigate={handleTabChange}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'sections' && (
            <SectionsView
              user={user}
              onNavigate={handleTabChange}
              onSetHeaderInfo={updateHeaderInfo}
              onStartSession={(sec) => {
                if (user?.role === 'teacher') {
                  setActiveSessionId(sec?.id);
                  handleTabChange('scanner');
                }
              }}
            />
          )}

          {activeTab === 'subjects' && (
            <SubjectsView
              user={user}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'schedules' && (
            <SchedulesView
              user={user}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'users' && (
            <UsersView
              user={user}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'face_enrollment' && (
            <FaceEnrollmentView
              user={user}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'section_report' && (
            <SectionReportView
              user={user}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'session_logs' && (
            <ReportsView
              user={user}
              onNavigate={handleTabChange}
              onSetHeaderInfo={updateHeaderInfo}
              onStartSession={(s) => {
                if (user?.role === 'teacher') {
                  setActiveSessionId(s.id);
                  handleTabChange('scanner');
                }
              }}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              user={user}
              onUserUpdated={setUser}
              onSetHeaderInfo={updateHeaderInfo}
            />
          )}

          {activeTab === 'scanner' && user?.role === 'teacher' && (
            <LiveScannerView
              user={user}
              onNavigate={handleTabChange}
              onSetHeaderInfo={updateHeaderInfo}
              activeSessionId={activeSessionId}
            />
          )}
        </div>
      </main>
    </div>
  );
}
