/**
 * 盛土監視Ops – MUI テーマ定義
 */
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#1565c0",
      light: "#5e92f3",
      dark: "#003c8f",
    },
    secondary: {
      main: "#ff6f00",
      light: "#ffa040",
      dark: "#c43e00",
    },
    error: { main: "#d32f2f" },
    warning: { main: "#ed6c02" },
    success: { main: "#2e7d32" },
    background: {
      default: "#f5f7fa",
      paper: "#ffffff",
    },
  },
  typography: {
    fontFamily: [
      "'Noto Sans JP'",
      "-apple-system",
      "BlinkMacSystemFont",
      "sans-serif",
    ].join(","),
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: "1px solid #e0e0e0" },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: { "& th": { fontWeight: 700, backgroundColor: "#f5f7fa" } },
      },
    },
  },
});

export default theme;
