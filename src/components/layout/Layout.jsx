import React from 'react';
import { Box, CssBaseline, Toolbar, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { getBreadcrumb } from './navigation';

export const BreadcrumbActionsContext = React.createContext(() => {});

const BreadcrumbBar = ({ breadcrumb, action }) => (
  <Box
    sx={{
      flex: '0 0 52px',
      display: 'flex',
      alignItems: 'center',
      gap: 1.25,
      px: 2,
      background: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
      minWidth: 0,
    }}
  >
    <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
      {breadcrumb.section}
    </Typography>
    <Typography sx={{ fontSize: 18, color: '#94a3b8' }}>/</Typography>
    <Typography sx={{ fontSize: 15, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
      {breadcrumb.item}
    </Typography>
    <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      {action}
    </Box>
  </Box>
);

const Layout = ({ children }) => {
  const location = useLocation();
  const isMirRoute = location.pathname.startsWith('/mir/');
  const breadcrumb = getBreadcrumb(location.pathname);
  const [breadcrumbAction, setBreadcrumbAction] = React.useState(null);

  React.useEffect(() => {
    setBreadcrumbAction(null);
  }, [location.pathname]);

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <Header />
      <Sidebar />
      <BreadcrumbActionsContext.Provider value={setBreadcrumbAction}>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          height: 'calc(100vh * var(--app-scale-inverse, 1))',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <Toolbar />
        <BreadcrumbBar breadcrumb={breadcrumb} action={breadcrumbAction} />
        <Box 
          sx={{ 
            flexGrow: 1,
            p: isMirRoute ? 0 : 2,
            position: 'relative',
            display: 'flex',
            minWidth: 0,
            minHeight: 0,
            background: '#f8fafc',
          }}
        >
          {children}
        </Box>
      </Box>
      </BreadcrumbActionsContext.Provider>
    </Box>
  );
};

export default Layout;
