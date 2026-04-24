import { useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ProfileTab from './ProfileTab';
import JDTab from './JDTab';
import UsersTab from './UsersTab';
import { FileText, Briefcase, LogOut, User, Users } from 'lucide-react';

export default function AppLayout() {
  const [activeTab, setActiveTab] = useState<'profile' | 'jd' | 'users'>('profile');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.userRole === 'admin';

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F7FF]">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-3 sm:py-0 min-h-[60px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-[34px] h-[34px] bg-violet-600 rounded-lg flex items-center justify-center">
              <FileText size={17} color="#fff" />
            </div>
            <span className="font-serif text-xl text-gray-900 hidden sm:block">ResumeForge</span>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-1 bg-gray-100 p-1 rounded-[10px] w-full sm:w-auto">
            <TabBtn active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<User size={14} />}>
              <span className="hidden sm:inline">Profile Builder</span>
              <span className="sm:hidden">Profile</span>
            </TabBtn>
            <TabBtn active={activeTab === 'jd'} onClick={() => setActiveTab('jd')} icon={<Briefcase size={14} />}>
              <span className="hidden sm:inline">JD Tailoring</span>
              <span className="sm:hidden">JD</span>
            </TabBtn>
            {isAdmin && (
              <TabBtn active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={14} />}>
                <span className="hidden sm:inline">Users</span>
                <span className="sm:hidden">Users</span>
              </TabBtn>
            )}
          </div>

          {/* User menu */}
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0 w-full sm:w-auto">
            <span className="text-sm text-gray-600 hidden sm:block">
              Hi, <strong className="text-gray-900">{user?.username}</strong>
            </span>
            <button onClick={handleLogout} className="btn-ghost text-gray-600">
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-[1100px] mx-auto w-full px-4 sm:px-6 py-6 sm:py-7">
        {activeTab === 'profile' ? <ProfileTab /> : activeTab === 'jd' ? <JDTab /> : <UsersTab />}
      </main>
    </div>
  );
}

interface TabBtnProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}

function TabBtn({ active, onClick, icon, children }: TabBtnProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-[7px] text-sm font-medium transition-all whitespace-nowrap ${
        active
          ? 'bg-white text-violet-600 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}{children}
    </button>
  );
}
