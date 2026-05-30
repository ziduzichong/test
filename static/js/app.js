// Toast 通知
function showToast(msg, type) {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type || 'info'}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

// 模态弹窗
function openModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalOverlay';
  overlay.innerHTML = `<div class="modal-content">${html}</div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
}
function closeModal() {
  const o = document.getElementById('modalOverlay');
  if (o) o.remove();
}

// 确认对话框
function confirmAction(msg) { return window.confirm(msg); }

// 文件大小格式化
function formatSize(bytes) {
  if (!bytes) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0, s = bytes;
  while (s >= 1024 && i < u.length-1) { s /= 1024; i++; }
  return s.toFixed(i>0?1:0) + ' ' + u[i];
}

// 导航汉堡菜单（移动端）
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
  }
});

// HTMX afterSwap 事件：刷新后重新绑定
document.body.addEventListener('htmx:afterSwap', (e) => {
  // 模态弹窗关闭按钮事件委托
  e.target.querySelectorAll('.modal-close, .modal-close-btn').forEach(b => {
    b.addEventListener('click', closeModal);
  });
});
