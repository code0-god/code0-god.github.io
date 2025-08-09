(function () {
  console.log('[parent] code_runner.js loaded');
  function getIframe(id) {
    return document.querySelector(`#editor-${id} iframe`);
  }

  function initRunners() {
    document.querySelectorAll('.code-runner-run').forEach(runBtn => {
      const id = runBtn.dataset.runnerId;
      runBtn.addEventListener('click', () => {
        console.log('[parent] Run clicked', id);
        const out = document.getElementById(`console-${id}`);
        out.textContent = 'Running…';
        const iframe = getIframe(id);
        if (iframe) {
          console.log('[parent] postMessage to iframe', id);
          iframe.contentWindow.postMessage({ type: 'run', id: id }, '*');
        } else {
          out.textContent = 'Error: editor iframe not found!';
        }
      });
    });
  }

  window.addEventListener('message', event => {
    console.log('[parent] got message:', event.data);
    if (event.data && event.data.type === 'run-result' && event.data.id) {
      const out = document.getElementById(`console-${event.data.id}`);
      if (out) out.textContent = event.data.output;
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRunners);
  } else {
    initRunners();
  }
})();
