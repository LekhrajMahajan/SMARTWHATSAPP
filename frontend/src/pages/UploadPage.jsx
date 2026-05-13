// UploadPage.jsx - Main process page: upload Excel + write message + send + view logs
import { useState, useEffect, useRef } from 'react';
import { uploadAndSend, fetchMessageLogs, downloadSampleCSV, clearMessageLogs, getStatus, BASE_URL } from '../api';

const ExpandableMessage = ({ text }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = text && text.length > 40;

  if (!isLong) return <span>{text}</span>;

  return (
    <div className="max-w-[250px]">
      <div className={`${expanded ? 'whitespace-pre-wrap break-words' : 'truncate'} text-[#bbcbb9]/70 group-hover:text-[#dce5d8] transition-colors`}>
        {text}
      </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          setExpanded(!expanded);
        }}
        className="text-[#25d366] text-[10px] md:text-[11px] font-bold hover:text-[#20bd5a] transition-colors mt-1 flex items-center gap-0.5"
      >
        {expanded ? 'Show Less' : 'Read More...'}
      </button>
    </div>
  );
};

const UploadPage = () => {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);    // { success: bool, text: string }
  const [logs, setLogs] = useState([]);
  const [realtimeLogs, setRealtimeLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(null); // null = checking, true/false
  const [viewMode, setViewMode] = useState('history'); // 'history' or 'realtime'
  const fileInputRef = useRef(null);
  const wsRef = useRef(null);
  const [cooldown, setCooldown] = useState(0); // seconds remaining
  const [statusInfo, setStatusInfo] = useState({ sentToday: 0, dailyLimit: 800 });
  const [isWithinWindow, setIsWithinWindow] = useState(true);
  const [qrCode, setQrCode] = useState(null); // Base64 QR image

  // ── Cooldown Timer logic ───────────────────────────────────────────────────
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const formatCooldown = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ── WebSocket for real-time updates ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    const connectWS = () => {
      if (cancelled) return;
      const token = localStorage.getItem('token');
      if (!token) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = BASE_URL ? BASE_URL.replace(/^https?:\/\//, '') : window.location.host;
      const ws = new WebSocket(`${protocol}//${wsHost}/ws/${token}`);

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'LOG_UPDATE') {
            setRealtimeLogs((prev) => [data.data, ...prev]);
            if (data.data.status === 'Sent') {
              setStatusInfo(prev => ({ ...prev, sentToday: prev.sentToday + 1 }));
            }
          } else if (data.type === 'COOLDOWN_START') {
            setCooldown(data.data.seconds);
          } else if (data.type === 'PROCESS_STARTED') {
            setLoading(true);
            setResult(null);
          } else if (data.type === 'PROCESS_FINISHED') {
            setLoading(false);
          } else if (data.type === 'DAILY_LIMIT_REACHED') {
            setResult({ success: false, text: 'Daily limit of 800 messages reached. Process paused until tomorrow.' });
          } else if (data.type === 'WAITING_FOR_WINDOW') {
            setIsWithinWindow(false);
          } else if (data.type === 'WINDOW_RESUMED') {
            setIsWithinWindow(true);
          } else if (data.type === 'QR_CODE') {
            setQrCode(data.data.image);
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = (e) => {
        if (cancelled) return; // StrictMode unmounted — do NOT retry
        if (e.code === 1008) {
          localStorage.removeItem('token');
          window.location.href = '/login';
          return;
        }
        // Retry only if we are still mounted
        retryTimer = setTimeout(connectWS, 3000);
      };

      ws.onerror = () => { ws.close(); };

      wsRef.current = ws;
    };

    connectWS();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent retry on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // ── Check backend health + load logs on mount ──────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`${BASE_URL}/`);
        if (res.ok) {
          setBackendOnline(true);
        } else {
          setBackendOnline(false);
        }
      } catch {
        setBackendOnline(false);
      }

      try {
        const statusData = await getStatus();
        if (statusData) {
          setCooldown(statusData.remaining_cooldown);
          setStatusInfo({ 
            sentToday: statusData.sent_today, 
            dailyLimit: statusData.daily_limit,
            cooldownUntil: statusData.cooldown_until
          });
          setIsWithinWindow(statusData.is_within_window);
        }
      } catch (err) {
        console.error('Failed to load status:', err);
      }

      try {
        const data = await fetchMessageLogs();
        setLogs(data);
      } catch (err) {
        console.error('Failed to load logs:', err);
      } finally {
        setLogsLoading(false);
      }
    };
    init();
  }, []);

  // ── Drag & Drop handlers ───────────────────────────────────────────────────
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSetFile(dropped);
  };

  const handleFileInput = (e) => {
    const selected = e.target.files[0];
    if (selected) validateAndSetFile(selected);
  };

  const validateAndSetFile = (f) => {
    const allowed = ['.xlsx', '.xls', '.csv'];
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setResult({ success: false, text: '❌ Invalid file type. Please upload .xlsx, .xls, or .csv' });
      return;
    }
    setFile(f);
    setResult(null);
  };

  // ── Submit → POST /upload ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!file) {
      setResult({ success: false, text: '⚠️ Please select a contact file first.' });
      return;
    }
    if (!message.trim()) {
      setResult({ success: false, text: '⚠️ Please write a message before sending.' });
      return;
    }
    if (!backendOnline) {
      setResult({ success: false, text: '❌ Backend is offline. Please start the Python server first.' });
      return;
    }

    setLoading(true);
    setResult(null);
    setQrCode(null);
    setRealtimeLogs([]);
    setViewMode('realtime');

    try {
      const data = await uploadAndSend(file, message);

      if (data.success) {
        setResult({
          success: true,
          text: `✅ Messages process finished for ${data.contacts} contacts!`,
        });
        // Refresh the main logs table
        const updated = await fetchMessageLogs();
        setLogs(updated);
      } else {
        setResult({ success: false, text: `❌ Error: ${data.message}` });
      }
    } catch (err) {
      setResult({ success: false, text: `❌ Network error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const exportToCSV = () => {
    const dataToExport = viewMode === 'realtime' ? realtimeLogs : logs;
    if (dataToExport.length === 0) return;

    const headers = ['Name', 'Number', 'Message', 'Status', 'Date'];
    const rows = dataToExport.map(log => [
      log.name,
      log.number,
      `"${log.message?.replace(/"/g, '""')}"`,
      log.status,
      log.created_at
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `campaign_report_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const displayLogs = viewMode === 'history' ? logs : realtimeLogs;

  return (
    <section className="flex-grow pt-20 md:pt-24 px-4 md:px-margin lg:px-lg max-w-7xl mx-auto w-full relative z-10 pb-16 md:pb-24">

      {/* Background neon glows */}
      <div className="absolute neon-underglow-abs w-[300px] md:w-[800px] h-[300px] md:h-[800px] top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
      <div className="absolute neon-underglow-abs w-[200px] md:w-[600px] h-[200px] md:h-[600px] bottom-0 right-0 translate-x-1/4 translate-y-1/4 pointer-events-none opacity-50" />

      {/* PAGE HEADER */}
      <header className="text-center mb-6 md:mb-8 px-4">
        <h1 className="text-3xl md:text-5xl lg:text-[56px] font-[800] leading-[1.1] tracking-[-0.02em] text-[#dce5d8] mb-4">
          Send Your WhatsApp Campaign
        </h1>
        <p className="text-base md:text-lg lg:text-xl font-[400] leading-[1.6] text-[#bbcbb9] max-w-2xl mx-auto">
          Upload your contact list and write your message below. We handle the automation while you focus on growth.
        </p>
      </header>

      {/* BACKEND STATUS BANNER */}
      <div className="px-2 md:px-0 mt-0 mb-8">
        {backendOnline === false && (
          <div className="mb-0 w-full p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 flex items-center gap-3 text-sm md:text-base">
            <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            <span className="leading-tight">
              <strong>Backend Offline</strong> — Start the Python server first:{' '}
              <code className="bg-[#121b22] px-2 py-0.5 rounded font-mono text-xs">
                uvicorn main:app --reload
              </code>
            </span>
          </div>
        )}

        {backendOnline === true && (
          <div className="mb-0 w-full p-3 rounded-xl border border-[#25d366]/20 bg-[#25d366]/5 text-[#25d366] flex items-center gap-2 text-xs md:text-sm">
            <span className="w-2 h-2 rounded-full bg-[#25d366] animate-pulse" />
            Backend connected — Online
          </div>
        )}

        {/* MESSAGING RULES & COOLDOWN INFO */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-[#dce5d8]/10 bg-[#19221a]/30 backdrop-blur-md">
            <h4 className="text-[#25d366] text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">schedule</span>
              Messaging Schedule & Rules
            </h4>
            <ul className="text-[11px] md:text-xs text-[#bbcbb9] space-y-1.5">
              <li className="flex justify-between items-center">
                <span>Daily Window:</span>
                <span className="text-[#dce5d8] font-medium">10:00 AM - 06:00 PM (IST)</span>
              </li>
              <li className="flex justify-between items-center">
                <span>Batch Limit:</span>
                <span className="text-[#dce5d8] font-medium">100 Messages per batch</span>
              </li>
              <li className="flex justify-between items-center">
                <span>Cooldown:</span>
                <span className="text-[#dce5d8] font-medium">1 Hour between batches</span>
              </li>
              <li className="flex justify-between items-center">
                <span>Daily Maximum:</span>
                <span className="text-[#dce5d8] font-medium">800 Messages / day</span>
              </li>
            </ul>
          </div>

          <div className={`p-4 rounded-xl border transition-all duration-300 ${cooldown > 0 ? 'border-orange-500/30 bg-orange-500/5' : 'border-[#dce5d8]/10 bg-[#19221a]/30'}`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${cooldown > 0 ? 'text-orange-400' : 'text-[#25d366]'}`}>
              <span className="material-symbols-outlined text-[16px]">{cooldown > 0 ? 'hourglass_top' : 'check_circle'}</span>
              Sending Status
            </h4>
            <div className="flex flex-col justify-center h-[calc(100%-24px)]">
              {cooldown > 0 ? (
                <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-500">
                  <div>
                    <p className="text-[10px] text-orange-400/70 font-medium uppercase tracking-tighter">Cooldown In Progress</p>
                    <p className="text-2xl md:text-3xl font-black text-orange-400 font-mono tracking-widest bg-orange-400/10 px-3 py-1 rounded-lg border border-orange-400/20 shadow-[0_0_15px_rgba(251,146,60,0.1)] mt-1">
                      {formatCooldown(cooldown)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[#bbcbb9] uppercase">Next Batch</p>
                    <p className="text-xs text-[#dce5d8] font-bold">
                      {new Date(new Date().getTime() + cooldown * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ) : !isWithinWindow ? (
                <div className="flex items-center gap-3 text-red-400 animate-in fade-in duration-500">
                  <span className="material-symbols-outlined text-2xl">nights_stay</span>
                  <div>
                    <p className="text-[10px] text-red-400/70 font-medium uppercase">Outside Sending Window</p>
                    <p className="text-sm font-semibold">Paused until 10:00 AM IST</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between opacity-40 grayscale transition-all duration-500">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#25d366]">check_circle</span>
                    <p className="text-xs text-[#bbcbb9] font-medium uppercase">System Ready</p>
                  </div>
                  <div className="text-right">
                    {statusInfo.cooldownUntil && (
                      <div className="mb-1">
                         <p className="text-[9px] text-[#bbcbb9] uppercase">Last Cooldown Until</p>
                         <p className="text-[10px] text-orange-400 font-bold">
                           {new Date(statusInfo.cooldownUntil).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                         </p>
                      </div>
                    )}
                    <p className="text-[10px] text-[#bbcbb9] uppercase">Today's Progress</p>
                    <p className="text-xs text-[#25d366] font-bold">
                      {statusInfo.sentToday} / {statusInfo.dailyLimit}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TWO COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-6 md:mb-10 px-4 lg:px-0">

        {/* STEP 1: Upload File */}
        <section className="bg-[#121b22]/70 backdrop-blur-xl border border-[#869584]/30 border-t-white/10 border-l-white/10 rounded-xl p-6 md:p-8 flex flex-col relative group transition-all duration-300">
          <h2 className="text-xl md:text-[24px] font-[600] leading-[1.3] text-[#25d366] mb-6 flex items-center gap-2">
            <span className="bg-[#242c24] text-[#dce5d8] px-2 py-1 rounded text-[10px] md:text-[12px] font-[500] tracking-wider uppercase">STEP 1</span>
            Upload Contact File
          </h2>

          <div
            id="file-dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg flex-grow flex flex-col items-center justify-center p-6 md:p-8 transition-all cursor-pointer select-none min-h-[180px] md:min-h-[200px] ${isDragging
              ? 'border-[#25d366] bg-[#25d366]/5 scale-[1.01]'
              : file
                ? 'border-[#25d366]/60 bg-[#19221a]/50'
                : 'border-[#3c4a3d] hover:border-[#25d366]/50 bg-[#19221a]/50'
              }`}
          >
            {file ? (
              <>
                <span className="material-symbols-outlined text-4xl md:text-[64px] text-[#25d366] mb-3 md:mb-4">task_alt</span>
                <p className="text-base md:text-[18px] font-[600] text-[#dce5d8] text-center mb-1 truncate max-w-full px-2">{file.name}</p>
                <p className="text-xs md:text-[14px] font-[400] text-[#bbcbb9] text-center">
                  {(file.size / 1024).toFixed(1)} KB — Click to change
                </p>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-4xl md:text-[64px] text-[#3c4a3d] mb-3 md:mb-4">folder</span>
                <p className="text-base md:text-[18px] font-[500] text-[#dce5d8] text-center mb-2">
                  Drag &amp; Drop Excel / CSV here
                </p>
                <p className="text-xs md:text-[14px] font-[400] text-[#bbcbb9] text-center mb-4">or click to browse</p>
                <span className="text-[10px] md:text-[12px] font-[500] text-[#bbcbb9]/60 border border-[#3c4a3d]/40 rounded px-3 py-1 bg-[#121b22]">
                  .xlsx &nbsp;•&nbsp; .xls &nbsp;•&nbsp; .csv
                </span>
              </>
            )}
          </div>

          {/* Required columns hint */}
          <p className="text-[11px] md:text-xs font-[500] text-[#bbcbb9]/60 mt-4 text-center">
            Required columns: <span className="text-[#25d366]">Name</span> &amp; <span className="text-[#25d366]">Number</span>
          </p>

          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
        </section>

        {/* STEP 2: Write Message */}
        <section className="bg-[#121b22]/70 backdrop-blur-xl border border-[#869584]/30 border-t-white/10 border-l-white/10 rounded-xl p-6 md:p-8 flex flex-col transition-all duration-300">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl md:text-[24px] font-[600] leading-[1.3] text-[#25d366] flex items-center gap-2">
              <span className="bg-[#242c24] text-[#dce5d8] px-2 py-1 rounded text-[10px] md:text-[12px] font-[500] tracking-wider uppercase">STEP 2</span>
              Write Your Message
            </h2>
          </div>

          {/* Tip box */}
          <div className="bg-[#19221a]/50 border border-[#3c4a3d]/30 rounded-lg p-3 md:p-4 mb-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-[#25d366] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
            <p className="text-xs md:text-sm leading-relaxed text-[#bbcbb9]">
              <span className="text-[#dce5d8] font-semibold">💡 Tip:</span> Use{' '}
              <code className="bg-[#0d150e] px-1 py-0.5 rounded text-[#25d366] font-mono">{'{name}'}</code>{' '}
              to personalize each message.
            </p>
          </div>

          {/* Textarea */}
          <div className="relative flex-grow flex flex-col">
            <textarea
              id="message-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onWheel={(e) => {
                const el = e.currentTarget;
                const atTop = el.scrollTop === 0;
                const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight;
                const scrollingUp = e.deltaY < 0;
                const scrollingDown = e.deltaY > 0;
                // Only stop page scroll if textarea can still scroll in that direction
                if (!(atTop && scrollingUp) && !(atBottom && scrollingDown)) {
                  e.stopPropagation();
                }
              }}
              className="w-full min-h-[220px] max-h-[400px] overflow-y-auto bg-[#19221a]/50 border border-[#3c4a3d] rounded-lg p-4 md:p-6 text-sm md:text-base font-[400] leading-[1.6] text-[#dce5d8] focus:border-[#25d366] focus:ring-1 focus:ring-[#25d366] focus:outline-none resize-none placeholder-[#bbcbb9]/30 scrollbar-thin scrollbar-thumb-[#3c4a3d] scrollbar-track-transparent"
              placeholder="Hi {name}, we have an exciting offer for you..."
            />
            <div className="absolute bottom-4 right-4 text-[10px] md:text-xs font-medium text-[#bbcbb9]/40">
              {message.length} chars
            </div>
          </div>
        </section>

      </div>

      {/* RESULT ALERT */}
      <div className="px-4 lg:px-0">
        {result && (
          <div className={`mb-8 w-full p-4 rounded-xl border text-sm md:text-base flex items-center gap-3 ${result.success
            ? 'bg-[#25d366]/5 border-[#25d366]/30 text-[#25d366]'
            : 'bg-red-500/5 border-red-500/30 text-red-400'
            }`}>
            <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
              {result.success ? 'check_circle' : 'error'}
            </span>
            {result.text}
          </div>
        )}
      </div>

      {/* SEND BUTTON / COOLDOWN TIMER */}
      <div className="mb-8 flex justify-center px-4 md:px-0">
        {cooldown > 0 ? (
          <div className="w-full sm:w-auto px-10 md:px-16 py-4 bg-orange-500/10 border border-orange-500/30 text-orange-400 font-[800] text-xl md:text-2xl rounded-xl flex items-center justify-center gap-4 transition-all duration-300 shadow-[0_0_25px_rgba(249,115,22,0.1)] animate-in fade-in zoom-in-95 duration-500">
            <span className="material-symbols-outlined text-2xl md:text-3xl animate-spin" style={{ animationDuration: '3s' }}>hourglass_top</span>
            <div className="flex flex-col items-center">
              <span className="text-[10px] md:text-xs uppercase tracking-[0.2em] font-bold text-orange-400/70">Cooldown Active</span>
              <span className="font-mono tracking-widest">{formatCooldown(cooldown)}</span>
            </div>
          </div>
        ) : (
          <button
            id="send-btn"
            onClick={handleSubmit}
            disabled={loading || backendOnline === false || !isWithinWindow}
            className="w-full sm:w-auto px-10 md:px-16 py-4 bg-[#25d366] hover:bg-[#4ff07f] text-[#003915] font-[700] text-xl md:text-2xl rounded-xl flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_0_25px_rgba(37,211,102,0.3)] hover:shadow-[0_0_40px_rgba(37,211,102,0.5)] hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 active:scale-95"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </>
            ) : (
              <>🚀 Send Message</>
            )}
          </button>
        )}
      </div>
      
      {/* WhatsApp QR Display (MODAL-ISH) */}
      {qrCode && loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#121b22] border border-[#25d366]/30 p-8 rounded-2xl max-w-md w-full text-center shadow-[0_0_50px_rgba(37,211,102,0.2)]">
            <h3 className="text-2xl font-bold text-[#dce5d8] mb-4">Login Required</h3>
            <p className="text-[#bbcbb9] mb-6 text-sm">
              Please scan this QR code with your WhatsApp app to start sending.
            </p>
            <div className="bg-white p-4 rounded-xl inline-block mb-6 shadow-inner">
              <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
            </div>
            <div className="flex items-center justify-center gap-3 text-xs text-[#25d366] font-medium animate-pulse">
              <span className="material-symbols-outlined text-sm">sync</span>
              Waiting for scan...
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp QR NOTE */}
      <div className="px-4 lg:px-0">
        {backendOnline === true && (
          <div className="mb-8 bg-[#121b22]/40 backdrop-blur-md rounded-xl p-5 md:p-6 flex items-start gap-4 border border-[#3c4a3d]/30">
            <span className="material-symbols-outlined text-[#25d366] mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
            <div className="text-sm md:text-base leading-relaxed">
              <p className="text-[#dce5d8] font-bold mb-1">Action Required: WhatsApp QR Scan</p>
              <p className="text-[#bbcbb9]">
                A new Chrome window will appear. <strong className="text-[#dce5d8]">Scan the QR code</strong> with your WhatsApp app.
                The system will automatically start sending messages once you are logged in.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* CAMPAIGN LOG SECTION */}
      <section className="bg-[#121b22]/70 backdrop-blur-xl border border-[#869584]/30 border-t-white/10 border-l-white/10 rounded-xl p-4 md:p-8 mb-8 md:mb-16 overflow-hidden mx-4 lg:mx-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-6">
          <div className="flex flex-wrap items-center gap-3 md:gap-5">
            <h3 className="text-2xl md:text-3xl lg:text-[32px] font-[700] leading-[1.2] text-[#dce5d8]">Campaign Log</h3>

            <div className="relative inline-block text-left">
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="bg-[#19221a] border border-[#3c4a3d]/50 text-[#dce5d8] text-xs md:text-sm font-semibold rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-[#25d366] transition-colors cursor-pointer appearance-none"
              >
                <option value="history">History</option>
                <option value="realtime">Real-time Session</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#bbcbb9] text-[18px]">
                expand_more
              </span>
            </div>
          </div>

          <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-3">
            <span className="text-[10px] md:text-xs font-bold text-[#bbcbb9] bg-[#151e16] px-3 py-1.5 rounded-full border border-[#3c4a3d]/40">
              {displayLogs.length} Entries
            </span>
          </div>
        </div>

        {logsLoading ? (
          <div className="flex flex-col items-center justify-center py-12 md:py-20 gap-4 text-[#bbcbb9]">
            <div className="w-10 h-10 border-4 border-[#25d366]/20 border-t-[#25d366] rounded-full animate-spin" />
            <p className="text-sm font-medium animate-pulse">Fetching records...</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-[#3c4a3d]/30 text-[10px] md:text-xs font-bold text-[#bbcbb9]/60 uppercase tracking-widest bg-[#151e16]/50">
                  <th className="py-4 px-6 font-semibold">#</th>
                  <th className="py-4 px-6 font-semibold">Recipient</th>
                  <th className="py-4 px-6 font-semibold">Number</th>
                  <th className="py-4 px-6 font-semibold">Message Preview</th>
                  <th className="py-4 px-6 font-semibold">Status</th>
                  <th className="py-4 px-6 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="text-xs md:text-sm text-[#dce5d8]">
                {displayLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-[#bbcbb9]/50">
                      {viewMode === 'realtime'
                        ? 'Waiting for campaign activity...'
                        : 'No records found. Start your first campaign to see logs here.'}
                    </td>
                  </tr>
                ) : (
                  displayLogs.map((log, idx) => (
                    <tr key={log.id ? `log-${log.id}` : `idx-${idx}`} className="border-b border-[#3c4a3d]/10 hover:bg-[#25d366]/5 transition-colors group">
                      <td className="py-4 px-6 text-[#bbcbb9]/40">{idx + 1}</td>
                      <td className="py-4 px-6 font-semibold">{log.name}</td>
                      <td className="py-4 px-6 text-[#bbcbb9] font-mono">{log.number}</td>
                      <td className="py-4 px-6 text-[#bbcbb9]/70 max-w-[200px] group-hover:text-[#dce5d8] transition-colors">
                        <ExpandableMessage text={log.message} />
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] md:text-[11px] font-bold border ${log.status === 'Sent'
                          ? 'bg-[#25d366]/10 text-[#3de273] border-[#25d366]/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'Sent' ? 'bg-[#25d366] shadow-[0_0_8px_#25d366]' : 'bg-red-400'}`} />
                          {log.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-[#bbcbb9]/50 text-[11px] whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </section>
  );
};

export default UploadPage;

