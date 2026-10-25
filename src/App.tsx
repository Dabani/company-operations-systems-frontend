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
import { RecordsPage } from './pages/RecordsPage';
import { ArchiveAccessPage } from './pages/ArchiveAccessPage';
import { InventoryPage } from './pages/InventoryPage';
import { DisposalPage } from './pages/DisposalPage';
import { RetentionPage } from './pages/RetentionPage';
import { LegalReferencesPage } from './pages/LegalReferencesPage';
import { ComplianceCalendarPage } from './pages/ComplianceCalendarPage';
import { BackupsPage } from './pages/BackupsPage';
import { TrainingPage } from './pages/TrainingPage';
import { AuditsPage } from './pages/AuditsPage';
import { ManagementReportsPage } from './pages/ManagementReportsPage';
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

  const guard = (perm: string | string[], el: ReactElement) => <RequirePermission permission={perm}>{el}</RequirePermission>;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={guard('dashboard.view', <DashboardPage />)} />
        <Route path="/assets" element={guard('asset.view', <AssetsPage />)} />
        <Route path="/assets/movements" element={guard('asset.request_movement', <MovementsPage />)} />
        <Route path="/access-register" element={guard('access.view', <AccessRegisterPage />)} />
        <Route path="/incidents" element={guard('case.view_own', <IncidentsPage />)} />
        <Route path="/archive/records" element={guard('archive.view', <RecordsPage />)} />
        <Route path="/archive/access" element={guard('archive.view', <ArchiveAccessPage />)} />
        <Route path="/archive/inventory" element={guard('archive.manage', <InventoryPage />)} />
        <Route path="/archive/disposal" element={guard(['archive.manage', 'archive.approve_disposal'], <DisposalPage />)} />
        <Route path="/archive/retention" element={guard('archive.view', <RetentionPage />)} />
        <Route path="/compliance/calendar" element={guard('compliance.view', <ComplianceCalendarPage />)} />
        <Route path="/compliance/backups" element={guard(['backup.manage', 'compliance.view'], <BackupsPage />)} />
        <Route path="/compliance/training" element={guard(['training.view', 'training.manage'], <TrainingPage />)} />
        <Route path="/compliance/audits" element={guard('compliance.view', <AuditsPage />)} />
        <Route path="/compliance/reports" element={guard(['report.receive', 'compliance.view'], <ManagementReportsPage />)} />
        <Route path="/compliance/legal" element={guard('archive.view', <LegalReferencesPage />)} />
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
