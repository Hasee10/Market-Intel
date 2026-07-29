// Shared between Sidebar.tsx, AdminShell.tsx and NavbarAdmin.tsx so the
// content area and navbar always line up with the sidebar's actual width,
// collapsed or not - these three previously each hardcoded their own
// offset independently.
// Was 290px - noticeably wider than the nav labels/icons need, leaving a
// large dead margin on the right of every link. 240px keeps comfortable
// padding without the excess.
export const SIDEBAR_WIDTH_EXPANDED = 240;
export const SIDEBAR_WIDTH_COLLAPSED = 80;
