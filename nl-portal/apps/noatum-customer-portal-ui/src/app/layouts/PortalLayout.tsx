import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@/shared/layouts/app-shell';
import { Badge, Select } from '@/design-system';
import { Boxes, SlidersHorizontal, Table2 } from 'lucide-react';
import { workspaceMobileNavigation, workspaceNavigation } from '../navigation/navigation';

export function PortalLayout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const active = location.pathname.split('/').filter(Boolean)[0] ?? 'controls';
  const navigation = workspaceNavigation.map(({ id, icon: Icon }) => ({
    id,
    href: `/${id}`,
    label: t(id),
    mobileLabel: t(`mobile_${id}`),
    icon: <Icon aria-hidden="true" />,
    group: t('workspace'),
  }));
  return (
    <AppShell
      brand={<>{t('brand')}</>}
      utility={
        <>
          <span>{t('workspace')}</span>
          <div className="noa-utility-actions">
            <span>{t('development')}</span>
            <Select
              label={t('language')}
              labelHidden
              value={i18n.language}
              onValueChange={(value) => {
                void i18n.changeLanguage(value);
              }}
              options={[
                { value: 'en-US', label: t('english') },
                { value: 'es-ES', label: t('spanish') },
              ]}
            />
          </div>
        </>
      }
      actions={
        <span className="noa-workspace-version">
          <Badge>{t('version')}</Badge>
        </span>
      }
      moduleNavigation={
        <nav className="noa-module-links" aria-label={t('moduleNavigation')}>
          <NavLink to="/kit">
            <Boxes aria-hidden="true" />
            <span>{t('uiKit')}</span>
          </NavLink>
          <NavLink to="/controls">
            <SlidersHorizontal aria-hidden="true" />
            <span>{t('controls')}</span>
          </NavLink>
          <NavLink to="/listings">
            <Table2 aria-hidden="true" />
            <span>{t('listings')}</span>
          </NavLink>
        </nav>
      }
      context={t('group')}
      navigation={navigation}
      mobileNavigationIds={workspaceMobileNavigation}
      mobileNavigationLabel={t('mobileNavigation')}
      mobileMenuLabel={t('mobileMenu')}
      activeId={active}
      onNavigate={(id) => navigate(`/${id}`)}
      navigationLabel={t('navigation')}
      menuLabel={t('menu')}
      closeLabel={t('close')}
      skipLabel={t('skip')}
      collapseLabel={t('collapseMenu')}
      expandLabel={t('expandMenu')}
      footer={
        <>
          <span>{t('brand')}</span>
          <span>{t('development')}</span>
        </>
      }
    >
      <div className="noa-page-heading">
        <h1>{t(active)}</h1>
      </div>
      <Outlet />
    </AppShell>
  );
}
