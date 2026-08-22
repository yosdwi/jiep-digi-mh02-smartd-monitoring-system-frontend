import React from 'react';
import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  Paper,
  Popper,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useLocation, useNavigate } from 'react-router-dom';
import { appNavigation, findActiveNavigation } from './navigation';

const drawerWidth = 64;

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeSection = findActiveNavigation(location.pathname);
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [activeFlyout, setActiveFlyout] = React.useState(null);
  const closeTimer = React.useRef(null);

  const flyoutSection = appNavigation.find((section) => section.key === activeFlyout);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openFlyout = (event, section) => {
    clearCloseTimer();
    setAnchorEl(event.currentTarget);
    setActiveFlyout(section.key);
  };

  const closeFlyout = () => {
    clearCloseTimer();
    setAnchorEl(null);
    setActiveFlyout(null);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(closeFlyout, 240);
  };

  React.useEffect(() => () => clearCloseTimer(), []);

  const go = (path) => {
    navigate(path);
    closeFlyout();
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        zIndex: 1750,
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          zIndex: 1750,
          width: drawerWidth,
          boxSizing: 'border-box',
          overflowX: 'hidden',
          background: 'linear-gradient(180deg, #334155 0%, #475569 100%)',
          borderRight: '1px solid rgba(203, 213, 225, 0.35)',
          color: '#e2e8f0',
        },
      }}
    >
      <Box sx={{ height: 64, flex: '0 0 64px' }} />
      <List sx={{ px: 0.75, py: 1.5 }}>
        {appNavigation.filter((section) => !section.disabled).map((section) => {
          const Icon = section.icon;
          const selected = activeSection.key === section.key || activeFlyout === section.key;
          return (
            <Tooltip key={section.key} title={section.label} placement="right">
              <ListItemButton
                selected={selected}
                onMouseEnter={(event) => openFlyout(event, section)}
                onMouseLeave={scheduleClose}
                onFocus={(event) => openFlyout(event, section)}
                onClick={() => go(section.path)}
                sx={{
                  height: 52,
                  minWidth: 0,
                  justifyContent: 'center',
                  borderRadius: '6px',
                  mb: 0.75,
                  px: 0,
                  color: selected ? '#ffffff' : '#cbd5e1',
                  background: selected ? 'rgba(5, 150, 105, 0.72)' : 'transparent',
                  '&:hover': {
                    background: selected ? 'rgba(5, 150, 105, 0.82)' : 'rgba(255, 255, 255, 0.1)',
                  },
                  '&.Mui-selected': {
                    background: 'rgba(5, 150, 105, 0.72)',
                  },
                  '&.Mui-selected:hover': {
                    background: 'rgba(5, 150, 105, 0.82)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, color: 'inherit', justifyContent: 'center' }}>
                  <Icon />
                </ListItemIcon>
              </ListItemButton>
            </Tooltip>
          );
        })}
      </List>

      <Popper
        open={Boolean(anchorEl && flyoutSection)}
        anchorEl={anchorEl}
        placement="right-start"
        modifiers={[{ name: 'offset', options: { offset: [6, 0] } }]}
        sx={{ zIndex: 1900 }}
      >
        {flyoutSection && (
          <Paper
            elevation={8}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
            sx={{
              width: 320,
              overflow: 'hidden',
              borderRadius: '6px',
              border: '1px solid rgba(203, 213, 225, 0.8)',
            }}
          >
            <Box sx={{ px: 2, py: 1.5, background: '#f8fafc' }}>
              <Typography sx={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b' }}>
                Quick Navigation
              </Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                {flyoutSection.label}
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ py: 1 }}>
              {flyoutSection.items.map((item) => {
                const ItemIcon = item.icon;
                const selected = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                return (
                  <Box
                    key={item.path}
                    onClick={() => go(item.path)}
                    sx={{
                      mx: 1,
                      px: 1.25,
                      py: 1,
                      borderRadius: '5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      color: selected ? '#0f766e' : '#334155',
                      background: selected ? '#ecfdf5' : 'transparent',
                      '&:hover': { background: selected ? '#d1fae5' : '#f1f5f9' },
                    }}
                  >
                    <Box sx={{ width: 24, display: 'flex', justifyContent: 'center', color: selected ? '#0f766e' : '#64748b' }}>
                      {ItemIcon ? <ItemIcon sx={{ fontSize: 18 }} /> : <ChevronRightIcon sx={{ fontSize: 18 }} />}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: selected ? 700 : 600 }}>
                        {item.label}
                      </Typography>
                      {item.description && (
                        <Typography noWrap sx={{ fontSize: 11, color: '#64748b' }}>
                          {item.description}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        )}
      </Popper>
    </Drawer>
  );
};

export default Sidebar;
