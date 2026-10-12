import { AppProviders } from './providers';
import { CustomerRoutes, PortalRoutes, WorkspaceRoutes } from './router';

/**
 * Three trees, chosen by the path at mount:
 *
 *   /portal  the staff application, with its sidebar shell
 *   /app     the customer portal, with the website shell
 *   *        the component workspace, development only
 *
 * The choice is made once rather than reactively because the shells are
 * different applications that happen to share a bundle — moving between them is
 * a full navigation, not a route change.
 */
function routesForPath(pathname: string) {
  if (pathname.startsWith('/portal')) return <PortalRoutes />;
  if (pathname.startsWith('/app')) return <CustomerRoutes />;
  return <WorkspaceRoutes />;
}

export default function App() {
  return <AppProviders>{routesForPath(window.location.pathname)}</AppProviders>;
}
