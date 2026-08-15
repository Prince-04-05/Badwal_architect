/* ═══════════════════════════════════════════════════════════
   BADWAL AI ASSISTANT
   Self-contained, isolated chatbot for Badwal Architect.
   No external framework — vanilla JS, lazy-initialized on
   first interaction to keep the host page's performance intact.

   Architecture:
     Chat Widget → (optional) POST /api/chat → Backend → AI Model
     If no backend is configured, or the backend call fails, the
     widget falls back to a local, rule-based knowledge-base
     engine so the assistant always keeps working.

   IMPORTANT: this file never contains a secret AI API key.
   Only a same-origin endpoint path is referenced (CONFIG.backendUrl).
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────
     0. CONFIG
  ───────────────────────────────────────────────────────── */
const CONFIG = {
     backendUrl: '/api/chat',
    storageKeys: {
      open: 'badwal_ai_open',
      history: 'badwal_ai_history',
      lead: 'badwal_ai_lead'
    },
    typingDelayMs: [500, 1100], // min/max simulated "thinking" time
  };

  /* ─────────────────────────────────────────────────────────
     1. KNOWLEDGE BASE (sourced only from the live website)
  ───────────────────────────────────────────────────────── */
  const KB = {
    name: 'Badwal Architect',
    tagline: 'Designing Dreams into Reality',
    about:
      "Badwal Architect is a premium architecture and interior design studio focused on creating spaces that combine aesthetics, functionality and craftsmanship. The studio has over 15 years of experience.",
    stats: { projects: '250+', years: '15+', awards: '40+', satisfaction: '98%' },
    services: {
      architecture: {
        label: 'Architecture Design',
        text: "Architecture Design covers concept development, architectural planning, design development and construction documentation — from conceptual sketches to construction documentation, with a focus on functional and aesthetic building design.",
        cta: 'Explore Architecture Design'
      },
      interior: {
        label: 'Interior Design',
        text: "Interior Design covers interior planning, materials, textures, fixtures and furniture planning — curated, cohesive interior concepts tailored to your lifestyle.",
        cta: 'Explore Interior Projects'
      },
      visualization: {
        label: '3D Visualization',
        text: "3D Visualization gives you photorealistic renders and immersive walkthrough concepts, so you can see and understand your space before construction begins.",
        cta: 'See Our Visualizations'
      },
      renovation: {
        label: 'Renovation Planning',
        text: "Renovation Planning includes existing-space assessment, renovation planning, space improvement, design upgrades and modernization.",
        cta: 'Discuss a Renovation'
      }
    },
    projectCategories: ['Residential', 'Interior', 'Exterior', 'Commercial'],
    projects: [
      'The Serene Villa, Chandigarh', 'Luxury Penthouse Suite', 'The Grand Tower',
      'Minimalist Kitchen Design', 'Modern Facade Renewal', 'Hillside Family Home',
      'Corporate Campus, Mohali'
    ],
    contact: {
      phone: '+91 9417294381',
      phoneHref: 'tel:9417294381',
      email: 'pbadwal320@gmail.com',
      emailHref: 'mailto:pbadwal320@gmail.com',
      address: 'Sham Chaurasi, Punjab 144105',
      mapsUrl: 'https://maps.app.goo.gl/Ahc4vAQbHX3HWR6z7',
      hours: 'Mon – Sun, 9:00 AM – 7:00 PM'
    },
    projectTypes: ['Residential Design', 'Commercial Design', 'Interior Design', 'Renovation', '3D Visualization', 'Consultation'],
    budgetRanges: ['₹10L – ₹25L', '₹25L – ₹50L', '₹50L – ₹1Cr', '₹1Cr – ₹5Cr', '₹5Cr+'],
    sections: {
      projects: '#projects', about: '#about', services: '#services',
      testimonials: '#testimonials', gallery: '#gallery', contact: '#contact'
    }
  };

  const UNAVAILABLE_DETAIL =
    "That specific detail isn't currently available in my information. I can help you connect with the Badwal Architect team for more information.";

  /* ─────────────────────────────────────────────────────────
     2. STATE
  ───────────────────────────────────────────────────────── */
  const state = {
    initialized: false,
    open: false,
    history: [], // {role, text, ts}
    lead: { name: null, phone: null, email: null, projectType: null, location: null, budget: null, description: null, timeline: null },
    leadFlow: null, // current step key while qualifying, or null
    awaitingLeadConfirm: false
  };

  /* ─────────────────────────────────────────────────────────
     3. UTILITIES
  ───────────────────────────────────────────────────────── */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
  }
  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function saveHistory() {
    try { localStorage.setItem(CONFIG.storageKeys.history, JSON.stringify(state.history.slice(-40))); } catch (e) {}
  }
  function saveLead() {
    try { localStorage.setItem(CONFIG.storageKeys.lead, JSON.stringify(state.lead)); } catch (e) {}
  }
  function loadPersisted() {
    try {
      const h = localStorage.getItem(CONFIG.storageKeys.history);
      if (h) state.history = JSON.parse(h);
    } catch (e) { state.history = []; }
    try {
      const l = localStorage.getItem(CONFIG.storageKeys.lead);
      if (l) state.lead = Object.assign(state.lead, JSON.parse(l));
    } catch (e) {}
  }
  function scrollToSection(hash) {
    const target = document.querySelector(hash);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  }

  /* ─────────────────────────────────────────────────────────
     4. UI CONSTRUCTION
  ───────────────────────────────────────────────────────── */
  let ui = {};

  function buildUI() {
    const root = el('div', 'badwal-ai-root');
    root.setAttribute('data-badwal-ai', '');

    // Launcher
    const launcher = el('button', 'badwal-ai-launcher');
    launcher.type = 'button';
    launcher.setAttribute('aria-label', 'Open Badwal AI Assistant');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
      '<path d="M4 4h16v12H8l-4 4V4z" stroke-linejoin="round"/>' +
      '<path d="M8 9h8M8 12.5h5" stroke-linecap="round"/>' +
      '</svg>' +
      '<span class="badwal-ai-launcher-badge"></span>';

    // Window
    const win = el('div', 'badwal-ai-window');
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-modal', 'false');
    win.setAttribute('aria-label', 'Badwal AI Assistant chat');

    win.innerHTML =
      '<div class="badwal-ai-header">' +
        '<div class="badwal-ai-mark" aria-hidden="true">B</div>' +
        '<div class="badwal-ai-header-text">' +
          '<div class="badwal-ai-title">Badwal AI Assistant</div>' +
          '<div class="badwal-ai-subtitle">Architecture • Interiors • Design</div>' +
          '<div class="badwal-ai-status"><span class="badwal-ai-status-dot"></span>Online</div>' +
        '</div>' +
        '<div class="badwal-ai-header-actions">' +
          '<button type="button" class="badwal-ai-icon-btn" data-action="clear" aria-label="Clear conversation" title="Clear conversation">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m2 0-1 13a2 2 0 01-2 2H10a2 2 0 01-2-2L7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '</button>' +
          '<button type="button" class="badwal-ai-icon-btn" data-action="minimize" aria-label="Minimize chat" title="Minimize">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 12h14" stroke-linecap="round"/></svg>' +
          '</button>' +
          '<button type="button" class="badwal-ai-icon-btn" data-action="close" aria-label="Close chat" title="Close">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="badwal-ai-body" id="badwalAiBody" tabindex="-1"></div>' +
      '<div class="badwal-ai-suggestions" id="badwalAiSuggestions"></div>' +
      '<div class="badwal-ai-inputbar">' +
        '<textarea class="badwal-ai-textarea" id="badwalAiInput" rows="1" placeholder="Type your message…" aria-label="Type your message"></textarea>' +
        '<button type="button" class="badwal-ai-send" id="badwalAiSend" aria-label="Send message">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12l16-8-6 8 6 8-16-8z" stroke-linejoin="round"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="badwal-ai-footer">AI Assistant • Badwal Architect</div>';

    root.appendChild(win);
    root.appendChild(launcher);
    document.body.appendChild(root);

    ui = {
      root, launcher, win,
      body: $('#badwalAiBody', win),
      suggestions: $('#badwalAiSuggestions', win),
      input: $('#badwalAiInput', win),
      send: $('#badwalAiSend', win)
    };

    wireEvents();
  }

  function wireEvents() {
    ui.launcher.addEventListener('click', toggleOpen);
    ui.win.querySelector('[data-action="close"]').addEventListener('click', () => setOpen(false));
    ui.win.querySelector('[data-action="minimize"]').addEventListener('click', () => setOpen(false));
    ui.win.querySelector('[data-action="clear"]').addEventListener('click', clearConversation);

    ui.send.addEventListener('click', sendFromInput);
    ui.input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendFromInput();
      }
    });
    ui.input.addEventListener('input', () => {
      ui.input.style.height = 'auto';
      ui.input.style.height = Math.min(ui.input.scrollHeight, 90) + 'px';
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.open) setOpen(false);
    });
  }

  function toggleOpen() { setOpen(!state.open); }

  function setOpen(val) {
    state.open = val;
    ui.win.classList.toggle('open', val);
    ui.launcher.setAttribute('aria-expanded', String(val));
    ui.launcher.querySelector('.badwal-ai-launcher-badge').classList.toggle('hide', val);
    try { localStorage.setItem(CONFIG.storageKeys.open, val ? '1' : '0'); } catch (e) {}
    if (val) {
      if (!state.initialized) startConversation();
      setTimeout(() => ui.input.focus(), 300);
      ui.body.scrollTop = ui.body.scrollHeight;
    }
  }

  /* ─────────────────────────────────────────────────────────
     5. MESSAGE RENDERING
  ───────────────────────────────────────────────────────── */
  function addMessage(role, text, opts) {
    opts = opts || {};
    const ts = Date.now();
    state.history.push({ role, text, ts });
    saveHistory();

    const row = el('div', 'badwal-ai-row ' + role);
    const bubble = el('div', 'badwal-ai-bubble', escapeHtml(text).replace(/\n/g, '<br>'));
    row.appendChild(bubble);

    if (opts.chips && opts.chips.length) {
      const chipsWrap = el('div', 'badwal-ai-chips');
      opts.chips.forEach(chip => {
        const btn = el('button', 'badwal-ai-chip', escapeHtml(chip.label));
        btn.type = 'button';
        btn.addEventListener('click', () => handleChipClick(chip));
        chipsWrap.appendChild(btn);
      });
      row.appendChild(chipsWrap);
    }

    if (opts.cta) {
      const ctaBtn = el('button', 'badwal-ai-cta' + (opts.cta.secondary ? ' secondary' : ''), escapeHtml(opts.cta.label));
      ctaBtn.type = 'button';
      ctaBtn.addEventListener('click', () => handleCtaClick(opts.cta));
      row.appendChild(ctaBtn);
    }

    const time = el('div', 'badwal-ai-time', formatTime(ts));
    row.appendChild(time);

    ui.body.appendChild(row);
    ui.body.scrollTop = ui.body.scrollHeight;
    return row;
  }

  function showTyping() {
    const row = el('div', 'badwal-ai-row assistant');
    row.id = 'badwalAiTypingRow';
    row.innerHTML = '<div class="badwal-ai-typing" aria-label="Assistant is typing"><span></span><span></span><span></span></div>';
    ui.body.appendChild(row);
    ui.body.scrollTop = ui.body.scrollHeight;
  }
  function hideTyping() {
    const row = document.getElementById('badwalAiTypingRow');
    if (row) row.remove();
  }

  function respondWithDelay(fn) {
    showTyping();
    const [min, max] = CONFIG.typingDelayMs;
    const delay = min + Math.random() * (max - min);
    setTimeout(() => { hideTyping(); fn(); }, delay);
  }

  function showError() {
    const row = el('div', 'badwal-ai-row assistant');
    row.innerHTML =
      '<div class="badwal-ai-error">Sorry, I\'m having trouble connecting right now. You can still contact the Badwal Architect studio directly.</div>';
    const ctaWrap = el('div', 'badwal-ai-chips');
    [
      { label: 'Call Studio', action: 'call' },
      { label: 'Email Studio', action: 'email' },
      { label: 'Contact Form', action: 'nav', target: KB.sections.contact }
    ].forEach(c => {
      const btn = el('button', 'badwal-ai-chip', c.label);
      btn.type = 'button';
      btn.addEventListener('click', () => runAction(c));
      ctaWrap.appendChild(btn);
    });
    row.appendChild(ctaWrap);
    const retry = el('button', 'badwal-ai-retry', 'Try Again');
    retry.type = 'button';
    retry.addEventListener('click', () => {
      row.remove();
      const last = [...state.history].reverse().find(m => m.role === 'user');
      if (last) processUserText(last.text);
    });
    row.appendChild(retry);
    ui.body.appendChild(row);
    ui.body.scrollTop = ui.body.scrollHeight;
  }

  /* ─────────────────────────────────────────────────────────
     6. QUICK ACTIONS (chips / CTA handling / navigation)
  ───────────────────────────────────────────────────────── */
  function runAction(action) {
    switch (action.action) {
      case 'nav':
        addMessage('assistant', 'Taking you there now.');
        setTimeout(() => scrollToSection(action.target), 250);
        break;
      case 'call':
        window.location.href = KB.contact.phoneHref;
        break;
      case 'email':
        window.location.href = KB.contact.emailHref;
        break;
      case 'directions':
        window.open(KB.contact.mapsUrl, '_blank', 'noopener');
        break;
      case 'startLead':
        beginLeadQualification(action.projectType || null);
        break;
      case 'showLeadForm':
        renderLeadForm();
        break;
      case 'submitLead':
        submitLead();
        break;
      case 'message':
        processUserText(action.text);
        break;
      default:
        break;
    }
  }
  function handleChipClick(chip) {
    // Echo the chip as a user message unless it's a silent nav/action-only chip
    if (chip.echo !== false) addMessage('user', chip.label);
    runAction(chip);
  }
  function handleCtaClick(cta) { runAction(cta); }

  /* ─────────────────────────────────────────────────────────
     7. CONVERSATION START / QUICK SUGGESTIONS BAR
  ───────────────────────────────────────────────────────── */
  const PERSISTENT_SUGGESTIONS = [
    'How can you help me?', 'What services do you offer?', 'I want to build a house',
    'I need interior design', 'What is the design process?', 'I want a renovation',
    'I want to discuss my project', 'How can I contact you?'
  ];

  function renderSuggestionBar() {
    ui.suggestions.innerHTML = '';
    PERSISTENT_SUGGESTIONS.forEach(q => {
      const chip = el('button', 'badwal-ai-chip', q);
      chip.type = 'button';
      chip.addEventListener('click', () => processUserText(q));
      ui.suggestions.appendChild(chip);
    });
  }

  function startConversation() {
    state.initialized = true;
    loadPersisted();
    renderSuggestionBar();

    if (state.history.length) {
      // Replay persisted history
      state.history.forEach(m => {
        const row = el('div', 'badwal-ai-row ' + m.role);
        row.appendChild(el('div', 'badwal-ai-bubble', escapeHtml(m.text).replace(/\n/g, '<br>')));
        row.appendChild(el('div', 'badwal-ai-time', formatTime(m.ts)));
        ui.body.appendChild(row);
      });
      ui.body.scrollTop = ui.body.scrollHeight;
      return;
    }

    addMessage('assistant',
      "Welcome to Badwal Architect.\n\nI'm your AI design assistant. I can help you explore our architecture, interior design, renovation and 3D visualization services, or help you plan your project.",
      {
        chips: [
          { label: 'Start a Project', action: 'startLead' },
          { label: 'Architecture Design', action: 'message', text: 'Tell me about architecture design' },
          { label: 'Interior Design', action: 'message', text: 'Tell me about interior design' },
          { label: '3D Visualization', action: 'message', text: 'Tell me about 3D visualization' },
          { label: 'Renovation', action: 'message', text: 'Tell me about renovation' },
          { label: 'View Projects', action: 'nav', target: KB.sections.projects, echo: false },
          { label: 'Contact Studio', action: 'nav', target: KB.sections.contact, echo: false }
        ]
      }
    );
  }

  function clearConversation() {
    state.history = [];
    state.lead = { name: null, phone: null, email: null, projectType: null, location: null, budget: null, description: null, timeline: null };
    state.leadFlow = null;
    saveHistory(); saveLead();
    ui.body.innerHTML = '';
    state.initialized = false;
    startConversation();
  }

  /* ─────────────────────────────────────────────────────────
     8. SENDING / DISPATCH
  ───────────────────────────────────────────────────────── */
  function sendFromInput() {
    const text = ui.input.value.trim();
    if (!text) return;
    ui.input.value = '';
    ui.input.style.height = 'auto';
    processUserText(text);
  }

  function processUserText(text) {
    addMessage('user', text);

    // If mid lead-qualification, route to the flow handler first
    if (state.leadFlow) {
      respondWithDelay(() => handleLeadFlowInput(text));
      return;
    }

    if (CONFIG.backendUrl) {
      respondWithBackend(text);
    } else {
      respondWithDelay(() => {
        const result = getKnowledgeResponse(text);
        addMessage('assistant', result.text, { chips: result.chips, cta: result.cta });
        if (result.startLead) beginLeadQualification(result.projectType || null);
      });
    }
  }

  async function respondWithBackend(text) {
    showTyping();
    try {
      const res = await fetch(CONFIG.backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: state.history.slice(-12)
        })
      });
      if (!res.ok) throw new Error('Backend error');
      const data = await res.json();
      hideTyping();
      addMessage('assistant', data.reply || UNAVAILABLE_DETAIL, { chips: data.chips, cta: data.cta });
    } catch (err) {
      hideTyping();
      showError();
    }
  }

  /* ─────────────────────────────────────────────────────────
     9. LOCAL KNOWLEDGE-BASE / INTENT ENGINE
  ───────────────────────────────────────────────────────── */
  const HIGH_INTENT_PATTERNS = [
    /\bhire\b/i, /\bstart (a|my) project\b/i, /\bneed an? architect\b/i,
    /\bquotation\b/i, /\bdiscuss my project\b/i, /\bbuild (a|my) house\b/i,
    /\bwant to (build|design|renovate)\b/i, /\bneed (interior|architecture|renovation)\b/i,
    /\bget started\b/i
  ];

  function matches(text, patterns) { return patterns.some(p => p.test(text)); }

  function getKnowledgeResponse(raw) {
    const text = raw.toLowerCase();

    // Greeting / capability
    if (/\b(hi|hello|hey)\b/.test(text) || /how can you help/.test(text)) {
      return {
        text: "Absolutely — I can walk you through our architecture, interior design, 3D visualization and renovation services, show you our past work, share contact details, or help you plan a new project.",
        chips: [
          { label: 'What services do you offer?', action: 'message', text: 'What services do you offer?' },
          { label: 'View Projects', action: 'nav', target: KB.sections.projects, echo: false },
          { label: 'Start a Project', action: 'startLead' }
        ]
      };
    }

    // Services overview
    if (/what services|services do you offer|what do you (do|offer)/.test(text)) {
      return {
        text: "Badwal Architect offers four core services: Architecture Design, Interior Design, 3D Visualization and Renovation Planning. Which would you like to explore?",
        chips: [
          { label: 'Architecture Design', action: 'message', text: 'Tell me about architecture design' },
          { label: 'Interior Design', action: 'message', text: 'Tell me about interior design' },
          { label: '3D Visualization', action: 'message', text: 'Tell me about 3D visualization' },
          { label: 'Renovation', action: 'message', text: 'Tell me about renovation' }
        ]
      };
    }

    // Individual services
    if (/architecture design|architectural design/.test(text)) {
      return { text: KB.services.architecture.text, cta: { label: KB.services.architecture.cta, action: 'nav', target: KB.sections.projects } };
    }
    if (/interior design|interiors?\b/.test(text) && !/exterior/.test(text)) {
      return { text: KB.services.interior.text, cta: { label: KB.services.interior.cta, action: 'nav', target: KB.sections.projects } };
    }
    if (/3d visual|render|walkthrough/.test(text)) {
      return { text: KB.services.visualization.text, cta: { label: KB.services.visualization.cta, action: 'nav', target: KB.sections.projects } };
    }
    if (/renovat/.test(text)) {
      return { text: KB.services.renovation.text, cta: { label: KB.services.renovation.cta, action: 'startLead' } };
    }

    // Design process
    if (/design process|how does it work|process\b/.test(text)) {
      return {
        text: "Our process typically moves from concept development and design planning, through detailed design development and documentation, to execution guidance — with 3D visualization along the way so you always know what to expect before it's built.",
        chips: [{ label: 'Start a Project', action: 'startLead' }]
      };
    }

    // Projects / portfolio
    if (/(see|show).*(project|work|portfolio)|view projects|house projects|examples of work/.test(text)) {
      let cat = null;
      if (/residential|house/.test(text)) cat = 'Residential';
      else if (/interior/.test(text)) cat = 'Interior';
      else if (/exterior|facade/.test(text)) cat = 'Exterior';
      else if (/commercial|office|corporate/.test(text)) cat = 'Commercial';

      if (cat) {
        return {
          text: `Certainly. You can explore our ${cat} projects for inspiration and see how we approach these spaces.`,
          cta: { label: `View ${cat} Projects`, action: 'nav', target: KB.sections.projects }
        };
      }
      return {
        text: "Of course. You can explore our Residential, Interior, Exterior and Commercial projects.",
        chips: KB.projectCategories.map(c => ({ label: c, action: 'nav', target: KB.sections.projects, echo: true }))
      };
    }

    // About / company
    if (/about (you|badwal)|who are you|tell me about (the )?(company|studio|firm)/.test(text)) {
      return {
        text: `${KB.about}\n\nThe studio has completed ${KB.stats.projects} projects, has ${KB.stats.awards} awards, and maintains a ${KB.stats.satisfaction} client satisfaction rate.`,
        cta: { label: 'Learn More About Us', action: 'nav', target: KB.sections.about }
      };
    }

    // Pricing / cost
    if (/how much|cost|price|fee|budget/.test(text) && !/budget range/.test(text)) {
      return {
        text: "Project fees depend on factors such as project type, size, scope and design requirements. If you'd like, I can collect a few details and help you prepare an enquiry for the Badwal Architect team.",
        cta: { label: 'Tell Us About Your Project', action: 'startLead' }
      };
    }

    // Contact / location
    if (/contact|phone|email|address|located|location|reach you|call you/.test(text)) {
      return {
        text: `Our studio is located at ${KB.contact.address}.\n\nPhone: ${KB.contact.phone}\nEmail: ${KB.contact.email}\nHours: ${KB.contact.hours}`,
        chips: [
          { label: 'Call Studio', action: 'call', echo: false },
          { label: 'Email Studio', action: 'email', echo: false },
          { label: 'Get Directions', action: 'directions', echo: false }
        ]
      };
    }
    if (/hours|open|working hours|when are you open/.test(text)) {
      return { text: `The studio is open ${KB.contact.hours}.` };
    }

    // Testimonials / reviews
    if (/testimonial|review|client feedback/.test(text)) {
      return {
        text: "You can read what past clients have said about working with Badwal Architect on the website.",
        cta: { label: 'View Testimonials', action: 'nav', target: KB.sections.testimonials }
      };
    }

    // Gallery
    if (/gallery|photos|images/.test(text)) {
      return { text: "Take a look through our project gallery for a closer visual tour of our work.", cta: { label: 'Open Gallery', action: 'nav', target: KB.sections.gallery } };
    }

    // Specific unavailable detail requests
    if (/exact cost|construction cost|plot size|completion date|architect'?s? name|material brand|which client/.test(text)) {
      return { text: UNAVAILABLE_DETAIL, cta: { label: 'Contact the Team', action: 'nav', target: KB.sections.contact } };
    }

    // High buying intent → lead qualification
    if (matches(text, HIGH_INTENT_PATTERNS)) {
      let projectType = null;
      if (/interior/.test(text)) projectType = 'Interior Design';
      else if (/renovat/.test(text)) projectType = 'Renovation';
      else if (/commercial|office/.test(text)) projectType = 'Commercial Design';
      else if (/house|residential|home/.test(text)) projectType = 'Residential Design';

      return {
        text: "That sounds like a great project. I can help you prepare the details for the Badwal Architect team.",
        startLead: true,
        projectType
      };
    }

    // Fallback
    return {
      text: "I can help with our services, past projects, the design process, or connecting you with the studio. Could you tell me a bit more about what you're looking for?",
      chips: [
        { label: 'What services do you offer?', action: 'message', text: 'What services do you offer?' },
        { label: 'View Projects', action: 'nav', target: KB.sections.projects, echo: false },
        { label: 'Contact Studio', action: 'nav', target: KB.sections.contact, echo: false }
      ]
    };
  }

  /* ─────────────────────────────────────────────────────────
     10. LEAD QUALIFICATION FLOW (conversational, one Q at a time)
  ───────────────────────────────────────────────────────── */
  const LEAD_STEPS = [
    { key: 'projectType', prompt: "Are you looking for Residential Design, Commercial Design, Interior Design, Renovation, 3D Visualization, or a Consultation?", chips: KB.projectTypes },
    { key: 'location', prompt: "Where is the project located?" },
    { key: 'budget', prompt: "What is your expected budget range?", chips: KB.budgetRanges },
    { key: 'timeline', prompt: "When would you like to start?" },
    { key: 'description', prompt: "Lastly, tell me a little about the design or space you have in mind." },
    { key: 'name', prompt: "Great — may I have your name?" },
    { key: 'phone', prompt: "And the best phone number to reach you on?" },
    { key: 'email', prompt: "And your email address?" }
  ];

  function beginLeadQualification(presetProjectType) {
    if (presetProjectType) state.lead.projectType = presetProjectType;
    state.leadFlow = nextLeadStep();
    saveLead();
    if (!state.leadFlow) {
      renderLeadSummary();
      return;
    }
    askCurrentLeadStep();
  }

  function nextLeadStep() {
    for (const step of LEAD_STEPS) {
      if (!state.lead[step.key]) return step.key;
    }
    return null;
  }

  function askCurrentLeadStep() {
    const step = LEAD_STEPS.find(s => s.key === state.leadFlow);
    if (!step) { renderLeadSummary(); return; }
    respondWithDelay(() => {
      addMessage('assistant', step.prompt, {
        chips: step.chips ? step.chips.map(c => ({ label: c, action: 'leadAnswer', value: c })) : null
      });
    });
  }

  // Intercept chip clicks tagged as lead answers
  const originalRunAction = runAction;
  runAction = function (action) {
    if (action.action === 'leadAnswer') {
      addMessage('user', action.value);
      applyLeadAnswer(action.value);
      return;
    }
    return originalRunAction(action);
  };

  function handleLeadFlowInput(text) {
    applyLeadAnswer(text.trim());
  }

  function applyLeadAnswer(value) {
    const key = state.leadFlow;
    if (!key) return;
    state.lead[key] = value;
    saveLead();
    const next = nextLeadStep();
    state.leadFlow = next;
    if (next) {
      askCurrentLeadStep();
    } else {
      renderLeadSummary();
    }
  }

  function renderLeadSummary() {
    const L = state.lead;
    const summary =
      `Perfect. Here's what I have:\n` +
      `Project: ${L.projectType || '—'}\n` +
      `Location: ${L.location || '—'}\n` +
      `Budget: ${L.budget || '—'}\n` +
      `Timeline: ${L.timeline || '—'}\n` +
      `Name: ${L.name || '—'}\n` +
      `Phone: ${L.phone || '—'}\n` +
      `Email: ${L.email || '—'}\n\n` +
      `Would you like to submit this as an enquiry to the Badwal Architect team?`;

    respondWithDelay(() => {
      addMessage('assistant', summary, {
        cta: { label: 'Submit Project Enquiry', action: 'submitLead' }
      });
    });
  }

  function submitLead() {
    // No secret keys here — this only marks the lead as ready and directs
    // the visitor to the existing, already-secured website contact form,
    // which is the single source of truth for enquiry submission.
    addMessage('assistant',
      "Thank you. Your project details are ready to be shared with the Badwal Architect team. I'll take you to the enquiry form now to confirm and send it.",
      { cta: { label: 'Go to Enquiry Form', action: 'nav', target: KB.sections.contact } }
    );
    state.leadFlow = null;
  }

  function renderLeadForm() {
    // Optional inline structured form, offered as an alternative entry point.
    const row = el('div', 'badwal-ai-row assistant');
    const form = el('div', 'badwal-ai-form');
    form.innerHTML =
      '<label for="baiFName">Full Name</label><input id="baiFName" type="text">' +
      '<label for="baiFPhone">Phone</label><input id="baiFPhone" type="tel">' +
      '<label for="baiFEmail">Email</label><input id="baiFEmail" type="email">' +
      '<label for="baiFType">Project Type</label><select id="baiFType"><option value="" disabled selected>Select…</option>' +
        KB.projectTypes.map(t => `<option>${t}</option>`).join('') + '</select>' +
      '<label for="baiFBudget">Budget</label><select id="baiFBudget"><option value="" disabled selected>Select…</option>' +
        KB.budgetRanges.map(b => `<option>${b}</option>`).join('') + '</select>' +
      '<label for="baiFDesc">Project Description</label><textarea id="baiFDesc"></textarea>';
    const submitBtn = el('button', 'badwal-ai-cta', 'Submit Enquiry');
    submitBtn.type = 'button';
    submitBtn.style.marginTop = '4px';
    submitBtn.addEventListener('click', () => {
      state.lead.name = $('#baiFName', form).value || state.lead.name;
      state.lead.phone = $('#baiFPhone', form).value || state.lead.phone;
      state.lead.email = $('#baiFEmail', form).value || state.lead.email;
      state.lead.projectType = $('#baiFType', form).value || state.lead.projectType;
      state.lead.budget = $('#baiFBudget', form).value || state.lead.budget;
      state.lead.description = $('#baiFDesc', form).value || state.lead.description;
      saveLead();
      renderLeadSummary();
    });
    row.appendChild(form);
    row.appendChild(submitBtn);
    ui.body.appendChild(row);
    ui.body.scrollTop = ui.body.scrollHeight;
  }

  /* ─────────────────────────────────────────────────────────
     11. INIT
  ───────────────────────────────────────────────────────── */
  function init() {
    if (document.querySelector('.badwal-ai-root')) return; // avoid double-init
    buildUI();
    // Restore previously open state (persisted UI preference only — never
    // auto-opens with sensitive data exposed, since messages are the
    // visitor's own).
    try {
      if (localStorage.getItem(CONFIG.storageKeys.open) === '1') setOpen(true);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
