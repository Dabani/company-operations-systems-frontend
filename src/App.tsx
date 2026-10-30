import { Center, Loader } from '@mantine/core';
import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { RequirePermission } from './components/RequirePermission';
import { RouteBoundary } from './components/RouteBoundary';
import { page } from './lib/lazyPage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPages';

const pg = page;   // route-level code splitting: each screen is its own chunk, fetched on first visit
const LoginPage = pg(() => import('./pages/LoginPage'), 'LoginPage');
const DashboardPage = pg(() => import('./pages/DashboardPage'), 'DashboardPage');
const UsersPage = pg(() => import('./pages/UsersPage'), 'UsersPage');
const RolesPage = pg(() => import('./pages/RolesPage'), 'RolesPage');
const DepartmentsPage = pg(() => import('./pages/DepartmentsPage'), 'DepartmentsPage');
const LocationsPage = pg(() => import('./pages/LocationsPage'), 'LocationsPage');
const LookupsPage = pg(() => import('./pages/LookupsPage'), 'LookupsPage');
const AuditLogPage = pg(() => import('./pages/AuditLogPage'), 'AuditLogPage');
const OrganizationPage = pg(() => import('./pages/OrganizationPage'), 'OrganizationPage');
const ProfilePage = pg(() => import('./pages/ProfilePage'), 'ProfilePage');
const FilesPage = pg(() => import('./pages/FilesPage'), 'FilesPage');
const RecordsPage = pg(() => import('./pages/RecordsPage'), 'RecordsPage');
const ArchiveAccessPage = pg(() => import('./pages/ArchiveAccessPage'), 'ArchiveAccessPage');
const InventoryPage = pg(() => import('./pages/InventoryPage'), 'InventoryPage');
const DisposalPage = pg(() => import('./pages/DisposalPage'), 'DisposalPage');
const RetentionPage = pg(() => import('./pages/RetentionPage'), 'RetentionPage');
const LegalReferencesPage = pg(() => import('./pages/LegalReferencesPage'), 'LegalReferencesPage');
const ComplianceCalendarPage = pg(() => import('./pages/ComplianceCalendarPage'), 'ComplianceCalendarPage');
const BackupsPage = pg(() => import('./pages/BackupsPage'), 'BackupsPage');
const TrainingPage = pg(() => import('./pages/TrainingPage'), 'TrainingPage');
const AuditsPage = pg(() => import('./pages/AuditsPage'), 'AuditsPage');
const ManagementReportsPage = pg(() => import('./pages/ManagementReportsPage'), 'ManagementReportsPage');
const AssetsPage = pg(() => import('./pages/AssetsPage'), 'AssetsPage');
const MovementsPage = pg(() => import('./pages/MovementsPage'), 'MovementsPage');
const AccessRegisterPage = pg(() => import('./pages/AccessRegisterPage'), 'AccessRegisterPage');
const IncidentsPage = pg(() => import('./pages/IncidentsPage'), 'IncidentsPage');
const CasesPage = pg(() => import('./pages/CasesPage'), 'CasesPage');
const CaseDetailPage = pg(() => import('./pages/CaseDetailPage'), 'CaseDetailPage');
const SupportChatsPage = pg(() => import('./pages/SupportChatsPage'), 'SupportChatsPage');
const NotFoundPage = pg(() => import('./pages/ErrorPages'), 'NotFoundPage');
const ReportsPage = pg(() => import('./pages/ReportsPage'), 'ReportsPage');
const ReportViewPage = pg(() => import('./pages/ReportViewPage'), 'ReportViewPage');

export default function App() {
  const { me, loading } = useAuth();

  if (loading) return <Center h="100dvh"><Loader /></Center>;

  if (!me) {
    return (
      <RouteBoundary><Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes></RouteBoundary>
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
        <Route path="/reports" element={guard(['report.view', 'report.receive'], <ReportsPage />)} />
        <Route path="/reports/:code" element={guard(['report.view', 'report.receive'], <ReportViewPage />)} />
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
