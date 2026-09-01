// Migration shim - see components/marketintel/PageHeader.tsx for the
// rationale. Real implementation is now components/ui/StatsGrid.tsx
// (Tailwind); props and the StatItem shape are unchanged.
export { StatsGrid, default } from '@/components/ui/StatsGrid';
export type { StatItem } from '@/components/ui/StatsGrid';
