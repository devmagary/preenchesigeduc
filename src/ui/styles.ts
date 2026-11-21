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
  background: rgba(15, 23, 42, 0.35);
  z-index: 2147483641;
  display: none;
}

.ps-backdrop.open {
  display: block;
}

.ps-drawer {
  position: fixed;
  top: 0;
  right: 0;
  width: 440px;
  max-width: 100%;
  height: 100dvh;
  z-index: 2147483642;
  background: #f8fafc;
  display: none;
  flex-direction: column;
  box-shadow: -8px 0 32px rgba(15, 23, 42, 0.22);
  border-left: 1px solid #cbd5e1;
  overflow: hidden;
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
  padding: 12px 16px;
  background: #404E82;
  color: #ffffff;
  flex-shrink: 0;
}

.ps-header-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ps-header-title strong {
  font-size: 15px;
  font-weight: 700;
}

.ps-header-sub {
  font-size: 12px;
  color: #dbeafe;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ps-icon-btn {
  min-width: 44px;
  min-height: 44px;
  border: 0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ps-icon-btn:hover {
  background: rgba(255, 255, 255, 0.26);
}

.ps-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: #e2e8f0;
  padding: 4px;
  gap: 4px;
  flex-shrink: 0;
}

.ps-tab {
  min-height: 44px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #334155;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 8px;
}

.ps-tab.active {
  background: #ffffff;
  color: #1e293b;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
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
  scrollbar-color: #64748b #e2e8f0;
}

.ps-body::-webkit-scrollbar {
  width: 8px;
}

.ps-body::-webkit-scrollbar-track {
  background: #e2e8f0;
}

.ps-body::-webkit-scrollbar-thumb {
  background: #64748b;
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
  border: 1px dashed #64748b;
  border-radius: 9px;
  background: #f8fafc;
  color: #1e293b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.ps-file-btn:hover {
  border-color: #404E82;
  background: #eff6ff;
}

.ps-compact-details summary {
  cursor: pointer;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
  list-style: none;
}

.ps-compact-details summary::after {
  content: '▾';
  font-size: 12px;
  color: #475569;
}

.ps-compact-details[open] summary::after {
  content: '▴';
}

.ps-card {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ps-card-title {
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin: 0;
}

.ps-banner {
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  border: 1px solid transparent;
}

.ps-banner.info {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1e3a8a;
}

.ps-banner.warn {
  background: #fffbeb;
  border-color: #fde68a;
  color: #92400e;
}

.ps-banner.error {
  background: #fef2f2;
  border-color: #fecaca;
  color: #991b1b;
}

.ps-banner.success {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #065f46;
}

.ps-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ps-label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.ps-input, .ps-select, .ps-textarea {
  width: 100%;
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid #94a3b8;
  border-radius: 8px;
  background: #ffffff;
  color: #0f172a;
  font-family: inherit;
  font-size: 14px;
}

.ps-textarea {
  min-height: 82px;
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

@media (max-width: 640px) {
  .ps-input, .ps-select, .ps-textarea {
    font-size: 16px;
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
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: opacity 0.12s ease;
}

.ps-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.ps-btn-primary {
  background: #404E82;
  color: #ffffff;
}

.ps-btn-success {
  background: #059669;
  color: #ffffff;
}

.ps-btn-danger {
  background: #dc2626;
  color: #ffffff;
}

.ps-btn-secondary {
  background: #e2e8f0;
  color: #1e293b;
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
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  padding: 8px 10px;
  background: #f8fafc;
}

.ps-stat strong {
  display: block;
  font-size: 18px;
  line-height: 1.2;
}

.ps-stat span {
  font-size: 11px;
  color: #475569;
  font-weight: 600;
}

.ps-stat.ok strong { color: #047857; }
.ps-stat.warn strong { color: #b45309; }
.ps-stat.bad strong { color: #b91c1c; }

.ps-progress-wrap {
  width: 100%;
  background: #e2e8f0;
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
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  cursor: pointer;
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
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.ps-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.ps-table th, .ps-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  white-space: nowrap;
}

.ps-table th {
  background: #f1f5f9;
  font-weight: 700;
  color: #334155;
}

.ps-pill {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.ps-pill.ok { background: #d1fae5; color: #065f46; }
.ps-pill.warn { background: #fef3c7; color: #92400e; }
.ps-pill.bad { background: #fee2e2; color: #991b1b; }

.ps-details {
  font-size: 12px;
}

.ps-details summary {
  cursor: pointer;
  font-weight: 600;
  min-height: 36px;
  display: flex;
  align-items: center;
  color: #334155;
}

.ps-list {
  margin: 4px 0 0;
  padding-left: 18px;
  max-height: 150px;
  overflow-y: auto;
  color: #334155;
}

.ps-muted {
  font-size: 12px;
  color: #475569;
}

.ps-hidden {
  display: none !important;
}
`;
