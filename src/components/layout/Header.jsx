import React from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Popper,
  Toolbar,
  Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useLocation, useNavigate } from 'react-router-dom';
import useUserStore from '../../stores/userStore';
import { appNavigation, findActiveNavigation } from './navigation';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeSection = findActiveNavigation(location.pathname);
  const userInfo = useUserStore((state) => state.profile);
  const [menuAnchor, setMenuAnchor] = React.useState(null);
  const [menuSection, setMenuSection] = React.useState(null);
  const [profileAnchor, setProfileAnchor] = React.useState(null);
  const closeTimer = React.useRef(null);

  const openProfileMenu = Boolean(profileAnchor);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const handleMenuOpen = (event, section) => {
    clearCloseTimer();
    setMenuAnchor(event.currentTarget);
    setMenuSection(section);
  };

  const handleMenuClose = () => {
    clearCloseTimer();
    setMenuAnchor(null);
    setMenuSection(null);
  };

  const scheduleMenuClose = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(handleMenuClose, 240);
  };

  React.useEffect(() => () => clearCloseTimer(), []);

  const handleNavigate = (path) => {
    navigate(path);
    handleMenuClose();
  };

  const handleLogout = () => {
    window.location.href = 'http://smartd-mh02.apps.pamapersada.net/Logout';
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: 1800,
        background: 'linear-gradient(135deg, #334155 0%, #475569 100%)',
        borderBottom: '1px solid #64748b',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.15)',
      }}
    >
      <Toolbar sx={{ minHeight: '64px !important', gap: 2, px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mr: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '3px solid rgba(248, 250, 252, 0.9)',
              borderLeftColor: 'transparent',
            }}
          />
          <Typography sx={{ fontWeight: 800, letterSpacing: 0.8, color: '#f8fafc' }}>
            SMARTD
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'stretch', alignSelf: 'stretch' }}>
          {appNavigation.filter((section) => !section.disabled).map((section) => {
            const Icon = section.icon;
            const active = activeSection.key === section.key;
            return (
              <Button
                key={section.key}
                onMouseEnter={(event) => handleMenuOpen(event, section)}
                onMouseLeave={scheduleMenuClose}
                onFocus={(event) => handleMenuOpen(event, section)}
                onClick={() => navigate(section.path)}
                startIcon={<Icon />}
                endIcon={<KeyboardArrowDownIcon />}
                sx={{
                  px: 2.25,
                  borderRadius: 0,
                  color: active ? '#ffffff' : '#d6dee7',
                  background: active ? 'rgba(5, 150, 105, 0.72)' : 'transparent',
                  fontWeight: active ? 700 : 500,
                  '&:hover': {
                    background: active ? 'rgba(5, 150, 105, 0.82)' : 'rgba(255, 255, 255, 0.08)',
                  },
                }}
              >
                {section.label}
              </Button>
            );
          })}
        </Box>

        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton color="inherit" title="Notifikasi">
            <NotificationsNoneIcon />
          </IconButton>
          <Button
            onClick={(event) => setProfileAnchor(event.currentTarget)}
            sx={{ color: '#f8fafc', textTransform: 'none', gap: 1, px: 1 }}
          >
            <Avatar sx={{ width: 34, height: 34, bgcolor: '#e2e8f0', color: '#475569', fontWeight: 700 }}>
              {(userInfo?.nama || '').split(' ').map((n) => n.charAt(0)).join('').toUpperCase().slice(0, 2) || 'AS'}
            </Avatar>
            <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'left' }}>
              <Typography sx={{ fontSize: 13, lineHeight: 1.15, fontWeight: 700 }}>
                {userInfo?.nama || 'Administrator'}
              </Typography>
              <Typography sx={{ fontSize: 11, lineHeight: 1.15, color: '#cbd5e1' }}>
                {userInfo?.role || 'JIEP'} · {userInfo?.distrik || 'JIEP'}
              </Typography>
            </Box>
          </Button>
        </Box>
      </Toolbar>

      <Popper
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor && menuSection)}
        placement="bottom-start"
        disablePortal
        modifiers={[{ name: 'offset', options: { offset: [0, 0] } }]}
        sx={{ zIndex: 1900 }}
      >
        {menuSection && (
          <Paper
            elevation={8}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleMenuClose}
            sx={{ minWidth: 270, borderRadius: '6px', overflow: 'hidden' }}
          >
            <Box sx={{ py: 0.75 }}>
              {menuSection.items.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <Box
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    sx={{
                      px: 1.5,
                      py: 1.1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      cursor: 'pointer',
                      '&:hover': { background: '#f1f5f9' },
                    }}
                  >
                    {ItemIcon && <ItemIcon sx={{ fontSize: 18, color: '#64748b' }} />}
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{item.label}</Typography>
                      {item.description && (
                        <Typography sx={{ fontSize: 11, color: '#64748b' }}>{item.description}</Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        )}
      </Popper>

      <Box
        onMouseEnter={clearCloseTimer}
        onMouseLeave={scheduleMenuClose}
        sx={{
          position: 'fixed',
          top: 60,
          left: 0,
          right: 0,
          height: 16,
          zIndex: 1899,
          display: menuAnchor ? 'block' : 'none',
        }}
      />

      <Menu
        anchorEl={profileAnchor}
        open={openProfileMenu}
        onClose={() => setProfileAnchor(null)}
        PaperProps={{ sx: { minWidth: 180, mt: 0.75, borderRadius: '6px' } }}
      >
        <MenuItem onClick={() => setProfileAnchor(null)}>Profil Saya</MenuItem>
        <MenuItem onClick={handleLogout}>Logout</MenuItem>
      </Menu>
    </AppBar>
  );
};

export default Header;
