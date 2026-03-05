import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./components/ISSTracker', () => () => <div data-testid="iss-tracker">ISSトラッカー</div>);
jest.mock('./components/APODViewer', () => () => <div data-testid="apod-viewer">宇宙写真</div>);
jest.mock('./components/EarthEvents', () => () => <div data-testid="earth-events">地球イベント</div>);

test('renders app header', () => {
  render(<App />);
  const heading = screen.getByText(/衛星データ分析アプリケーション/i);
  expect(heading).toBeInTheDocument();
});

test('renders tab navigation buttons', () => {
  render(<App />);
  const tabButtons = screen.getAllByRole('button');
  const tabTexts = tabButtons.map((btn) => btn.textContent || '');
  expect(tabTexts.some((t) => t.includes('ISSトラッカー'))).toBe(true);
  expect(tabTexts.some((t) => t.includes('宇宙写真'))).toBe(true);
  expect(tabTexts.some((t) => t.includes('地球イベント'))).toBe(true);
});

test('shows ISS tracker by default', () => {
  render(<App />);
  expect(screen.getByTestId('iss-tracker')).toBeInTheDocument();
});
