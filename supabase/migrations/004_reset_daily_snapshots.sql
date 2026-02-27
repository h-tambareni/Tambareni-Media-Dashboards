-- Reset daily snapshots to clear incorrect historical data
-- (API calc was wrong; chart now shows daily growth from td to tmtr)
TRUNCATE daily_snapshots;
