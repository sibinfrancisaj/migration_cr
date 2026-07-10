import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { clearToken } from '@/lib/token';

const navItems = [
  { to: '/',              label: 'Dashboard',      icon: '📊' },
  { to: '/users',         label: 'Users',           icon: '👥' },
  { to: '/verification',  label: 'Verification',    icon: '🪪' },
  { to: '/moderation',    label: 'Moderation',      icon: '🚩' },
  { to: '/introductions', label: 'Intro Drops',     icon: '💌' },
  { to: '/groups',        label: 'Groups',          icon: '🏘️' },
  { to: '/events',        label: 'Events',          icon: '📅' },
  { to: '/prompts',       label: 'Prompts',         icon: '💬' },
  { to: '/payments',      label: 'Payments',        icon: '💳' },
  { to: '/ai',            label: 'AI Monitor',      icon: '🤖' },
  { to: '/flags',         label: 'Feature Flags',   icon: '🚦' },
  { to: '/config',        label: 'System Config',   icon: '⚙️' },
  { to: '/audit',         label: 'Audit Log',       icon: '📜' },
  { to: '/seeder',        label: 'Seeder',          icon: '🌱' },
];

export function Sidebar() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    clearToken();
    logout();
    navigate('/login');
  }

  return (
    <aside className="flex flex-col w-56 bg-white border-r border-gray-200 min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100">
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white text-xs font-bold">A</div>
        <div>
          <p className="text-sm font-semibold text-gray-900 leading-none">Abroad</p>
          <p className="text-xs text-gray-400 leading-none mt-0.5">Admin Panel</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <span className="text-base leading-none">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 px-3 py-3">
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold">
            {admin?.name?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{admin?.name ?? 'Admin'}</p>
            <p className="text-xs text-gray-400 truncate">{admin?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
