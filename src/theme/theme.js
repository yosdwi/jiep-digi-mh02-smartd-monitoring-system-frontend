import { createTheme } from '@mui/material/styles';

// Sophisticated Fleet Management Theme - Professional & Elegant
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1e40af',        // Deep professional blue
      light: '#3b82f6',       // Medium blue for accents
      dark: '#1e3a8a',        // Navy blue for depth
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#059669',        // Sophisticated emerald
      light: '#10b981',       // Fresh green accent
      dark: '#047857',        // Deep forest green
      contrastText: '#ffffff',
    },
    background: {
      default: '#f8fafc',     // Very subtle blue-grey undertone
      paper: '#ffffff',       // Pure white for maximum contrast on cards
      secondary: '#f1f5f9',   // Soft grey-blue for panels
      tertiary: '#e2e8f0',    // Medium grey for contrast areas
      accent: '#f0f9ff',      // Very light blue for special areas
    },
    text: {
      primary: '#0f172a',     // Rich dark slate - maximum readability
      secondary: '#334155',   // Dark grey for secondary content
      disabled: '#64748b',    // Medium slate for disabled
    },
    divider: '#cbd5e1',       // Elegant slate divider
    grey: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    success: {
      main: '#10b981',        // Modern emerald green
      light: '#34d399',
      dark: '#059669',
    },
    warning: {
      main: '#f59e0b',        // Warm amber
      light: '#fbbf24',
      dark: '#d97706',
    },
    error: {
      main: '#ef4444',        // Modern red
      light: '#f87171',
      dark: '#dc2626',
    },
    info: {
      main: '#3b82f6',        // Consistent with primary blue
      light: '#60a5fa',
      dark: '#2563eb',
    },
  },
  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
      lineHeight: 1.2,
    },
    h2: {
      fontWeight: 700,
      fontSize: '2rem',
      lineHeight: 1.3,
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
      lineHeight: 1.3,
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
      lineHeight: 1.4,
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.4,
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.125rem',
      lineHeight: 1.4,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
      fontWeight: 400,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.43,
      fontWeight: 400,
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.66,
      fontWeight: 400,
    },
    button: {
      fontWeight: 500,
      fontSize: '0.875rem',
      textTransform: 'none',
      letterSpacing: '0.02em',
    },
  },
  spacing: 8, // Base spacing unit
  shape: {
    borderRadius: 8, // Consistent border radius
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #334155 0%, #475569 100%)',
          color: '#f8fafc',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.15)',
          borderBottom: '1px solid #64748b',
          backdropFilter: 'blur(10px)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: `
            linear-gradient(180deg,
              rgba(248, 250, 252, 0.95) 0%,
              rgba(241, 245, 249, 0.95) 50%,
              rgba(226, 232, 240, 0.95) 100%
            )
          `,
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(203, 213, 225, 0.8)',
          boxShadow: `
            4px 0 32px rgba(15, 23, 42, 0.08),
            4px 0 16px rgba(30, 64, 175, 0.04),
            inset -1px 0 0 rgba(255, 255, 255, 0.1)
          `,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '60px',
            background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.03) 0%, rgba(5, 150, 105, 0.02) 100%)',
            borderBottom: '1px solid rgba(203, 213, 225, 0.3)',
          }
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.95rem',
          letterSpacing: '0.02em',
          padding: '10px 24px',
          boxShadow: 'none',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',

          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
            transition: 'left 0.6s ease',
            zIndex: 1,
          },

          '&:hover::before': {
            left: '100%',
          },

          '& .MuiButton-startIcon': {
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          },

          '&:hover .MuiButton-startIcon': {
            transform: 'scale(1.1) rotate(5deg)',
          }
        },

        contained: {
          background: 'linear-gradient(135deg, #1e40af 0%, #059669 100%)',
          boxShadow: '0 4px 16px rgba(30, 64, 175, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.1)',

          '&:hover': {
            background: 'linear-gradient(135deg, #1d4ed8 0%, #047857 100%)',
            transform: 'translateY(-2px) scale(1.05)',
            boxShadow: `
              0 8px 25px rgba(30, 64, 175, 0.3),
              0 4px 12px rgba(5, 150, 105, 0.2)
            `,
          },

          '&:active': {
            transform: 'translateY(0) scale(1.02)',
          }
        },

        outlined: {
          background: 'rgba(248, 250, 252, 0.8)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(203, 213, 225, 0.4)',
          color: '#1e293b',

          '&:hover': {
            background: 'rgba(255, 255, 255, 0.9)',
            borderColor: 'rgba(30, 64, 175, 0.3)',
            transform: 'translateY(-1px) scale(1.02)',
            boxShadow: '0 4px 12px rgba(30, 64, 175, 0.08)',
          }
        },

        text: {
          color: '#475569',

          '&:hover': {
            backgroundColor: 'rgba(30, 64, 175, 0.05)',
            color: '#1e40af',
          }
        }
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          borderRadius: 12,
          border: '1px solid #e0e4e7',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
        },
        elevation1: {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        },
        elevation2: {
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
        },
        elevation3: {
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          paddingTop: 8,
          paddingBottom: 8,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 8px',
          '&:hover': {
            backgroundColor: '#f5f7fa',
          },
          '&.Mui-selected': {
            backgroundColor: '#e3f2fd',
            '&:hover': {
              backgroundColor: '#bbdefb',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          fontWeight: 500,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
  },
  shadows: [
    'none',
    '0 2px 4px rgba(0, 0, 0, 0.1)',
    '0 2px 8px rgba(0, 0, 0, 0.1)',
    '0 4px 16px rgba(0, 0, 0, 0.1)',
    '0 8px 24px rgba(0, 0, 0, 0.15)',
    '0 12px 32px rgba(0, 0, 0, 0.15)',
    '0 16px 40px rgba(0, 0, 0, 0.2)',
    '0 20px 48px rgba(0, 0, 0, 0.2)',
    '0 24px 56px rgba(0, 0, 0, 0.25)',
    '0 28px 64px rgba(0, 0, 0, 0.25)',
    '0 32px 72px rgba(0, 0, 0, 0.3)',
    '0 36px 80px rgba(0, 0, 0, 0.3)',
    '0 40px 88px rgba(0, 0, 0, 0.35)',
    '0 44px 96px rgba(0, 0, 0, 0.35)',
    '0 48px 104px rgba(0, 0, 0, 0.4)',
    '0 52px 112px rgba(0, 0, 0, 0.4)',
    '0 56px 120px rgba(0, 0, 0, 0.45)',
    '0 60px 128px rgba(0, 0, 0, 0.45)',
    '0 64px 136px rgba(0, 0, 0, 0.5)',
    '0 68px 144px rgba(0, 0, 0, 0.5)',
    '0 72px 152px rgba(0, 0, 0, 0.55)',
    '0 76px 160px rgba(0, 0, 0, 0.55)',
    '0 80px 168px rgba(0, 0, 0, 0.6)',
    '0 84px 176px rgba(0, 0, 0, 0.6)',
    '0 88px 184px rgba(0, 0, 0, 0.65)',
  ],
});

export default theme;
