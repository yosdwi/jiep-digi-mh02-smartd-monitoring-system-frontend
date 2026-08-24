// One-time ag-grid module registration + the shared theme, ported from the
// mockup's `agGrid.themeQuartz.withParams({...})` call (same params, same
// accent colour as the rest of the V4 chrome).
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

export const v4GridTheme = themeQuartz.withParams({
  spacing: 5,
  rowVerticalPaddingScale: 0.8,
  headerVerticalPaddingScale: 0.8,
  accentColor: '#287c94',
  backgroundColor: '#fff',
  foregroundColor: '#172033',
  headerBackgroundColor: '#f7f9fb',
  headerTextColor: '#475467',
  borderColor: '#dfe3e8',
  rowHoverColor: '#f6fafb',
  selectedRowBackgroundColor: '#edf7f9',
  fontSize: 12,
});

export const v4DefaultColDef = { sortable: true, resizable: true, suppressHeaderMenuButton: true };
