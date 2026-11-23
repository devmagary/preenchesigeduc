export const SHADOW_STYLES = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;
  color: #0f172a;
  font-size: 14px;
  line-height: 1.4;
}

*, *::before, *::after {
  box-sizing: border-box;
}

.ps-fab {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483640;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 10px 16px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #404E82 0%, #27325B 100%);
  color: #ffffff;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.ps-fab:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.34);
}

.ps-fab-badge {
  background: #10b981;
  color: #052e16;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.ps-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 2147483641;
  display: none;
}

.ps-backdrop.open {
  display: block;
}

.ps-drawer {
  --ps-scale: 1;
  --ps-bg: #f8fafc;
  --ps-card-bg: #ffffff;
  --ps-border: #cbd5e1;
  --ps-soft-border: #e2e8f0;
  --ps-text: #0f172a;
  --ps-label: #334155;
  --ps-muted: #475569;
  --ps-input-bg: #ffffff;
  --ps-input-border: #94a3b8;
  --ps-tabs-bg: #e2e8f0;
  --ps-tab-text: #334155;
  --ps-tab-active-bg: #ffffff;
  --ps-tab-active-text: #1e293b;
  --ps-stat-bg: #f8fafc;
  --ps-sec-btn-bg: #e2e8f0;
  --ps-sec-btn-text: #1e293b;
  --ps-th-bg: #f1f5f9;
  --ps-th-text: #334155;
  --ps-ok-text: #047857;
  --ps-warn-text: #b45309;
  --ps-bad-text: #b91c1c;
  --ps-info-bg: #eff6ff;
  --ps-info-bd: #bfdbfe;
  --ps-info-tx: #1e3a8a;
  --ps-warn-bg: #fffbeb;
  --ps-warn-bd: #fde68a;
  --ps-warn-tx: #92400e;
  --ps-err-bg: #fef2f2;
  --ps-err-bd: #fecaca;
  --ps-err-tx: #991b1b;
  --ps-ok-bg: #ecfdf5;
  --ps-ok-bd: #a7f3d0;
  --ps-ok-tx: #065f46;
  --ps-pill-ok-bg: #d1fae5;
  --ps-pill-ok-tx: #065f46;
  --ps-pill-warn-bg: #fef3c7;
  --ps-pill-warn-tx: #92400e;
  --ps-pill-bad-bg: #fee2e2;
  --ps-pill-bad-tx: #991b1b;
  --ps-track-bg: #e2e8f0;
  --ps-thumb-bg: #64748b;

  position: fixed;
  top: 0;
  right: 0;
  width: 440px;
  max-width: 100%;
  height: 100dvh;
  z-index: 2147483642;
  background: var(--ps-bg);
  color: var(--ps-text);
  font-size: calc(14px * var(--ps-scale));
  display: none;
  flex-direction: column;
  box-shadow: -8px 0 32px rgba(15, 23, 42, 0.28);
  border-left: 1px solid var(--ps-border);
  overflow: hidden;
}

.ps-drawer.ps-scale-100 { --ps-scale: 1; }
.ps-drawer.ps-scale-112 { --ps-scale: 1.12; }
.ps-drawer.ps-scale-125 { --ps-scale: 1.25; }

.ps-drawer.ps-dark {
  --ps-bg: #0f172a;
  --ps-card-bg: #1e293b;
  --ps-border: #334155;
  --ps-soft-border: #334155;
  --ps-text: #f1f5f9;
  --ps-label: #e2e8f0;
  --ps-muted: #cbd5e1;
  --ps-input-bg: #0f172a;
  --ps-input-border: #475569;
  --ps-tabs-bg: #1e293b;
  --ps-tab-text: #cbd5e1;
  --ps-tab-active-bg: #334155;
  --ps-tab-active-text: #ffffff;
  --ps-stat-bg: #0f172a;
  --ps-sec-btn-bg: #334155;
  --ps-sec-btn-text: #f8fafc;
  --ps-th-bg: #0f172a;
  --ps-th-text: #e2e8f0;
  --ps-ok-text: #34d399;
  --ps-warn-text: #fbbf24;
  --ps-bad-text: #f87171;
  --ps-info-bg: #172554;
  --ps-info-bd: #1d4ed8;
  --ps-info-tx: #dbeafe;
  --ps-warn-bg: #451a03;
  --ps-warn-bd: #b45309;
  --ps-warn-tx: #fef3c7;
  --ps-err-bg: #450a0a;
  --ps-err-bd: #b91c1c;
  --ps-err-tx: #fee2e2;
  --ps-ok-bg: #064e3b;
  --ps-ok-bd: #059669;
  --ps-ok-tx: #d1fae5;
  --ps-pill-ok-bg: #065f46;
  --ps-pill-ok-tx: #ecfdf5;
  --ps-pill-warn-bg: #92400e;
  --ps-pill-warn-tx: #fef3c7;
  --ps-pill-bad-bg: #991b1b;
  --ps-pill-bad-tx: #fee2e2;
  --ps-track-bg: #1e293b;
  --ps-thumb-bg: #64748b;
}

.ps-drawer.open {
  display: flex;
}

@media (max-width: 640px) {
  .ps-fab {
    right: 12px;
    bottom: 12px;
    padding: 10px 14px;
  }

  .ps-drawer {
    inset: 0;
    width: 100%;
    height: 100dvh;
    border-left: 0;
    border-top: 0;
    border-radius: 0;
    box-shadow: none;
  }
}

.ps-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  background: #404E82;
  color: #ffffff;
  flex-shrink: 0;
}

.ps-drawer.ps-dark .ps-header {
  background: #1e293b;
  border-bottom: 1px solid #334155;
}

.ps-header-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.ps-header-title strong {
  font-size: calc(15px * var(--ps-scale));
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ps-header-sub {
  font-size: calc(12px * var(--ps-scale));
  color: #dbeafe;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ps-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.ps-icon-btn {
  min-width: 44px;
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ps-icon-btn.close-glyph {
  font-size: 20px;
}

.ps-icon-btn:hover {
  background: rgba(255, 255, 255, 0.28);
}

.ps-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: var(--ps-tabs-bg);
  padding: 4px;
  gap: 4px;
  flex-shrink: 0;
}

.ps-tab {
  min-height: 44px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ps-tab-text);
  font-family: inherit;
  font-size: calc(13px * var(--ps-scale));
  font-weight: 600;
  cursor: pointer;
  padding: 6px 6px;
}

.ps-tab.active {
  background: var(--ps-tab-active-bg);
  color: var(--ps-tab-active-text);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.14);
}

.ps-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scrollbar-width: thin;
  scrollbar-color: var(--ps-thumb-bg) var(--ps-track-bg);
}

.ps-body::-webkit-scrollbar {
  width: 8px;
}

.ps-body::-webkit-scrollbar-track {
  background: var(--ps-track-bg);
}

.ps-body::-webkit-scrollbar-thumb {
  background: var(--ps-thumb-bg);
  border-radius: 999px;
}

.ps-file-input-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.ps-file-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px dashed var(--ps-input-border);
  border-radius: 9px;
  background: var(--ps-stat-bg);
  color: var(--ps-text);
  font-size: calc(13px * var(--ps-scale));
  font-weight: 600;
  cursor: pointer;
}

.ps-file-btn:hover {
  border-color: #6366f1;
}

.ps-compact-details summary {
  cursor: pointer;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: calc(13px * var(--ps-scale));
  font-weight: 700;
  color: var(--ps-text);
  list-style: none;
}

.ps-compact-details summary::after {
  content: '▾';
  font-size: 12px;
  color: var(--ps-muted);
  flex-shrink: 0;
}

.ps-compact-details[open] summary::after {
  content: '▴';
}

.ps-card {
  background: var(--ps-card-bg);
  border: 1px solid var(--ps-border);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ps-card-title {
  font-size: calc(13px * var(--ps-scale));
  font-weight: 700;
  color: var(--ps-text);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin: 0;
}

.ps-banner {
  padding: 10px 12px;
  border-radius: 10px;
  font-size: calc(13px * var(--ps-scale));
  border: 1px solid transparent;
  overflow-wrap: anywhere;
}

.ps-banner.info {
  background: var(--ps-info-bg);
  border-color: var(--ps-info-bd);
  color: var(--ps-info-tx);
}

.ps-banner.warn {
  background: var(--ps-warn-bg);
  border-color: var(--ps-warn-bd);
  color: var(--ps-warn-tx);
}

.ps-banner.error {
  background: var(--ps-err-bg);
  border-color: var(--ps-err-bd);
  color: var(--ps-err-tx);
}

.ps-banner.success {
  background: var(--ps-ok-bg);
  border-color: var(--ps-ok-bd);
  color: var(--ps-ok-tx);
}

.ps-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ps-label {
  font-size: calc(12px * var(--ps-scale));
  font-weight: 600;
  color: var(--ps-label);
}

.ps-input, .ps-select, .ps-textarea {
  width: 100%;
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid var(--ps-input-border);
  border-radius: 8px;
  background: var(--ps-input-bg);
  color: var(--ps-text);
  font-family: inherit;
  font-size: calc(14px * var(--ps-scale));
}

.ps-textarea {
  min-height: 82px;
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: calc(12px * var(--ps-scale));
}

@media (max-width: 640px) {
  .ps-input, .ps-select, .ps-textarea {
    font-size: max(16px, calc(14px * var(--ps-scale)));
  }
}

.ps-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.ps-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.ps-btn {
  min-height: 44px;
  padding: 10px 14px;
  border: 0;
  border-radius: 9px;
  font-family: inherit;
  font-size: calc(14px * var(--ps-scale));
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: opacity 0.12s ease;
  text-align: center;
}

.ps-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.ps-btn-primary {
  background: #404E82;
  color: #ffffff;
}

.ps-drawer.ps-dark .ps-btn-primary {
  background: #4f46e5;
}

.ps-btn-success {
  background: #047857;
  color: #ffffff;
}

.ps-btn-danger {
  background: #b91c1c;
  color: #ffffff;
}

.ps-btn-secondary {
  background: var(--ps-sec-btn-bg);
  color: var(--ps-sec-btn-text);
}

.ps-btn-block {
  width: 100%;
}

.ps-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.ps-stat {
  border: 1px solid var(--ps-soft-border);
  border-radius: 9px;
  padding: 8px 10px;
  background: var(--ps-stat-bg);
}

.ps-stat strong {
  display: block;
  font-size: calc(18px * var(--ps-scale));
  line-height: 1.2;
}

.ps-stat span {
  font-size: calc(11px * var(--ps-scale));
  color: var(--ps-muted);
  font-weight: 600;
}

.ps-stat.ok strong { color: var(--ps-ok-text); }
.ps-stat.warn strong { color: var(--ps-warn-text); }
.ps-stat.bad strong { color: var(--ps-bad-text); }

.ps-progress-wrap {
  width: 100%;
  background: var(--ps-track-bg);
  border-radius: 999px;
  height: 10px;
  overflow: hidden;
}

.ps-progress-bar {
  height: 100%;
  background: #10b981;
  width: 0%;
  transition: width 0.15s ease;
}

.ps-check-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  height: auto;
  flex-shrink: 0;
  padding: 8px 10px;
  border: 1px solid var(--ps-soft-border);
  border-radius: 8px;
  background: var(--ps-stat-bg);
  color: var(--ps-text);
  font-size: calc(13px * var(--ps-scale));
  line-height: 1.35;
  cursor: pointer;
}

.ps-turma-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 2px;
}

.ps-turma-card {
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 10px;
  height: auto;
  flex-shrink: 0;
  cursor: default;
}

.ps-turma-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
  cursor: pointer;
}

.ps-turma-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.ps-turma-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
}

.ps-turma-meta {
  line-height: 1.35;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.ps-batch-turma-unit {
  width: auto;
  min-width: 98px;
  max-width: 124px;
  min-height: 32px;
  padding: 4px 6px;
  font-size: 0.8em;
  flex-shrink: 0;
}

.ps-check-row input[type="checkbox"],
.ps-check-row input[type="radio"] {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  accent-color: #404E82;
}

.ps-table-wrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--ps-soft-border);
  border-radius: 8px;
}

.ps-table {
  width: 100%;
  border-collapse: collapse;
  font-size: calc(12px * var(--ps-scale));
}

.ps-table th, .ps-table td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--ps-soft-border);
  text-align: left;
  white-space: nowrap;
  color: var(--ps-text);
}

.ps-table th {
  background: var(--ps-th-bg);
  font-weight: 700;
  color: var(--ps-th-text);
}

.ps-pill {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: calc(11px * var(--ps-scale));
  font-weight: 600;
}

.ps-pill.ok { background: var(--ps-pill-ok-bg); color: var(--ps-pill-ok-tx); }
.ps-pill.warn { background: var(--ps-pill-warn-bg); color: var(--ps-pill-warn-tx); }
.ps-pill.bad { background: var(--ps-pill-bad-bg); color: var(--ps-pill-bad-tx); }

.ps-details {
  font-size: calc(12px * var(--ps-scale));
}

.ps-details summary {
  cursor: pointer;
  font-weight: 600;
  min-height: 36px;
  display: flex;
  align-items: center;
  color: var(--ps-label);
}

.ps-list {
  margin: 4px 0 0;
  padding-left: 18px;
  max-height: 150px;
  overflow-y: auto;
  color: var(--ps-label);
}

.ps-muted {
  font-size: calc(12px * var(--ps-scale));
  color: var(--ps-muted);
}

.ps-hidden {
  display: none !important;
}
`;
