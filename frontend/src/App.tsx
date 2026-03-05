import React from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import SatelliteAltIcon from "@mui/icons-material/SatelliteAlt";
import DashboardIcon from "@mui/icons-material/Dashboard";
import MapIcon from "@mui/icons-material/Map";
import FilterListIcon from "@mui/icons-material/FilterList";
import FolderIcon from "@mui/icons-material/Folder";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SettingsIcon from "@mui/icons-material/Settings";

import theme from "./theme";
import DashboardPage from "./pages/dashboard/DashboardPage";
import MapPage from "./pages/map/MapPage";
import TriagePage from "./pages/triage/TriagePage";
import SiteDetailPage from "./pages/site-detail/SiteDetailPage";
import CasesPage from "./pages/cases/CasesPage";
import CaseDetailPage from "./pages/cases/CaseDetailPage";
import ReportsPage from "./pages/reports/ReportsPage";
import AdminPage from "./pages/admin/AdminPage";

const NAV_ITEMS = [
  { to: "/", label: "ダッシュボード", icon: <DashboardIcon fontSize="small" /> },
  { to: "/map", label: "地図", icon: <MapIcon fontSize="small" /> },
  { to: "/triage", label: "トリアージ", icon: <FilterListIcon fontSize="small" /> },
  { to: "/cases", label: "案件管理", icon: <FolderIcon fontSize="small" /> },
  { to: "/reports", label: "レポート", icon: <AssessmentIcon fontSize="small" /> },
  { to: "/admin", label: "管理", icon: <SettingsIcon fontSize="small" /> },
];

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          {/* AppBar */}
          <AppBar position="static" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
            <Toolbar>
              <SatelliteAltIcon sx={{ mr: 1.5 }} />
              <Typography variant="h6" noWrap component="div" sx={{ mr: 2 }}>
                盛土監視Ops
              </Typography>
              <Typography
                variant="body2"
                sx={{ opacity: 0.8, mr: 4, display: { xs: "none", md: "block" } }}
              >
                衛星データ × AI 監視運用ダッシュボード
              </Typography>

              {/* Nav links */}
              <Box sx={{ display: "flex", gap: 0.5 }}>
                {NAV_ITEMS.map((item) => (
                  <Button
                    key={item.to}
                    component={NavLink}
                    to={item.to}
                    end={item.to === "/"}
                    startIcon={item.icon}
                    sx={{
                      color: "rgba(255,255,255,0.85)",
                      "&.active": {
                        color: "#fff",
                        backgroundColor: "rgba(255,255,255,0.15)",
                      },
                      textTransform: "none",
                      minWidth: "auto",
                      px: 1.5,
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </Box>
            </Toolbar>
          </AppBar>

          {/* Main */}
          <Box component="main" sx={{ flex: 1, bgcolor: "background.default" }}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/triage" element={<TriagePage />} />
              <Route path="/sites/:id" element={<SiteDetailPage />} />
              <Route path="/cases" element={<CasesPage />} />
              <Route path="/cases/:id" element={<CaseDetailPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Box>

          {/* Footer */}
          <Box
            component="footer"
            sx={{
              py: 1.5,
              px: 3,
              bgcolor: "grey.100",
              borderTop: 1,
              borderColor: "divider",
              textAlign: "center",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              盛土監視Ops – 自治体向け盛土監視業務運用ダッシュボード
            </Typography>
          </Box>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

