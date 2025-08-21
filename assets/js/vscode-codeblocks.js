// assets/js/vscode-codeblocks.js
// Rouge 코드블럭 -> Monaco(+Shiki VS Code 테마) 치환기
(function () {
  const FLAG = '__mono_shiki_booted__';
  const DONE_ATTR = 'data-mono-shiki-done';
  if (window[FLAG]) return; window[FLAG] = true;

  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.33.0/min/vs';

  const mapLang = (r)=>{
    r=(r||'').toLowerCase();
    const m={ 'c++':'cpp','h++':'cpp','hpp':'cpp','cc':'cpp','hh':'cpp',
      'c#':'csharp','cs':'csharp','py':'python','js':'javascript','ts':'typescript',
      'sh':'bash','shell':'bash','yml':'yaml','yaml':'yaml','md':'markdown',
      'plaintext':'text','text':'text','kt':'kotlin','rs':'rust',
      'v':'verilog','sv':'systemverilog','systemverilog':'systemverilog' };
    return m[r]||r||'text';
  };

  const themeNow = ()=>{
    const html=document.documentElement;
    const t=html.getAttribute('data-theme')||html.getAttribute('data-mode');
    if(t==='dark') return 'dark-plus';
    if(t==='light') return 'light-plus';
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark-plus' : 'light-plus';
  };

  function collectBlocks(scope){
    return (scope||document).querySelectorAll(
      'div.highlighter-rouge[class*="language-"], figure.highlight[class*="language-"]'
    );
  }

  function getLangFromBox(box){
    const c=[...box.classList].find(x=>x.startsWith('language-'));
    return mapLang(c ? c.slice(9) : (box.getAttribute('data-lang') || 'text'));
  }

  function getSourceFromBox(box){
    const pre =
      box.querySelector(':scope > .highlight code table td.rouge-code > pre') ||
      box.querySelector(':scope > .highlight pre') ||
      box.querySelector(':scope > pre') ||
      box.querySelector(':scope pre');
    let s = (pre && pre.textContent) || '';
    // trailing 개행 제거(마지막 빈 줄 방지)
    s = s.replace(/\r\n/g, '\n').replace(/\n+$/,'');
    return s;
  }

  // ----- Monaco & Shiki 준비 -----
  async function ensureMonaco() {
    if (window.monaco?.editor) return window.monaco;
    if (!window.require || !window.require.config) {
      await new Promise((resolve, reject)=>{
        const s=document.createElement('script');
        s.src = CDN + '/loader.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    /* global require */
    require.config({ paths: { vs: CDN } });
    await new Promise((resolve)=>require(['vs/editor/editor.main'], resolve));
    return window.monaco;
  }

  let themesReady = false, highlighterPromise = null;
  async function ensureShikiThemes(initialLangs) {
    if (themesReady) return;
    const [{ shikiToMonaco }, { createHighlighter }, { createJavaScriptRegexEngine }] =
      await Promise.all([
        import('https://esm.sh/@shikijs/monaco@3.9.2'),
        import('https://esm.sh/shiki@3.9.2'),
        import('https://esm.sh/shiki@3.9.2/engine/javascript'),
      ]);
    highlighterPromise ||= createHighlighter({
      themes: ['dark-plus','light-plus'],
      langs: initialLangs,
      engine: createJavaScriptRegexEngine(),
    });
    const highlighter = await highlighterPromise;
    shikiToMonaco(highlighter, window.monaco);  // 'dark-plus' / 'light-plus' 등록
    themesReady = true;
  }

  // ----- DOM 빌드 -----
  function buildHeader(lang){
    const header=document.createElement('div');
    header.className='code-header vc-header';
    header.innerHTML = `
      <span class="vc-title" data-label-text="${(lang||'text').toUpperCase()}"></span>
      <button aria-label="copy" title="copy"><i class="far fa-clipboard"></i></button>
    `;
    return header;
  }
  function buildHost(){ const d=document.createElement('div'); d.className='monoshiki-host'; return d; }

  // ----- 에디터 높이 = 내용 높이 -----
  function fitHeight(editor, host){
    const h = editor.getContentHeight();
    host.style.height = h + 'px';
    editor.layout();
  }

  async function transformOne(box){
    if (!box || box.hasAttribute(DONE_ATTR)) return;

    const lang = getLangFromBox(box);
    const code = getSourceFromBox(box);

    const monaco = await ensureMonaco();
    await ensureShikiThemes([lang]);

    // 컨테이너 초기화 후 헤더/호스트 구성
    const header = buildHeader(lang);
    const host   = buildHost();
    box.innerHTML = '';
    box.className = 'monoshiki-block';
    box.setAttribute('data-lang', lang);
    box.appendChild(header);
    box.appendChild(host);

    // Monaco (읽기 전용)
    const editor = monaco.editor.create(host, {
      value: code,
      language: lang,
      theme: themeNow(),
      readOnly: true,
      automaticLayout: true,
      minimap: { enabled: false },
      lineNumbers: 'on',
      glyphMargin: false,
      folding: false,
      renderLineHighlight: 'none',
      renderWhitespace: 'none',
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      padding: { top: 10, bottom: 10 },
      overviewRulerLanes: 0,
      overviewRulerBorder: false,
      // typo
      fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
      fontLigatures: true,
      fontSize: 14,
      lineHeight: 22,
      // 스크롤
      scrollbar: {
        vertical: 'hidden',   // 수직 스크롤 없음 (내용 높이에 맞춤)
        horizontal: 'auto',
        verticalScrollbarSize: 6,
        horizontalScrollbarSize: 6,
        useShadows: false
      }
    });

    // 수직 스크롤 제거용 내용 높이 반영
    fitHeight(editor, host);
    editor.onDidContentSizeChange(()=>fitHeight(editor, host));

    // 복사용 원문 저장
    host.setAttribute('data-raw', code);

    // 완료 마킹
    box.setAttribute(DONE_ATTR, '1');

    return editor;
  }

  async function transform(scope){
    const blocks = collectBlocks(scope);
    if (!blocks.length) return;

    const langs = [...new Set([...blocks].map(getLangFromBox))];
    await ensureMonaco();
    await ensureShikiThemes(langs);

    const editors=[];
    for (const b of blocks) {
      const ed = await transformOne(b);
      if (ed) editors.push(ed);
    }
    window.__monoshiki_editors__ = (window.__monoshiki_editors__ || []).concat(editors);

    // 현재 테마 적용
    window.monaco && window.monaco.editor.setTheme(themeNow());
  }

  // 테마 전환 훅
  function hookTheme(){
    const apply = ()=> window.monaco && window.monaco.editor && window.monaco.editor.setTheme(themeNow());
    document.addEventListener('click',(e)=>{
      const t=e.target;
      if(t && (t.id==='mode-toggle'||(t.closest&&t.closest('#mode-toggle')))) setTimeout(apply,0);
    });
    const mq=window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    mq && mq.addEventListener && mq.addEventListener('change', ()=>setTimeout(apply,0));
  }

  // ====== 토스트(UI) ======
  function showCopyToast(anchorEl, message='Copied!') {
    try{
      const toast = document.createElement('div');
      toast.className = 'copy-toast';
      toast.innerHTML = `
        <span class="bubble">${message}</span>
        <span class="icon" aria-hidden="true">✓</span>
      `;
      document.body.appendChild(toast);

      // 위치: 버튼 위·오른쪽 근처, 화면 밖이면 자동 보정
      const rect = anchorEl.getBoundingClientRect();
      const margin = 10;
      const tw = toast.offsetWidth, th = toast.offsetHeight;

      let top = rect.top - th - 8;
      if (top < margin) top = rect.bottom + 8;

      let left = rect.right - tw;                    // 버튼 오른쪽 정렬
      if (left < margin) left = margin;
      if (left + tw > window.innerWidth - margin) left = window.innerWidth - margin - tw;

      toast.style.top = `${Math.round(top)}px`;
      toast.style.left = `${Math.round(left)}px`;

      requestAnimationFrame(()=>toast.classList.add('show'));
      setTimeout(()=>{ toast.classList.remove('show'); }, 1100);
      setTimeout(()=>{ toast.remove(); }, 1400);
    }catch(e){}
  }

  // 복사 버튼
  document.addEventListener('click', async (e)=>{
    const btn = e.target && e.target.closest('.monoshiki-block .code-header button');
    if (!btn) return;
    const block = btn.closest('.monoshiki-block');
    const host  = block && block.querySelector('.monoshiki-host');
    const raw   = host && host.getAttribute('data-raw') || '';
    try{
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(raw);
      else { const ta=document.createElement('textarea'); ta.value=raw; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
      // 시각 피드백
      showCopyToast(btn, 'Copied!');
    }catch(err){ console.warn('[monoshiki] copy failed:', err); }
  });

  // 부트
  async function boot(){ await transform(document); hookTheme(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(boot, 500);
  ['pjax:complete','pjax:success'].forEach(ev=>document.addEventListener(ev, boot));

  // 동적 삽입 감시
  new MutationObserver(muts=>{
    for(const m of muts){
      for(const n of m.addedNodes||[]){
        if(!(n instanceof Element)) continue;
        if(n.matches && n.matches('div.highlighter-rouge[class*="language-"], figure.highlight[class*="language-"]')) transform(n);
        else if(n.querySelector && n.querySelector('div.highlighter-rouge[class*="language-"], figure.highlight[class*="language-"]')) transform(n);
      }
    }
  }).observe(document.body,{childList:true,subtree:true});
})();
