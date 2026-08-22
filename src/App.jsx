import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Peta from './pages/Peta'; // The generic map page
import UnderspeedPeta from './pages/UnderspeedPeta'; // The specialized underspeed page
import CycleTimePeta from './pages/CycleTimePeta';
import CycleTimePetaV2 from './pages/CycleTimePetaV2'; // PoC: lite map (no maplibre), memoized re-render fixes
import DatalogRecord from './pages/DatalogRecord';
import RTKQuality from './pages/RTKQuality';
import DurasiPitStopPeta from './pages/DurasiPitStopPeta';
import MIRMovementPeta from './pages/MIRMovementPeta';
import LiveUnitPeta from './pages/LiveUnitPeta';
import LiveUnitMirPeta from './pages/LiveUnitMirPeta'; // <-- IMPORT BARU
import MIRPeta from './pages/MIRPeta'; // Layar Operasi MIR (alert layer)
import MIRGeofence from './pages/MIRGeofence'; // Mockup UX geofence MIR
import MIRDevices from './pages/MIRDevices'; // Layar Perangkat MIR (roster + workspace)
import MIRFirmware from './pages/MIRFirmware'; // Layar Firmware MIR (OTA per-type)
import MIRHealth from './pages/MIRHealth'; // Layar Kesehatan Sistem MIR (pipeline + delivery)
import MIRAlerts from './pages/MIRAlerts'; // Layar Peringatan MIR (triage queue NOC)
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import DeviceServiceManagement from './pages/DeviceServiceManagement'; // Menu ber-gate: kelola service device
import V3Routes from './v3/V3Routes'; // V3: shell + map workspace sendiri, di luar Layout lama
import useUserStore from './stores/userStore';

function App() {
  const fetchProfile = useUserStore((state) => state.fetchProfile);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return (
    <Router basename="/Monitoring">
      <Routes>
        {/* V3 mounts its own shell (rail + context bar + map workspace), so it
            sits OUTSIDE the legacy <Layout> rather than inside it. Additive:
            nothing below this route changed. */}
        <Route path="/v3/*" element={<V3Routes />} />

        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                {/* Default route redirects to live-tracking */}
                <Route path="/" element={<Navigate to="/live-tracking/live-unit" replace />} />

                {/* New Routes */}
                <Route path="/live-tracking/live-unit" element={<LiveUnitPeta />} />
                <Route path="/live-tracking/mir" element={<LiveUnitMirPeta />} /> {/* <-- RUTE DIPERBARUI */}
                <Route path="/playback/underspeed" element={<UnderspeedPeta />} />
                <Route path="/playback/cycle-time" element={<CycleTimePeta />} />
                <Route path="/playback/cycle-time-v2" element={<CycleTimePetaV2 />} />
                <Route path="/playback/leadtime" element={<DurasiPitStopPeta />} />
                <Route path="/playback/datalog-record" element={<DatalogRecord />} />
                <Route path="/playback/rtk-quality" element={<RTKQuality />} />
                <Route path="/playback/mir" element={<MIRMovementPeta />} />
                <Route path="/intervensi/mir" element={<Peta />} />

                {/* MIR Routes */}
                <Route path="/mir/operasi" element={<MIRPeta />} />
                <Route path="/mir/peringatan" element={<MIRAlerts />} />
                <Route path="/mir/geofence" element={<MIRGeofence />} />
                <Route path="/mir/perangkat" element={<MIRDevices />} />
                <Route path="/mir/firmware" element={<MIRFirmware />} />
                <Route path="/mir/kesehatan" element={<MIRHealth />} />

                {/* Device Service Management (menu ber-gate) */}
                <Route path="/device-service-management" element={<DeviceServiceManagement />} />

                {/* Static Routes */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
