// Mobile Debug Utility
// Add this to catch errors on mobile devices

interface LogEntry {
  timestamp: string;
  type: 'error' | 'warn' | 'info' | 'log';
  message: string;
  stack?: string;
}

class MobileDebugger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  constructor() {
    this.setupErrorHandlers();
  }

  private setupErrorHandlers() {
    // Catch global errors
    window.onerror = (message, source, lineno, colno, error) => {
      this.log('error', `Global Error: ${message} at ${source}:${lineno}:${colno}`, error?.stack);
      return false;
    };

    // Catch unhandled promise rejections
    window.onunhandledrejection = (event) => {
      this.log('error', `Unhandled Promise Rejection: ${event.reason}`, event.reason?.stack);
    };

    // Override console methods
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
    };

    console.log = (...args) => {
      this.log('log', args.join(' '));
      originalConsole.log(...args);
    };

    console.warn = (...args) => {
      this.log('warn', args.join(' '));
      originalConsole.warn(...args);
    };

    console.error = (...args) => {
      this.log('error', args.join(' '));
      originalConsole.error(...args);
    };

    console.info = (...args) => {
      this.log('info', args.join(' '));
      originalConsole.info(...args);
    };
  }

  private log(type: LogEntry['type'], message: string, stack?: string) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type,
      message,
      stack,
    };

    this.logs.push(entry);

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Store in localStorage for persistence
    try {
      localStorage.setItem('mobile_debug_logs', JSON.stringify(this.logs));
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public getLogsAsText(): string {
    return this.logs
      .map((log) => `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}${log.stack ? '\n' + log.stack : ''}`)
      .join('\n\n');
  }

  public clearLogs() {
    this.logs = [];
    localStorage.removeItem('mobile_debug_logs');
  }

  public showLogsModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.9);
      z-index: 999999;
      overflow: auto;
      padding: 20px;
      color: white;
      font-family: monospace;
      font-size: 12px;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      position: sticky;
      top: 10px;
      right: 10px;
      padding: 10px 20px;
      background: red;
      color: white;
      border: none;
      border-radius: 5px;
      font-size: 16px;
      cursor: pointer;
      margin-bottom: 20px;
    `;
    closeBtn.onclick = () => document.body.removeChild(modal);

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy Logs';
    copyBtn.style.cssText = closeBtn.style.cssText;
    copyBtn.style.background = 'blue';
    copyBtn.style.marginLeft = '10px';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(this.getLogsAsText()).then(() => {
        alert('Logs copied to clipboard!');
      });
    };

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear Logs';
    clearBtn.style.cssText = closeBtn.style.cssText;
    clearBtn.style.background = 'orange';
    clearBtn.style.marginLeft = '10px';
    clearBtn.onclick = () => {
      this.clearLogs();
      document.body.removeChild(modal);
    };

    const content = document.createElement('pre');
    content.textContent = this.getLogsAsText() || 'No logs yet';
    content.style.cssText = 'white-space: pre-wrap; word-wrap: break-word;';

    modal.appendChild(closeBtn);
    modal.appendChild(copyBtn);
    modal.appendChild(clearBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);
  }
}

// Create global instance
export const mobileDebugger = new MobileDebugger();

// Add global function to show logs (can be called from browser console)
(window as any).showMobileLogs = () => mobileDebugger.showLogsModal();

// Add floating debug button (only on mobile)
if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  const debugBtn = document.createElement('button');
  debugBtn.textContent = '🐛';
  debugBtn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: #ff0000;
    color: white;
    border: none;
    font-size: 24px;
    z-index: 999998;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    cursor: pointer;
  `;
  debugBtn.onclick = () => mobileDebugger.showLogsModal();
  document.body.appendChild(debugBtn);
}
