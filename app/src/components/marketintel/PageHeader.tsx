// Migration shim. The Chakra implementation was replaced by the Tailwind one
// in components/ui/PageHeader.tsx; this file stays only so the ~13 pages that
// already import from here don't each need editing mid-migration. Props are
// identical. Delete this file and repoint those imports as part of the final
// Chakra removal.
export { PageHeader, default } from '@/components/ui/PageHeader';
export type { BreadcrumbItemDef } from '@/components/ui/PageHeader';
