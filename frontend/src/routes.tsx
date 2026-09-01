import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminRoute } from './auth/AdminRoute';
import { ManagerRoute } from './auth/ManagerRoute';
import { OnboardingGate } from './auth/OnboardingGate';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppShell';
import { CompanySettingsPage } from './pages/Admin/CompanySettingsPage';
import { EmployeesPage } from './pages/Admin/EmployeesPage';
import { ProjectsPage } from './pages/Admin/ProjectsPage';
import { ProjectTimeOverviewPage } from './pages/Manager/ProjectTimeOverviewPage';
import { TeamTimeOverviewPage } from './pages/Manager/TeamTimeOverviewPage';
import { OnboardingPage } from './pages/Onboarding/OnboardingPage';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { DailyTimeEntryPage } from './pages/TimeEntry/DailyTimeEntryPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route element={<OnboardingGate />}>
          <Route path="/onboarding" element={<OnboardingPage />} />

          <Route element={<AppLayout />}>
            <Route path="/" element={<DailyTimeEntryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/manager/projects" element={<ProjectTimeOverviewPage />} />
            <Route path="/manager/projects/:id" element={<ProjectTimeOverviewPage />} />

            <Route element={<ManagerRoute />}>
              <Route path="/manager/team" element={<TeamTimeOverviewPage />} />
            </Route>

            <Route element={<AdminRoute />}>
              <Route path="/admin/projects" element={<ProjectsPage />} />
              <Route path="/admin/employees" element={<EmployeesPage />} />
              <Route path="/admin/company" element={<CompanySettingsPage />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
