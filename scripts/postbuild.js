#!/usr/bin/env node
/* eslint-disable no-console */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Resolve paths relative to repo root, regardless of current working dir
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const distBundle = resolve(projectRoot, 'frontend/sidebar/dist/bundle.js');
const appsScriptDir = resolve(projectRoot, 'apps-script');

const bundleContent = readFileSync(distBundle, 'utf8');

const staticHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      --bg: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      --text: #0f172a;
      --text-secondary: #475569;
      --muted: #64748b;
      --primary: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      --primary-hover: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      --surface: rgba(255, 255, 255, 0.8);
      --card: rgba(255, 255, 255, 0.95);
      --border: rgba(148, 163, 184, 0.2);
      --success: linear-gradient(135deg, #10b981 0%, #059669 100%);
      --warning: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      --danger: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      --radius: 16px;
      --shadow-soft: 0 1px 3px rgba(0,0,0,.08), 0 4px 12px rgba(0,0,0,.05);
      --shadow-medium: 0 4px 12px rgba(0,0,0,.1), 0 8px 24px rgba(0,0,0,.06);
      --shadow-strong: 0 8px 24px rgba(0,0,0,.12), 0 16px 40px rgba(0,0,0,.08);
      --backdrop: backdrop-filter: blur(20px) saturate(180%);
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif; 
      color: var(--text); 
      background: var(--bg); 
      margin: 0; 
      font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .container { 
      padding: 20px; 
      min-height: 100vh; 
      display: flex; 
      flex-direction: column; 
      justify-content: center;
      max-width: 400px;
      margin: 0 auto;
    }

    .hero {
      text-align: center;
      margin-bottom: 32px;
    }

    .hero-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 16px;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--shadow-strong);
      position: relative;
    }

    .hero-icon::before {
      content: '📄';
      font-size: 28px;
    }

    .hero-icon::after {
      content: '';
      position: absolute;
      top: -2px;
      right: -2px;
      width: 20px;
      height: 20px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    }

    .hero-title {
      font-size: 24px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }

    .hero-subtitle {
      font-size: 15px;
      color: var(--text-secondary);
      font-weight: 500;
      opacity: 0.8;
    }

    .main-card { 
      background: var(--card); 
      border: 1px solid var(--border); 
      border-radius: 20px; 
      box-shadow: var(--shadow-medium); 
      padding: 24px; 
      backdrop-filter: blur(20px) saturate(180%);
      position: relative;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .main-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
    }

    .card { 
      background: var(--card); 
      border: 1px solid var(--border); 
      border-radius: var(--radius); 
      box-shadow: var(--shadow-soft); 
      padding: 20px; 
      backdrop-filter: blur(20px) saturate(180%);
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
    }
    .stack { display: grid; gap: 16px; }
    .row { display: grid; gap: 6px; }
    
    .btn { 
      background: var(--primary); 
      color: #fff; 
      border: 0; 
      padding: 12px 20px; 
      cursor: pointer; 
      border-radius: 12px; 
      font-weight: 600; 
      font-size: 14px;
      letter-spacing: 0.3px; 
      transition: all .15s cubic-bezier(0.4, 0, 0.2, 1); 
      box-shadow: var(--shadow-medium); 
      position: relative;
      overflow: hidden;
    }
    .btn::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      background: rgba(255,255,255,0.3);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      transition: width .3s ease, height .3s ease;
    }
    .btn:hover::before { width: 300px; height: 300px; }
    .btn:hover { 
      background: var(--primary-hover); 
      box-shadow: var(--shadow-strong); 
      transform: translateY(-1px);
    }
    .btn:active { transform: translateY(0); }
    .btn:disabled { 
      background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%); 
      cursor: default; 
      box-shadow: var(--shadow-soft); 
      transform: none;
    }
    .btn--ghost { 
      background: rgba(255,255,255,0.8); 
      color: #3b82f6; 
      border: 1px solid rgba(59, 130, 246, 0.2); 
      box-shadow: var(--shadow-soft);
    }
    .btn--ghost:hover {
      background: rgba(59, 130, 246, 0.05);
      border-color: rgba(59, 130, 246, 0.3);
    }
    
    .muted { color: var(--muted); font-size: 12px; }
    .log { 
      font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; 
      font-size: 11px; 
      line-height: 1.5;
      white-space: pre-wrap; 
      background: rgba(15, 23, 42, 0.03); 
      padding: 12px; 
      border-radius: 12px; 
      max-height: 200px; 
      overflow: auto; 
      border: 1px solid var(--border); 
      backdrop-filter: blur(10px);
    }
    .input { width: 100%; padding: 10px; border-radius: 8px; border: 1px dashed var(--border); background: var(--surface); }
    
    .dropzone { 
      border: 2px dashed rgba(59, 130, 246, 0.3); 
      background: linear-gradient(135deg, rgba(248, 250, 252, 0.4) 0%, rgba(241, 245, 249, 0.2) 100%); 
      padding: 32px 24px; 
      border-radius: 16px; 
      text-align: center; 
      transition: all .25s cubic-bezier(0.4, 0, 0.2, 1); 
      cursor: pointer;
      position: relative;
      overflow: hidden;
      min-height: 140px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .dropzone::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%);
      transform: scale(0);
      transition: transform .3s ease;
    }
    .dropzone:hover::before { transform: scale(1); }
    .dropzone:hover {
      border-color: rgba(59, 130, 246, 0.5);
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(29, 78, 216, 0.04) 100%);
      transform: translateY(-1px);
      box-shadow: var(--shadow-medium);
    }
    .dropzone--active { 
      border-color: #3b82f6; 
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(29, 78, 216, 0.08) 100%); 
      transform: scale(1.01); 
      box-shadow: var(--shadow-strong);
    }
    
    .filecard { 
      display: flex; 
      align-items: center; 
      gap: 12px; 
      padding: 14px; 
      border: 1px solid rgba(59, 130, 246, 0.15); 
      border-radius: 14px; 
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.8) 100%); 
      box-shadow: var(--shadow-soft);
      backdrop-filter: blur(10px);
    }
    .fileicon { 
      width: 32px; 
      height: 40px; 
      border-radius: 6px; 
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); 
      position: relative; 
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.5), 0 1px 3px rgba(0,0,0,0.1);
    }
    .fileicon::after { content: ''; position: absolute; right: -2px; top: -2px; width: 12px; height: 12px; background: #fff; border: 1px solid #c8d3e6; border-radius: 2px; transform: rotate(45deg); }
    .filename { font-weight: 600; font-size: 13px; color: var(--text); }
    .filesize { font-size: 11px; color: var(--text-secondary); }

    .progress { 
      height: 8px; 
      background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); 
      border-radius: 999px; 
      overflow: hidden; 
      position: relative; 
      border: 1px solid rgba(148, 163, 184, 0.2); 
      box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
    }
    .progress__bar { 
      position: absolute; 
      inset: 0 auto 0 0; 
      width: 10%; 
      background: linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%); 
      border-radius: 999px; 
      transition: width .4s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
    }

    .spinner { width: 18px; height: 18px; border-radius: 999px; border: 2px solid #cfe0ff; border-right-color: #3b82f6; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .fade-in { animation: fadeIn .3s cubic-bezier(0.4, 0, 0.2, 1); }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    
    .drop-hint { 
      color: var(--text-secondary); 
      font-size: 14px; 
      font-weight: 500;
      opacity: 0.7;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    
    .drop-hint::before {
      content: '📎';
      font-size: 24px;
      opacity: 0.6;
    }

    .actions-row {
      display: flex; 
      gap: 12px; 
      margin-top: 8px;
    }

    .actions-row .btn {
      flex: 1;
      justify-content: center;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-primary {
      background: var(--primary);
    }


    
    .chip { 
      display: inline-flex; 
      align-items: center; 
      gap: 6px; 
      height: 28px; 
      border-radius: 999px; 
      padding: 0 12px; 
      font-size: 12px; 
      font-weight: 500;
      border: 1px solid rgba(59, 130, 246, 0.2); 
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 197, 253, 0.1) 100%); 
      color: #1e40af; 
      backdrop-filter: blur(10px);
      box-shadow: var(--shadow-soft);
    }
    
    /* Debug checkbox styling */
    input[type="checkbox"] {
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 2px solid rgba(59, 130, 246, 0.3);
      background: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      transition: all .2s ease;
      position: relative;
    }
    input[type="checkbox"]:checked {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      border-color: #1d4ed8;
    }
    input[type="checkbox"]:checked::before {
      content: '✓';
      position: absolute;
      top: -1px;
      left: 1px;
      color: white;
      font-size: 12px;
      font-weight: bold;
    }

    /* Loading overlay */
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(29, 78, 216, 0.9) 100%);
      backdrop-filter: blur(20px) saturate(180%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn .4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .loading-content {
      text-align: center;
      color: white;
      max-width: 280px;
    }

    .loading-spinner-large {
      width: 48px;
      height: 48px;
      border: 3px solid rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s linear infinite;
      margin: 0 auto 24px;
    }

    .loading-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      opacity: 0.95;
    }

    .loading-progress {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 999px;
      overflow: hidden;
      margin-bottom: 20px;
    }

    .loading-progress-bar {
      height: 100%;
      background: linear-gradient(90deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 1));
      border-radius: 999px;
      transition: width .5s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 16px rgba(255, 255, 255, 0.5);
    }

    .loading-phase {
      font-size: 14px;
      opacity: 0.8;
      font-weight: 500;
      animation: fadeIn .3s ease;
    }
  </style>
</head>
<body>
  <div id="root" class="container"></div>
  <script>
${bundleContent}
  </script>
</body>
</html>`;

writeFileSync(resolve(appsScriptDir, 'Sidebar.html'), staticHtml, 'utf8');

console.log('Postbuild: wrote static apps-script/Sidebar.html');