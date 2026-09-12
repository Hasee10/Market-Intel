// Migration shim - see components/marketintel/PageHeader.tsx for the
// rationale. Real implementation is now components/ui/InsightStrip.tsx
// (Tailwind). Each page's own insight *rules* (e.g. InsightBanner's
// computeTopInsight) were not touched - only this shared chrome moved.
export { InsightStrip, default } from '@/components/ui/InsightStrip';
export type { Insight, Tone } from '@/components/ui/InsightStrip';
