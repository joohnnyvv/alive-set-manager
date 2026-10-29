import type { DesktopApi } from '../../src/desktop/contracts.js';
declare global { interface Window { desktop?: DesktopApi; } }
