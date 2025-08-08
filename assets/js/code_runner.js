(function(){
  window._monacoReady = window._monacoReady ||
    new Promise(resolve => require(['vs/editor/editor.main'], resolve));

  function initEditors() {
    document.querySelectorAll('.code-runner-editor').forEach(container => {
      if (container.dataset.initialized) return;
      container.dataset.initialized = 'true';

      const id   = container.id.replace('editor-', '');
      const lang = container.dataset.lang;
      const code = JSON.parse(container.dataset.code).trim();

      const editor = monaco.editor.create(container, {
        value: code,
        language: lang,
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderLineHighlight: 'none'
      });

      const runBtn = document.querySelector(`.code-runner-run[data-runner-id="${id}"]`);
      runBtn.addEventListener('click', () => {
        const out = document.getElementById(`console-${id}`);
        out.textContent = 'Running…';
        
        fetch('https://ornate-beijinho-0548f2.netlify.app/.netlify/functions/run-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            language: lang,
            version: 'latest',
            files: [{
              name: document.querySelector(`#runner-${id} .code-runner-filename`).textContent,
              content: editor.getValue()
            }]
          })
        })
        .then(res => res.json())
        .then(j => {
          out.textContent = j.stdout || j.output || j.errors || j.stderr || 'No output';
        })
        .catch(e => {
          out.textContent = 'Error: ' + e.message;
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window._monacoReady.then(initEditors));
  } else {
    window._monacoReady.then(initEditors);
  }
})();
