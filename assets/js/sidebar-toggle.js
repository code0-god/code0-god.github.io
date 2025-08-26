(function () {
  const KEY = 'sidebar:collapsed';
  const btn = document.getElementById('sidebar-toggle');
  if (!btn) return;

  const mq = window.matchMedia('(min-width: 992px)'); // Chirpy lg 기준

  function setExpanded(expanded) {
    btn.setAttribute('aria-expanded', String(expanded));
    // 아이콘 방향은 css
  }

  function applyStateFromStorage() {
    const collapsed = localStorage.getItem(KEY) === '1';
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    setExpanded(!collapsed);
    positionButton();
  }

  function positionButton() {
    // 데스크탑에서만 보이므로, 위치 계산만 갱신
    btn.getBoundingClientRect();
  }

  btn.addEventListener('click', () => {
    const collapsed = !document.body.classList.contains('sidebar-collapsed');
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem(KEY, collapsed ? '1' : '0');
    setExpanded(!collapsed);
    positionButton();
  });

  // 반응형 전환 시 상태 재적용
  mq.addEventListener?.('change', applyStateFromStorage);
  window.addEventListener('resize', positionButton);

  // 초기 적용 (데스크탑일 때만 버튼 노출)
  applyStateFromStorage();
})();
