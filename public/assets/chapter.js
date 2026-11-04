/** 首页分类目录：单项展开、键盘导航及独立的前后切换按钮。 */
(() => {
  function initializeChapters() {
    const rail = document.querySelector('[data-collection-rail]');
    if (!rail || rail.dataset.chapterInitialized === 'true') return;

    const labels = {
      kitchen: '餐桌器物',
      home: '起居织物',
      care: '日常洗护',
      food: '茶与食',
      accessories: '随身好物',
    };
    const chapters = [...rail.querySelectorAll('.chapter[data-chapter]')]
      .map(chapter => {
        const button = chapter.querySelector('button[data-chapter-toggle]');
        const panelId = button?.getAttribute('aria-controls')?.trim();
        const panel = panelId ? document.getElementById(panelId) : null;
        if (!button || button.disabled || !panel || !chapter.contains(panel) || !panel.matches('.chapter-body')) {
          return null;
        }
        return { chapter, button, panel, key: chapter.dataset.chapter };
      })
      .filter(Boolean);
    if (!chapters.length) return;
    rail.dataset.chapterInitialized = 'true';

    let activeIndex = chapters.findIndex(item => item.chapter.classList.contains('is-active'));
    if (activeIndex < 0) activeIndex = Math.max(0, chapters.findIndex(item => item.key === 'kitchen'));

    function selectChapter(index, focusToggle = false) {
      activeIndex = ((index % chapters.length) + chapters.length) % chapters.length;
      chapters.forEach((item, itemIndex) => {
        const expanded = itemIndex === activeIndex;
        item.chapter.classList.toggle('is-active', expanded);
        item.button.setAttribute('aria-expanded', String(expanded));
        item.panel.hidden = !expanded;
      });

      const current = chapters[activeIndex];
      const number = String(activeIndex + 1).padStart(2, '0');
      const label = current.button.querySelector('.chapter-label')?.textContent.trim() || labels[current.key] || current.button.textContent.trim();
      document.querySelectorAll('[data-active-chapter]').forEach(node => {
        node.textContent = number;
      });
      document.querySelectorAll('[data-chapter-status]').forEach(node => {
        node.textContent = `当前分类：${label}，第 ${activeIndex + 1} 项，共 ${chapters.length} 项。`;
      });
      if (focusToggle) current.button.focus({ preventScroll: true });
    }

    function toggleFromEvent(event) {
      return event.target instanceof Element
        ? event.target.closest('button[data-chapter-toggle]')
        : null;
    }

    rail.addEventListener('click', event => {
      const button = toggleFromEvent(event);
      const index = chapters.findIndex(item => item.button === button);
      if (index < 0) return;
      event.preventDefault();
      selectChapter(index);
    });

    rail.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const button = toggleFromEvent(event);
      const index = chapters.findIndex(item => item.button === button);
      if (index < 0) return;

      let nextIndex;
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          nextIndex = index - 1;
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          nextIndex = index + 1;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = chapters.length - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      selectChapter(nextIndex, true);
    });

    // 前后按钮可放在目录外；切换时焦点留在刚操作的按钮上。
    document.addEventListener('click', event => {
      const control = event.target instanceof Element
        ? event.target.closest('[data-chapter-step]')
        : null;
      const direction = control?.dataset.chapterStep;
      if (!control || !['prev', 'next'].includes(direction) || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
      event.preventDefault();
      selectChapter(activeIndex + (direction === 'next' ? 1 : -1));
      control.focus({ preventScroll: true });
    });

    // 统一初始状态，确保 class、ARIA 与浏览器原生 hidden 始终一致。
    selectChapter(activeIndex);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeChapters, { once: true });
  } else {
    initializeChapters();
  }
})();
