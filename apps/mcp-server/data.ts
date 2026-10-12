import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const dbPath = resolve('data/dashboard.db');

export interface MonthOptions { month?: string; }
export interface BranchRevenue { branch: string; revenue: number; cost: number; orders: number; }
export interface DashboardSummary { month: string; revenue: number; cost: number; orders: number; customers: number; profit: number; byBranch: BranchRevenue[]; }
export interface RevenueAnomaly { branch: string; currentRevenue: number; previousRevenue: number; changePercent: number; }

function database() {
  mkdirSync(dirname(dbPath), { recursive: true });
  return new DatabaseSync(dbPath);
}

export function getDashboardSummary({ month = '2026-09' }: MonthOptions = {}): DashboardSummary {
  const db = database();
  try {
    const totals = db.prepare(`
      SELECT ROUND(SUM(revenue), 2) AS revenue, ROUND(SUM(cost), 2) AS cost,
             SUM(orders) AS orders, SUM(customers) AS customers
      FROM daily_metrics WHERE month = ?
    `).get(month) as { revenue: number; cost: number; orders: number; customers: number };
    const byBranch = db.prepare(`
      SELECT branch, ROUND(SUM(revenue), 2) AS revenue, ROUND(SUM(cost), 2) AS cost, SUM(orders) AS orders
      FROM daily_metrics WHERE month = ? GROUP BY branch ORDER BY revenue DESC
    `).all(month) as unknown as BranchRevenue[];
    if (!totals.revenue) throw new Error(`No data found for ${month}`);
    return { month, ...totals, profit: Number((totals.revenue - totals.cost).toFixed(2)), byBranch };
  } finally {
    db.close();
  }
}

export function getRevenueByBranch({ month = '2026-09' }: MonthOptions = {}): BranchRevenue[] {
  return getDashboardSummary({ month }).byBranch;
}

export function getAnomalies({ month = '2026-09' }: MonthOptions = {}): RevenueAnomaly[] {
  const previousMonth = month === '2026-09' ? '2026-08' : null;
  if (!previousMonth) return [];
  const db = database();
  try {
    return db.prepare(`
      SELECT current.branch, current.revenue AS currentRevenue, previous.revenue AS previousRevenue,
        ROUND((current.revenue - previous.revenue) * 100.0 / previous.revenue, 1) AS changePercent
      FROM (SELECT branch, SUM(revenue) revenue FROM daily_metrics WHERE month = ? GROUP BY branch) current
      JOIN (SELECT branch, SUM(revenue) revenue FROM daily_metrics WHERE month = ? GROUP BY branch) previous
        ON current.branch = previous.branch
      WHERE (current.revenue - previous.revenue) * 100.0 / previous.revenue <= -10
      ORDER BY changePercent
    `).all(month, previousMonth) as unknown as RevenueAnomaly[];
  } finally {
    db.close();
  }
}
