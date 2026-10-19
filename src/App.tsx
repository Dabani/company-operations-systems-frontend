import { Center, Loader } from '@mantine/core';
import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { RequirePermission } from './components/RequirePermission';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPages';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { RolesPage } from './pages/RolesPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { LocationsPage } from './pages/LocationsPage';
import { LookupsPage } from './pages/LookupsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { OrganizationPage } from './pages/OrganizationPage';
import { ProfilePage } from './pages/ProfilePage';
import { FilesPage } from './pages/FilesPage';
import { AssetsPage } from './pages/AssetsPage';
import { MovementsPage } from './pages/MovementsPage';
import { AccessRegisterPage } from './pages/AccessRegisterPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { CasesPage } from './pages/CasesPage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { SupportChatsPage } from './pages/SupportChatsPage';
import { NotFoundPage } from './pages/ErrorPages';

export default function App() {
  const { me, loading } = useAuth();

  if (loading) return <Center h="100dvh"><Loader /></Center>;

  if (!me) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const guard = (perm: string, el: ReactElement) => <RequirePermission permission={perm}>{el}</RequirePermission>;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={guard('dashboard.view', <DashboardPage />)} />
        <Route path="/assets" element={guard('asset.view', <AssetsPage />)} />
        <Route path="/assets/movements" element={guard('asset.request_movement', <MovementsPage />)} />
        <Route path="/access-register" element={guard('access.view', <AccessRegisterPage />)} />
        <Route path="/incidents" element={guard('case.view_own', <IncidentsPage />)} />
        <Route path="/files" element={guard('file.view', <FilesPage />)} />
        <Route path="/cases" element={guard('case.view_own', <CasesPage />)} />
        <Route path="/cases/:id" element={guard('case.view_own', <CaseDetailPage />)} />
        <Route path="/support/chats" element={guard('chat.moderate', <SupportChatsPage />)} />
        <Route path="/admin/users" element={guard('user.view', <UsersPage />)} />
        <Route path="/admin/roles" element={guard('role.view', <RolesPage />)} />
        <Route path="/admin/organization" element={guard('organization.view', <OrganizationPage />)} />
        <Route path="/admin/departments" element={guard('department.view', <DepartmentsPage />)} />
        <Route path="/admin/locations" element={guard('location.view', <LocationsPage />)} />
        <Route path="/admin/lookups" element={guard('lookup.view', <LookupsPage />)} />
        <Route path="/admin/audit-log" element={guard('audit_log.view', <AuditLogPage />)} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
