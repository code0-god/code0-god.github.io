(function () {
  console.log('[parent] code_runner.js loaded');

  function getIframe(id) {
    return document.querySelector(`#editor-${id} iframe`);
  }

  // HTML escape
  function esc(s){
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ANSI -> HTML (SGR subset)
  function ansiToHtml(raw){
    if (!raw) return '';
    const sgrRe = /\x1b\[([\d;]*)m/g;
    let i = 0, m, html = '', classes = [];

    const open = () => classes.length ? `<span class="${classes.join(' ')}">` : '';
    const close = () => classes.length ? `</span>` : '';

    while ((m = sgrRe.exec(raw)) !== null){
      const chunk = raw.slice(i, m.index);
      html += esc(chunk) + close();
      classes = [];

      const codes = (m[1] || '').split(';').filter(Boolean).map(x=>parseInt(x,10));
      if (codes.length){
        let fg=null, bg=null;
        for(const n of codes){
          if (n===0){ classes=[]; fg=bg=null; continue; }
          if (n===1) classes.push('cr-ansi-bold');
          if (n===2) classes.push('cr-ansi-dim');
          if (n===3) classes.push('cr-ansi-italic');
          if (n===4) classes.push('cr-ansi-underline');

          if (n>=30 && n<=37) fg = ['black','red','green','yellow','blue','magenta','cyan','white'][n-30];
          if (n>=90 && n<=97) fg = ['gray','red','green','yellow','blue','magenta','cyan','white'][n-90];
          if (n>=40 && n<=47) bg = ['black','red','green','yellow','blue','magenta','cyan','white'][n-40];
          if (n>=100 && n<=107) bg = ['gray','red','green','yellow','blue','magenta','cyan','white'][n-100];
        }
        if (fg) classes.push(`cr-ansi-fg-${fg}`);
        if (bg && bg!=='black') classes.push(`cr-ansi-bg-${bg}`);
      }
      html += open();
      i = m.index + m[0].length;
    }
    html += esc(raw.slice(i)) + close();

    // 패턴 하이라이트
    html = html
      .replace(/(^|\n)(.*?\bfatal error:)/gi, (_,nl,seg)=> nl + seg.replace(/fatal error:/i,'<span class="cr-error">fatal error:</span>'))
      .replace(/(^|\n)(.*?\berror:)/gi,      (_,nl,seg)=> nl + seg.replace(/error:/i,'<span class="cr-error">error:</span>'))
      .replace(/(^|\n)(.*?\bwarning:)/gi,    (_,nl,seg)=> nl + seg.replace(/warning:/i,'<span class="cr-warning">warning:</span>'))
      .replace(/(^|\n)(.*?\bnote:)/gi,       (_,nl,seg)=> nl + seg.replace(/note:/i,'<span class="cr-note">note:</span>'));

    html = html.replace(
      /(^|\n)([^\s:<][^\n:]*?\.\w+):(\d+):(\d+):/g,
      (_, nl, file, line, col) =>
        `${nl}<span class="cr-file">${file}</span>:<span class="cr-lineno">${line}</span>:<span class="cr-col">${col}</span>:`
    );

    html = html.replace(/(^|\n)(\s*\d+\s*\|\s)/g,
      (_, nl, gut) => `${nl}<span class="cr-gutter">${gut}</span>`
    );

    html = html.replace(/(^|\n)(\s*\|\s*)([\^~]+)(?=(\s*)($|\n))/g,
      (_, nl, lead, marks) => `${nl}${lead}<span class="cr-caret">${marks}</span>`
    );
    html = html.replace(/(^|\n)(\s*)([\^~]+)(\s*)($|\n)/g,
      (_, nl, lead, marks, trail, end) => `${nl}${lead}<span class="cr-caret">${marks}</span>${trail}${end}`
    );

    html = html
      .replace(/‘([^’]+)’/g, '‘<span class="cr-symbol">$1</span>’')
      .replace(/'([^']+)'/g, '\'<span class="cr-symbol">$1</span>\'');

    return html;
  }

  function sendInitToIframe(id) {
    const iframe = getIframe(id);
    if (!iframe) return;

    // 코드/메타는 숨김 JSON 스크립트에서 가져옴
    const holder = document.getElementById(`cr-code-${id}`);
    let payload = null;
    try { payload = holder ? JSON.parse(holder.textContent) : null; } catch (e) { payload = null; }

    const lang = (payload && payload.lang) || (iframe.dataset.lang || 'cpp');
    const filename = (payload && payload.filename) || (iframe.dataset.filename || 'main.cpp');
    const code = (payload && payload.code) || '';

    iframe.contentWindow.postMessage({ type:'init', id, lang, filename, code }, '*');
  }

  function initRunners() {
    document.querySelectorAll('.code-runner-run').forEach(runBtn => {
      const id = runBtn.dataset.runnerId;
      const iframe = getIframe(id);

      // iframe 로드 후 초기 코드/메타 전송
      if (iframe) {
        if (iframe.contentWindow && iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
          sendInitToIframe(id);
        } else {
          iframe.addEventListener('load', () => sendInitToIframe(id), { once:true });
        }
      }

      runBtn.addEventListener('click', () => {
        const out = document.getElementById(`console-${id}`);
        if (out) out.innerHTML = '<span class="cr-note">Running…</span>';
        const runnerIframe = getIframe(id);
        if (runnerIframe) {
          const lang = runnerIframe.dataset.lang || 'cpp';
          const filename = runnerIframe.dataset.filename || 'main.cpp';
          runnerIframe.contentWindow.postMessage({ type: 'run', id, lang, filename }, '*');
        } else if (out) {
          out.innerHTML = '<span class="cr-error">Error: editor iframe not found!</span>';
        }
      });
    });
  }

  window.addEventListener('message', event => {
    if (event.data && event.data.type === 'run-result' && event.data.id) {
      const out = document.getElementById(`console-${event.data.id}`);
      if (!out) return;
      const raw = String(event.data.output || '');
      out.innerHTML = ansiToHtml(raw);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRunners);
  } else {
    initRunners();
  }
})();
