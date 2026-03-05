import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock API calls
jest.mock('./api/morido', () => ({
  fetchDashboardSummary: () =>
    Promise.resolve({
      new_sites_count: 5,
      high_risk_count: 2,
      field_check_pending_count: 3,
      stale_cases_count: 1,
      completion_rate: 30.0,
      false_positive_count: 4,
      status_breakdown: {},
      region_breakdown: {},
    }),
}));

test('renders app header', () => {
  render(<App />);
  const heading = screen.getByText(/盛土監視Ops/i);
  expect(heading).toBeInTheDocument();
});

test('renders navigation links', () => {
  render(<App />);
  expect(screen.getByText('ダッシュボード')).toBeInTheDocument();
  expect(screen.getByText('トリアージ')).toBeInTheDocument();
  expect(screen.getByText('案件管理')).toBeInTheDocument();
  expect(screen.getByText('レポート')).toBeInTheDocument();
  expect(screen.getByText('管理')).toBeInTheDocument();
});
