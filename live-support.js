'use strict';

// ===== CONFIG =====
const SUP_CONFIG = {
  waNumber: '254700000000',
  waMsg: 'Hello! I need help with Hafa Market 🌿',
  phone: '+254700000000',
  agent: { name: 'Hafa Support', emoji: '👩🏾‍💼', title: 'Live Support Agent' },
};

// ===== STATE =====
let supOpen = false;
let supLauncherOpen = false;
let supExpand = 'normal'; // normal | half | full
let supActiveTab = 'chat';
let supMessages = [];
let supAttachments = [];
let supRecording = false;
let supMediaRecorder = null;
let supRecChunks = [];
let supRecTimer = null;
let supRecSeconds = 0;
let supCallActive = false;
let supCallType = null; // 'audio' | 'video'
let supCallTimer = null;
let supCallSeconds = 0;
let supMuted = false;
let supVideoOff = false;
let supScreenSharing = false;
let supScreenStream = null;
let supLocalStream = null;
let supTypingTimer = null;
let supFileTypes = {
  image: ['jpg','jpeg','png','gif','webp','svg','bmp'],
  video: ['mp4','webm','mov','avi','mkv'],
  audio: ['mp3','wav','ogg','m4a','aac'],
  doc:   ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv'],
  archive: ['zip','rar','7z','tar','gz'],
};

// ===== HELPERS =====
function supFmt(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
function supFileIcon(ext) {
  if (supFileTypes.image.includes(ext))   return '🖼️';
  if (supFileTypes.video.includes(ext))   return '🎬';
  if (supFileTypes.audio.includes(ext))   return '🎵';
  if (supFileTypes.doc.includes(ext))     return ext==='pdf'?'📄':'📝';
  if (supFileTypes.archive.includes(ext)) return '🗜️';
  return '📎';
}
function supFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1048576).toFixed(1) + ' MB';
}
function supNow() { return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }

// ===== BUILD WIDGET =====
function buildSupportWidget() {
  const el = document.createElement('div');
  el.id = 'hafaSupport';
  el.innerHTML = `
  <div class="sup-launcher" id="supLauncher">
    <div class="sup-menu" id="supMenu">

      <div class="sup-item">
        <div class="sup-btn-wrap">
          <button class="sup-btn btn-wa" onclick="supOpenWhatsApp()" aria-label="WhatsApp">
            <i class="fab fa-whatsapp"></i>
            <span class="sup-btn-pulse"></span>
          </button>
        </div>
        <span class="sup-tooltip">WhatsApp Chat</span>
      </div>

      <div class="sup-item">
        <div class="sup-btn-wrap">
          <a class="sup-btn btn-call" href="tel:${SUP_CONFIG.phone}" aria-label="Call Support">
            <i class="fas fa-phone"></i>
            <span class="sup-btn-pulse"></span>
          </a>
        </div>
        <span class="sup-tooltip">Call Support</span>
      </div>

      <div class="sup-item">
        <div class="sup-btn-wrap">
          <button class="sup-btn btn-live" onclick="openLiveChat()" aria-label="Live Chat">
            <i class="fas fa-comments"></i>
            <span class="sup-btn-pulse"></span>
          </button>
        </div>
        <span class="sup-tooltip">Live Chat with Agent</span>
      </div>

    </div>

    <button class="sup-main" id="supMainBtn" onclick="toggleSupLauncher()" aria-label="Help">
      <span class="sup-main-icon sup-open-icon"><i class="fas fa-headset"></i></span>
      <span class="sup-main-icon sup-close-icon"><i class="fas fa-times"></i></span>
      <span class="sup-main-pulse"></span>
    </button>
  </div>

  <!-- ===== LIVE CHAT WINDOW ===== -->
  <div class="sup-window" id="supWindow">

    <!-- Header -->
    <div class="sup-header">
      <div class="sup-header-left">
        <div class="sup-agent-av">
          ${SUP_CONFIG.agent.emoji}
          <span class="sup-agent-online"></span>
        </div>
        <div class="sup-agent-info">
          <strong>${SUP_CONFIG.agent.name}</strong>
          <span><span class="sup-agent-dot"></span> Online · Typically replies instantly</span>
        </div>
      </div>
      <div class="sup-header-actions">
        <button class="sup-hbtn" onclick="startCall('audio')" title="Voice Call"><i class="fas fa-phone"></i></button>
        <button class="sup-hbtn" onclick="startCall('video')" title="Video Call"><i class="fas fa-video"></i></button>
        <button class="sup-hbtn" onclick="startScreenShare()" title="Share Screen" id="supShareBtn"><i class="fas fa-desktop"></i></button>
        <button class="sup-hbtn" onclick="cycleExpand()" title="Expand" id="supExpandBtn"><i class="fas fa-expand-alt"></i></button>
        <button class="sup-hbtn danger" onclick="closeLiveChat()" title="Close"><i class="fas fa-times"></i></button>
      </div>
    </div>

    <!-- Screen share banner -->
    <div class="sup-share-banner" id="supShareBanner">
      <i class="fas fa-desktop"></i> You are sharing your screen with the agent
      <button onclick="stopScreenShare()">Stop Sharing</button>
    </div>

    <!-- Tabs -->
    <div class="sup-tabs">
      <button class="sup-tab active" onclick="switchSupTab(this,'chat')"><i class="fas fa-comment"></i> Chat</button>
      <button class="sup-tab" onclick="switchSupTab(this,'files')"><i class="fas fa-paperclip"></i> Files</button>
      <button class="sup-tab" onclick="switchSupTab(this,'info')"><i class="fas fa-info-circle"></i> Info</button>
    </div>

    <!-- Chat Tab -->
    <div class="sup-tab-content" id="supTabChat">
      <div class="sup-messages" id="supMessages"></div>
    </div>

    <!-- Files Tab -->
    <div class="sup-tab-content" id="supTabFiles" style="display:none">
      <div class="sup-messages" id="supFilesList" style="padding:16px">
        <p style="text-align:center;color:#9ca3af;font-size:.85rem;padding:40px 0">No files shared yet</p>
      </div>
    </div>

    <!-- Info Tab -->
    <div class="sup-tab-content" id="supTabInfo" style="display:none">
      <div style="padding:24px;font-size:.85rem;color:#374151;line-height:1.8">
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:3rem">${SUP_CONFIG.agent.emoji}</div>
          <strong style="display:block;font-size:1rem">${SUP_CONFIG.agent.name}</strong>
          <span style="color:#7b1fa2">${SUP_CONFIG.agent.title}</span>
        </div>
        <div style="background:#f9fafb;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px">
          <div><i class="fas fa-clock" style="color:#7b1fa2;margin-right:8px"></i><strong>Hours:</strong> Mon–Sat, 8am–8pm</div>
          <div><i class="fas fa-phone" style="color:#7b1fa2;margin-right:8px"></i><strong>Phone:</strong> ${SUP_CONFIG.phone}</div>
          <div><i class="fas fa-envelope" style="color:#7b1fa2;margin-right:8px"></i><strong>Email:</strong> hello@hafamarket.com</div>
          <div><i class="fas fa-bolt" style="color:#7b1fa2;margin-right:8px"></i><strong>Response:</strong> Within 2 hours</div>
        </div>
        <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px">
          <button onclick="supOpenWhatsApp()" style="background:#25d366;color:#fff;border:none;padding:10px;border-radius:10px;cursor:pointer;font-weight:700;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fab fa-whatsapp"></i> Open WhatsApp</button>
          <a href="tel:${SUP_CONFIG.phone}" style="background:#1976d2;color:#fff;border:none;padding:10px;border-radius:10px;cursor:pointer;font-weight:700;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none"><i class="fas fa-phone"></i> Call Now</a>
        </div>
      </div>
    </div>

    <!-- Attachment preview strip -->
    <div class="sup-attach-strip" id="supAttachStrip" style="padding:0 12px;display:none"></div>

    <!-- Recording bar -->
    <div class="sup-recording-bar" id="supRecBar">
      <span class="sup-rec-dot"></span>
      <span>Recording voice message</span>
      <span class="sup-rec-timer" id="supRecTimer">00:00</span>
      <button class="sup-rec-cancel" onclick="cancelRecording()">Cancel</button>
    </div>

    <!-- Input -->
    <div class="sup-input-area">
      <div class="sup-input-row">
        <button class="sup-ibtn" onclick="document.getElementById('supFileInput').click()" title="Attach file"><i class="fas fa-paperclip"></i></button>
        <input type="file" id="supFileInput" multiple accept="*/*" style="display:none" onchange="handleSupFiles(event)" />
        <button class="sup-ibtn" onclick="document.getElementById('supImgInput').click()" title="Send image/video"><i class="fas fa-image"></i></button>
        <input type="file" id="supImgInput" multiple accept="image/*,video/*" style="display:none" onchange="handleSupFiles(event)" />
        <button class="sup-ibtn" id="supMicBtn" onclick="toggleSupRecording()" title="Voice message"><i class="fas fa-microphone"></i></button>
        <textarea class="sup-textarea" id="supInput" placeholder="Type a message..." rows="1"
          onkeydown="supHandleKey(event)" oninput="supAutoResize(this);supTypingIndicator()"></textarea>
        <button class="sup-ibtn" onclick="supSendEmoji()" title="Emoji"><i class="fas fa-smile"></i></button>
        <button class="sup-send-btn" onclick="sendSupMessage()" title="Send"><i class="fas fa-paper-plane"></i></button>
      </div>
      <div class="sup-input-footer">
        <span>🔒 End-to-end encrypted</span>
        <span>Supports all file types</span>
      </div>
    </div>
  </div>

  <!-- ===== CALL / VIDEO PANEL ===== -->
  <div class="sup-call-panel" id="supCallPanel">
    <div class="sup-call-avatar" id="supCallAvatar">${SUP_CONFIG.agent.emoji}</div>
    <div class="sup-call-name">${SUP_CONFIG.agent.name}</div>
    <div class="sup-call-status" id="supCallStatus">Calling...</div>
    <div class="sup-call-timer" id="supCallTimer" style="display:none">00:00</div>

    <div class="sup-video-wrap" id="supVideoWrap" style="display:none">
      <div class="sup-video-remote" id="supVideoRemote">
        <span>${SUP_CONFIG.agent.emoji}</span>
      </div>
      <div class="sup-video-local" id="supVideoLocal">
        <span>🙂</span>
      </div>
      <div class="sup-screen-overlay" id="supScreenOverlay" style="display:none">
        <i class="fas fa-desktop"></i>
        <p>Sharing your screen...</p>
      </div>
    </div>

    <div class="sup-call-controls">
      <button class="sup-ctrl-btn ctrl-mute" id="supMuteBtn" onclick="toggleMute()" title="Mute"><i class="fas fa-microphone"></i></button>
      <button class="sup-ctrl-btn ctrl-video" id="supVideoBtn" onclick="toggleVideo()" title="Camera" style="display:none"><i class="fas fa-video"></i></button>
      <button class="sup-ctrl-btn ctrl-screen" id="supCallShareBtn" onclick="toggleCallScreenShare()" title="Share Screen" style="display:none"><i class="fas fa-desktop"></i></button>
      <button class="sup-ctrl-btn ctrl-end" onclick="endCall()" title="End Call"><i class="fas fa-phone-slash"></i></button>
    </div>
  </div>

  <!-- Lightbox -->
  <div class="sup-lightbox" id="supLightbox" onclick="closeLightbox()">
    <img id="supLightboxImg" src="" alt="preview" />
    <button class="sup-lightbox-close" onclick="closeLightbox()"><i class="fas fa-times"></i></button>
  </div>`;

  document.body.appendChild(el);
}

// ===== LAUNCHER =====
function toggleSupLauncher() {
  supLauncherOpen = !supLauncherOpen;
  document.getElementById('supMenu').classList.toggle('open', supLauncherOpen);
  document.getElementById('supMainBtn').classList.toggle('rotated', supLauncherOpen);
}
function closeSupLauncher() {
  supLauncherOpen = false;
  document.getElementById('supMenu').classList.remove('open');
  document.getElementById('supMainBtn').classList.remove('rotated');
}

// ===== WHATSAPP =====
function supOpenWhatsApp() {
  window.open(`https://wa.me/${SUP_CONFIG.waNumber}?text=${encodeURIComponent(SUP_CONFIG.waMsg)}`, '_blank');
  closeSupLauncher();
}

// ===== LIVE CHAT =====
function openLiveChat() {
  closeSupLauncher();
  supOpen = true;
  document.getElementById('supWindow').classList.add('open');
  if (!supMessages.length) {
    setTimeout(() => {
      addSupMsg('in', 'text', `👋 Hello! Welcome to **Hafa Market** live support.\n\nI'm here to help you with:\n• 🛒 Orders & products\n• 📦 Delivery & tracking\n• 💳 Payments & refunds\n• 🌿 Seller support\n\nHow can I assist you today?`);
    }, 500);
    setTimeout(() => showSupTyping(), 200);
    setTimeout(() => hideSupTyping(), 450);
  }
}
function closeLiveChat() {
  supOpen = false;
  document.getElementById('supWindow').classList.remove('open');
  supExpand = 'normal';
  document.getElementById('supWindow').classList.remove('half-screen','full-screen');
}

// ===== EXPAND =====
function cycleExpand() {
  const win = document.getElementById('supWindow');
  const btn = document.getElementById('supExpandBtn');
  if (supExpand === 'normal') {
    supExpand = 'half';
    win.classList.add('half-screen');
    win.classList.remove('full-screen');
    btn.innerHTML = '<i class="fas fa-compress-alt"></i>';
    btn.title = 'Full Screen';
  } else if (supExpand === 'half') {
    supExpand = 'full';
    win.classList.add('full-screen');
    win.classList.remove('half-screen');
    btn.innerHTML = '<i class="fas fa-compress"></i>';
    btn.title = 'Restore';
  } else {
    supExpand = 'normal';
    win.classList.remove('half-screen','full-screen');
    btn.innerHTML = '<i class="fas fa-expand-alt"></i>';
    btn.title = 'Expand';
  }
}

// ===== TABS =====
function switchSupTab(btn, tab) {
  supActiveTab = tab;
  document.querySelectorAll('.sup-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('supTabChat').style.display  = tab === 'chat'  ? 'flex' : 'none';
  document.getElementById('supTabFiles').style.display = tab === 'files' ? 'flex' : 'none';
  document.getElementById('supTabInfo').style.display  = tab === 'info'  ? 'block': 'none';
  if (tab === 'chat') document.getElementById('supTabChat').style.flexDirection = 'column';
  if (tab === 'files') document.getElementById('supTabFiles').style.flexDirection = 'column';
}

// ===== MESSAGES =====
function addSupMsg(dir, type, content, meta) {
  const container = document.getElementById('supMessages');
  const msg = { dir, type, content, meta, time: supNow() };
  supMessages.push(msg);

  const wrap = document.createElement('div');
  wrap.className = `sup-msg sup-msg-${dir}`;

  let bubble = '';
  if (type === 'text') {
    const formatted = content.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    bubble = `<div class="sup-msg-text">${formatted}</div>`;
  } else if (type === 'image') {
    bubble = `<img src="${content}" class="sup-msg-img" onclick="openLightbox('${content}')" alt="image" />`;
    addToFilesList('image', content, meta);
  } else if (type === 'video') {
    bubble = `<video src="${content}" class="sup-msg-img" controls style="max-height:160px"></video>`;
    addToFilesList('video', content, meta);
  } else if (type === 'audio') {
    bubble = `<div class="sup-msg-audio">
      <button class="sup-audio-play" onclick="playAudio('${content}')"><i class="fas fa-play"></i></button>
      <div class="sup-audio-wave">${'<span></span>'.repeat(7)}</div>
      <span class="sup-audio-dur">${meta?.dur || '0:00'}</span>
    </div>`;
    addToFilesList('audio', content, meta);
  } else if (type === 'file') {
    bubble = `<div class="sup-msg-file" onclick="window.open('${content}')">
      <span class="sup-msg-file-icon">${supFileIcon(meta?.ext||'')}</span>
      <div class="sup-msg-file-info">
        <div class="sup-msg-file-name">${meta?.name||'File'}</div>
        <div class="sup-msg-file-size">${meta?.size||''}</div>
      </div>
      <i class="fas fa-download" style="color:#9ca3af;font-size:.85rem"></i>
    </div>`;
    addToFilesList('file', content, meta);
  }

  const tick = dir === 'out' ? '<span class="sup-msg-tick"><i class="fas fa-check-double"></i></span>' : '';
  wrap.innerHTML = `
    ${dir === 'in' ? `<div class="sup-msg-av">${SUP_CONFIG.agent.emoji}</div>` : ''}
    <div class="sup-msg-bubble">
      ${bubble}
      <div class="sup-msg-time">${msg.time} ${tick}</div>
    </div>`;

  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

function addToFilesList(type, src, meta) {
  const list = document.getElementById('supFilesList');
  if (list.querySelector('p')) list.innerHTML = '';
  const item = document.createElement('div');
  item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;background:#fff;border-radius:10px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,.07);cursor:pointer';
  item.innerHTML = `<span style="font-size:1.8rem">${supFileIcon(meta?.ext||type)}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:.82rem;font-weight:700;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${meta?.name||type}</div>
      <div style="font-size:.72rem;color:#9ca3af">${meta?.size||''} · ${supNow()}</div>
    </div>
    <i class="fas fa-download" style="color:#7b1fa2"></i>`;
  item.onclick = () => type === 'image' ? openLightbox(src) : window.open(src);
  list.appendChild(item);
}

function showSupTyping() {
  const c = document.getElementById('supMessages');
  const d = document.createElement('div');
  d.className = 'sup-msg sup-msg-in sup-typing'; d.id = 'supTyping';
  d.innerHTML = `<div class="sup-msg-av">${SUP_CONFIG.agent.emoji}</div>
    <div class="sup-typing-dots"><span></span><span></span><span></span></div>`;
  c.appendChild(d); c.scrollTop = c.scrollHeight;
}
function hideSupTyping() { const t = document.getElementById('supTyping'); if(t) t.remove(); }

// ===== SEND MESSAGE =====
function sendSupMessage(text) {
  const input = document.getElementById('supInput');
  const msg = text || input.value.trim();

  // Send attachments first
  if (supAttachments.length) {
    supAttachments.forEach(a => addSupMsg('out', a.type, a.src, a.meta));
    supAttachments = [];
    document.getElementById('supAttachStrip').innerHTML = '';
    document.getElementById('supAttachStrip').style.display = 'none';
  }

  if (msg) {
    addSupMsg('out', 'text', msg);
    input.value = ''; input.style.height = 'auto';
    simulateAgentReply(msg);
  }
}

function simulateAgentReply(userMsg) {
  showSupTyping();
  const delay = 1200 + Math.random() * 1000;
  setTimeout(() => {
    hideSupTyping();
    const m = userMsg.toLowerCase();
    let reply = '';
    if (/order|track/i.test(m)) reply = "I can help you track your order! 📦 Please share your order number (e.g. HM-2024-XXXX) and I'll look it up for you right away.";
    else if (/deliver/i.test(m)) reply = "Our delivery takes 24–48 hours 🚚 We cover 30+ cities. Free delivery on orders over $50! Is there a specific delivery concern I can help with?";
    else if (/pay|refund|money/i.test(m)) reply = "For payment issues or refunds, I'm here to help! 💳 Could you share your order number so I can check the details?";
    else if (/product|buy|price/i.test(m)) reply = "Great question! 🛒 We have 10,000+ fresh agricultural products. You can browse by category or use the search bar. What are you looking for specifically?";
    else if (/seller|sell/i.test(m)) reply = "Interested in selling on Hafa Market? 🌿 We'd love to have you! Click 'Become a Seller' on the homepage or I can walk you through the process right now.";
    else if (/hello|hi|hey|help/i.test(m)) reply = `Hello! 👋 Great to hear from you. I'm ${SUP_CONFIG.agent.name} and I'm here to help. What can I assist you with today?`;
    else reply = "Thank you for reaching out! 😊 I'm looking into this for you. Could you provide a bit more detail so I can give you the best assistance possible?";
    addSupMsg('in', 'text', reply);
  }, delay);
}

function supHandleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendSupMessage(); }
}
function supAutoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight,120)+'px'; }
function supTypingIndicator() {
  clearTimeout(supTypingTimer);
  supTypingTimer = setTimeout(() => {}, 1000);
}

// ===== EMOJI =====
const EMOJIS = ['😊','👍','🙏','❤️','🌿','🥬','🍎','🌾','🚚','💳','📦','✅','🔥','⭐','😄','🤝'];
function supSendEmoji() {
  const input = document.getElementById('supInput');
  const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  input.value += emoji; input.focus();
}

// ===== FILE HANDLING =====
function handleSupFiles(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  files.forEach(file => {
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target.result;
      const meta = { name: file.name, size: supFileSize(file.size), ext };
      let type = 'file';
      if (supFileTypes.image.includes(ext)) type = 'image';
      else if (supFileTypes.video.includes(ext)) type = 'video';
      else if (supFileTypes.audio.includes(ext)) type = 'audio';

      supAttachments.push({ type, src, meta });
      renderAttachStrip();
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
}

function renderAttachStrip() {
  const strip = document.getElementById('supAttachStrip');
  strip.style.display = supAttachments.length ? 'flex' : 'none';
  strip.innerHTML = supAttachments.map((a, i) => `
    <div class="sup-attach-thumb">
      ${a.type === 'image' ? `<img src="${a.src}" alt="attach" />` : `<div class="sup-attach-name">${a.meta.name}</div>`}
      <button class="sup-attach-rm" onclick="removeAttach(${i})">×</button>
    </div>`).join('');
}
function removeAttach(i) {
  supAttachments.splice(i, 1);
  renderAttachStrip();
}

// ===== VOICE RECORDING =====
async function toggleSupRecording() {
  if (supRecording) { stopRecording(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    supMediaRecorder = new MediaRecorder(stream);
    supRecChunks = [];
    supMediaRecorder.ondataavailable = e => supRecChunks.push(e.data);
    supMediaRecorder.onstop = () => {
      const blob = new Blob(supRecChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      addSupMsg('out', 'audio', url, { dur: supFmt(supRecSeconds), name: 'Voice message', size: supFileSize(blob.size), ext: 'webm' });
      stream.getTracks().forEach(t => t.stop());
    };
    supMediaRecorder.start();
    supRecording = true;
    supRecSeconds = 0;
    document.getElementById('supMicBtn').classList.add('recording');
    document.getElementById('supRecBar').classList.add('active');
    supRecTimer = setInterval(() => {
      supRecSeconds++;
      document.getElementById('supRecTimer').textContent = supFmt(supRecSeconds);
      if (supRecSeconds >= 300) stopRecording(); // max 5 min
    }, 1000);
  } catch(err) {
    alert('Microphone access denied. Please allow microphone access to send voice messages.');
  }
}
function stopRecording() {
  if (!supMediaRecorder) return;
  supMediaRecorder.stop();
  supRecording = false;
  clearInterval(supRecTimer);
  document.getElementById('supMicBtn').classList.remove('recording');
  document.getElementById('supRecBar').classList.remove('active');
}
function cancelRecording() {
  if (supMediaRecorder && supRecording) {
    supMediaRecorder.ondataavailable = null;
    supMediaRecorder.onstop = null;
    supMediaRecorder.stop();
    supMediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
  supRecording = false;
  clearInterval(supRecTimer);
  document.getElementById('supMicBtn').classList.remove('recording');
  document.getElementById('supRecBar').classList.remove('active');
}

function playAudio(src) {
  const a = new Audio(src); a.play();
}

// ===== SCREEN SHARE (from chat window) =====
async function startScreenShare() {
  if (supScreenSharing) { stopScreenShare(); return; }
  try {
    supScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    supScreenSharing = true;
    document.getElementById('supShareBanner').classList.add('active');
    document.getElementById('supShareBtn').classList.add('active');
    addSupMsg('out', 'text', '🖥️ I am now sharing my screen with you.');
    supScreenStream.getVideoTracks()[0].onended = () => stopScreenShare();
    showSupTyping();
    setTimeout(() => { hideSupTyping(); addSupMsg('in', 'text', "✅ I can see your screen now! Please go ahead and show me the issue and I'll guide you through it."); }, 1500);
  } catch(err) {
    if (err.name !== 'NotAllowedError') alert('Screen sharing failed: ' + err.message);
  }
}
function stopScreenShare() {
  if (supScreenStream) { supScreenStream.getTracks().forEach(t => t.stop()); supScreenStream = null; }
  supScreenSharing = false;
  document.getElementById('supShareBanner').classList.remove('active');
  document.getElementById('supShareBtn').classList.remove('active');
  addSupMsg('out', 'text', '🖥️ Screen sharing stopped.');
}

// ===== CALL =====
async function startCall(type) {
  supCallType = type;
  supCallActive = true;
  supCallSeconds = 0;
  supMuted = false; supVideoOff = false;

  const panel = document.getElementById('supCallPanel');
  panel.classList.add('active');
  document.getElementById('supCallStatus').textContent = 'Calling...';
  document.getElementById('supCallTimer').style.display = 'none';
  document.getElementById('supVideoWrap').style.display = type === 'video' ? 'block' : 'none';
  document.getElementById('supVideoBtn').style.display = type === 'video' ? 'flex' : 'none';
  document.getElementById('supCallShareBtn').style.display = type === 'video' ? 'flex' : 'none';

  // Simulate call connecting
  setTimeout(async () => {
    document.getElementById('supCallStatus').textContent = 'Connected';
    document.getElementById('supCallTimer').style.display = 'block';
    supCallTimer = setInterval(() => {
      supCallSeconds++;
      document.getElementById('supCallTimer').textContent = supFmt(supCallSeconds);
    }, 1000);

    if (type === 'video') {
      try {
        supLocalStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const localVid = document.createElement('video');
        localVid.srcObject = supLocalStream; localVid.autoplay = true; localVid.muted = true;
        localVid.style.cssText = 'width:100%;height:100%;object-fit:cover';
        const localWrap = document.getElementById('supVideoLocal');
        localWrap.innerHTML = ''; localWrap.appendChild(localVid);
      } catch(e) { /* camera not available */ }
    }
  }, 2000);
}

function endCall() {
  supCallActive = false;
  clearInterval(supCallTimer);
  document.getElementById('supCallPanel').classList.remove('active');
  if (supLocalStream) { supLocalStream.getTracks().forEach(t => t.stop()); supLocalStream = null; }
  if (supScreenStream) stopScreenShare();
  const dur = supFmt(supCallSeconds);
  addSupMsg('in', 'text', `📞 Call ended · Duration: ${dur}`);
}

function toggleMute() {
  supMuted = !supMuted;
  if (supLocalStream) supLocalStream.getAudioTracks().forEach(t => t.enabled = !supMuted);
  const btn = document.getElementById('supMuteBtn');
  btn.innerHTML = supMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
  btn.classList.toggle('ctrl-active', supMuted);
}
function toggleVideo() {
  supVideoOff = !supVideoOff;
  if (supLocalStream) supLocalStream.getVideoTracks().forEach(t => t.enabled = !supVideoOff);
  const btn = document.getElementById('supVideoBtn');
  btn.innerHTML = supVideoOff ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
  btn.classList.toggle('ctrl-active', supVideoOff);
}
async function toggleCallScreenShare() {
  if (supScreenSharing) {
    if (supScreenStream) { supScreenStream.getTracks().forEach(t => t.stop()); supScreenStream = null; }
    supScreenSharing = false;
    document.getElementById('supCallShareBtn').classList.remove('ctrl-active');
    document.getElementById('supScreenOverlay').style.display = 'none';
    return;
  }
  try {
    supScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    supScreenSharing = true;
    document.getElementById('supCallShareBtn').classList.add('ctrl-active');
    document.getElementById('supScreenOverlay').style.display = 'flex';
    supScreenStream.getVideoTracks()[0].onended = () => toggleCallScreenShare();
  } catch(e) { /* denied */ }
}

// ===== LIGHTBOX =====
function openLightbox(src) {
  document.getElementById('supLightboxImg').src = src;
  document.getElementById('supLightbox').classList.add('open');
}
function closeLightbox() { document.getElementById('supLightbox').classList.remove('open'); }

// ===== OUTSIDE CLICK =====
document.addEventListener('click', e => {
  if (!e.target.closest('#hafaSupport')) closeSupLauncher();
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  buildSupportWidget();
});
