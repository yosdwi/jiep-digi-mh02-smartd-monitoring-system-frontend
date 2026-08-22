import AnalyticsIcon from '@mui/icons-material/Analytics';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import RouteIcon from '@mui/icons-material/Route';
import SpeedIcon from '@mui/icons-material/Speed';
import StorageIcon from '@mui/icons-material/Storage';
import TimerIcon from '@mui/icons-material/Timer';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';

export const appNavigation = [
  {
    key: 'live',
    label: 'Live',
    path: '/live-tracking/live-unit',
    icon: MyLocationIcon,
    items: [
      { label: 'Live Unit', path: '/live-tracking/live-unit', description: 'Realtime DT/EX tracking' },
    ],
  },
  {
    key: 'playback',
    label: 'Playback',
    path: '/playback/underspeed',
    icon: AnalyticsIcon,
    items: [
      { label: 'Under Speed', path: '/playback/underspeed', icon: SpeedIcon },
      { label: 'Cycle Time', path: '/playback/cycle-time', icon: RouteIcon },
      { label: 'Durasi Pit Stop', path: '/playback/leadtime', icon: TimerIcon },
      { label: 'Datalog Record', path: '/playback/datalog-record', icon: StorageIcon },
      { label: 'RTK Quality', path: '/playback/rtk-quality', icon: GpsFixedIcon },
    ],
  },
];

export function findActiveNavigation(pathname) {
  return appNavigation.find((section) => (
    pathname === section.path ||
    pathname.startsWith(`${section.path}/`) ||
    section.items.some((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
  )) || appNavigation[0];
}

export function getBreadcrumb(pathname) {
  const section = findActiveNavigation(pathname);
  const item = section.items.find((entry) => pathname === entry.path || pathname.startsWith(`${entry.path}/`));
  return {
    section: section.label,
    item: item?.label || section.label,
  };
}
