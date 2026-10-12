import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, rmSync } from 'node:fs';

mkdirSync('data', { recursive: true });
rmSync('data/dashboard.db', { force: true });
const db = new DatabaseSync('data/dashboard.db');
db.exec(`CREATE TABLE daily_metrics (day TEXT NOT NULL, month TEXT NOT NULL, branch TEXT NOT NULL, revenue REAL NOT NULL, cost REAL NOT NULL, orders INTEGER NOT NULL, customers INTEGER NOT NULL)`);
const insert = db.prepare('INSERT INTO daily_metrics VALUES (?, ?, ?, ?, ?, ?, ?)');
const branches: Record<string, [number, number]> = { Bangkok: [9200, 6100], ChiangMai: [5800, 4000], Phuket: [7100, 4800] };
for (const month of ['2026-08', '2026-09']) for (const [branch, [baseRevenue, baseCost]] of Object.entries(branches)) {
  const multiplier = month === '2026-09' && branch === 'Bangkok' ? 0.82 : 1;
  for (let day = 1; day <= 28; day++) {
    const revenue = Math.round((baseRevenue + (day % 5) * 180) * multiplier);
    insert.run(`${month}-${String(day).padStart(2, '0')}`, month, branch, revenue, Math.round(baseCost * multiplier), Math.round(revenue / 120), Math.round(revenue / 310));
  }
}
db.close();
console.log('Seeded data/dashboard.db');
