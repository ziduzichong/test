/**
 * 电子科学与技术协会网站 — 前端交互
 * 无框架依赖（Alpine 仅用于轻量 toast，不用其模态能力）
 */

// ========== Toast ==========
function showToast(msg, type) {
  var c = document.getElementById('toast-container');
  if (!c) return;
  var el = document.createElement('div');
  el.className = 'toast toast-' + (type || 'info');
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(function() { el.style.opacity = '0'; setTimeout(function() { el.remove(); }, 300); }, 3500);
}

// ========== 模态弹窗 ==========
function openModal(html) {
  closeModal();
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalOverlay';
  overlay.innerHTML = '<div class="modal-content">' + html + '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeModal(); });
  // 绑定关闭按钮
  overlay.querySelectorAll('.modal-close, .modal-close-btn').forEach(function(b) {
    b.addEventListener('click', closeModal);
  });
  return overlay;
}

function closeModal() {
  var o = document.getElementById('modalOverlay');
  if (o) o.remove();
}

// ========== 确认 ==========
function confirmAction(msg) {
  return window.confirm(msg);
}

// ========== 文件大小格式化 ==========
function formatSize(bytes) {
  if (!bytes) return '0 B';
  var u = ['B', 'KB', 'MB', 'GB'], i = 0, s = bytes;
  while (s >= 1024 && i < u.length - 1) { s /= 1024; i++; }
  return s.toFixed(i > 0 ? 1 : 0) + ' ' + u[i];
}

// ========== 移动端汉堡菜单 ==========
document.addEventListener('DOMContentLoaded', function() {
  var toggle = document.querySelector('.navbar-toggler');
  var collapse = document.querySelector('.navbar-collapse');
  if (toggle && collapse) {
    toggle.addEventListener('click', function() { collapse.classList.toggle('show'); });
  }
});

// ========== 公告编辑模态 ==========
function openAnnEditor(id) {
  var ann = null;
  var title = '', category = 'news', content = '', isPublished = false;
  // 从表格行读取已有数据
  if (id) {
    var row = document.getElementById('ann-row-' + id);
    if (row) {
      title = row.dataset.title || '';
      category = row.dataset.category || 'news';
      content = row.dataset.content || '';
      isPublished = row.dataset.published === 'true';
    }
  }
  var html =
    '<div class="modal-header"><h3>' + (id ? '编辑公告' : '新建公告') + '</h3><button class="modal-close">&times;</button></div>' +
    '<div class="form-group"><label>标题</label><input class="form-control" id="annTitle" value="' + escAttr(title) + '"></div>' +
    '<div class="form-group"><label>分类</label><select class="form-control" id="annCategory">' +
      '<option value="news"' + (category === 'news' ? ' selected' : '') + '>新闻</option>' +
      '<option value="course"' + (category === 'course' ? ' selected' : '') + '>课程</option>' +
      '<option value="exam"' + (category === 'exam' ? ' selected' : '') + '>考核</option>' +
    '</select></div>' +
    '<div class="form-group"><label>内容</label><div id="quillEditor" style="height:280px"></div></div>' +
    '<div class="form-group"><label><input type="checkbox" id="annPublished"' + (isPublished ? ' checked' : '') + '> 已发布</label></div>' +
    '<div class="form-actions" style="display:flex;gap:8px;margin-top:16px">' +
      '<button class="btn btn-outline modal-close-btn">取消</button>' +
      '<button class="btn btn-primary" id="saveAnnBtn">保存</button>' +
    '</div>';
  openModal(html);
  // 初始化 Quill（含图片上传 + 附件链接）
  var quill = new Quill('#quillEditor', {
    theme: 'snow',
    placeholder: '输入公告内容...',
    modules: {
      toolbar: {
        container: [
          ['bold', 'italic', 'underline', 'strike'],
          ['blockquote', 'code-block'],
          [{ 'header': 1 }, { 'header': 2 }],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }],
          [{ 'script': 'sub' }, { 'script': 'super' }],
          [{ 'indent': '-1' }, { 'indent': '+1' }],
          [{ 'direction': 'rtl' }],
          [{ 'size': ['small', false, 'large', 'huge'] }],
          [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'font': [] }],
          [{ 'align': [] }],
          ['link', 'image', 'video'],
          ['clean']
        ],
        handlers: {
          image: function() {
            var input = document.createElement('input');
            input.setAttribute('type', 'file');
            input.setAttribute('accept', 'image/*');
            input.click();
            input.onchange = function() {
              var file = input.files[0];
              var fd = new FormData();
              fd.append('image', file);
              fd.append('csrfmiddlewaretoken', getCSRF());
              var range = this.quill.getSelection();
              fetch('/api/upload-image/', { method: 'POST', body: fd })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                  if (data.ok) { this.quill.insertEmbed(range.index, 'image', data.url); }
                  else { showToast('图片上传失败: ' + (data.error || '未知错误'), 'error'); }
                }.bind(this));
            }.bind(this);
          }
        }
      }
    }
  });
  if (content) quill.root.innerHTML = content;
  // 保存
  document.getElementById('saveAnnBtn').addEventListener('click', function() {
    var fd = new FormData();
    fd.append('title', document.getElementById('annTitle').value.trim());
    fd.append('category', document.getElementById('annCategory').value);
    fd.append('content', quill.root.innerHTML);
    fd.append('is_published', document.getElementById('annPublished').checked ? 'on' : '');
    fd.append('csrfmiddlewaretoken', getCSRF());
    if (id) fd.append('id', id);
    fetch('', { method: 'POST', body: fd }).then(function(r) {
      if (r.ok || r.redirected) { closeModal(); location.reload(); }
    });
  });
}

// ========== 成员编辑模态 ==========
function openMemEditor(id) {
  var row = id ? document.getElementById('mem-row-' + id) : null;
  var name = '', position = '', bio = '', contact = '', skills = '', joined = '', order = '0', contactPublic = false, isActive = true;
  if (row) {
    name = row.dataset.name || '';
    position = row.dataset.position || '';
    bio = row.dataset.bio || '';
    contact = row.dataset.contact || '';
    skills = row.dataset.skills || '';
    joined = row.dataset.joined || '';
    order = row.dataset.order || '0';
    contactPublic = row.dataset.contactPublic === 'true';
    isActive = row.dataset.active !== 'false';
  }
  var html =
    '<div class="modal-header"><h3>' + (id ? '编辑成员' : '添加成员') + '</h3><button class="modal-close">&times;</button></div>' +
    '<div class="form-group"><label>姓名</label><input class="form-control" id="memName" value="' + escAttr(name) + '"></div>' +
    '<div class="form-group"><label>职位</label><input class="form-control" id="memPosition" value="' + escAttr(position) + '"></div>' +
    '<div class="form-group"><label>简介</label><textarea class="form-control form-textarea" id="memBio">' + escHtml(bio) + '</textarea></div>' +
    '<div class="form-group"><label>联系方式</label><input class="form-control" id="memContact" value="' + escAttr(contact) + '"></div>' +
    '<div class="form-group"><label>技能（逗号分隔）</label><input class="form-control" id="memSkills" value="' + escAttr(skills) + '"></div>' +
    '<div class="form-group"><label>加入时间</label><input class="form-control" id="memJoined" value="' + escAttr(joined) + '" placeholder="如 2024-09"></div>' +
    '<div class="form-group"><label>排序</label><input class="form-control" type="number" id="memOrder" value="' + order + '"></div>' +
    '<div class="form-group"><label><input type="checkbox" id="memContactPublic"' + (contactPublic ? ' checked' : '') + '> 公开联系方式</label></div>' +
    '<div class="form-group"><label><input type="checkbox" id="memActive"' + (isActive ? ' checked' : '') + '> 展示中</label></div>' +
    '<div class="form-actions" style="display:flex;gap:8px;margin-top:16px">' +
      '<button class="btn btn-outline modal-close-btn">取消</button>' +
      '<button class="btn btn-primary" id="saveMemBtn">保存</button>' +
    '</div>';
  openModal(html);
  document.getElementById('saveMemBtn').addEventListener('click', function() {
    var fd = new FormData();
    fd.append('name', document.getElementById('memName').value.trim());
    fd.append('position', document.getElementById('memPosition').value);
    fd.append('bio', document.getElementById('memBio').value);
    fd.append('contact', document.getElementById('memContact').value);
    fd.append('skills', document.getElementById('memSkills').value);
    fd.append('joined_at', document.getElementById('memJoined').value);
    fd.append('order', document.getElementById('memOrder').value);
    fd.append('contact_public', document.getElementById('memContactPublic').checked ? 'on' : '');
    fd.append('is_active', document.getElementById('memActive').checked ? 'on' : '');
    fd.append('csrfmiddlewaretoken', getCSRF());
    if (id) fd.append('id', id);
    fetch('', { method: 'POST', body: fd }).then(function(r) {
      if (r.ok || r.redirected) { closeModal(); location.reload(); }
    });
  });
}

// ========== 奖项编辑模态 ==========
function openAwardEditor(id) {
  var row = id ? document.getElementById('award-row-' + id) : null;
  var title = '', competition = '', rank = 'other', desc = '', date = '';
  if (row) {
    title = row.dataset.title || '';
    competition = row.dataset.competition || '';
    rank = row.dataset.rank || 'other';
    desc = row.dataset.desc || '';
    date = row.dataset.date || '';
  }
  var rankOpts = ['grand','first','second','third','merit','other'];
  var rankLabels = ['特等奖','一等奖','二等奖','三等奖','优胜奖','其他'];
  var rankHtml = rankOpts.map(function(r,i) {
    return '<option value="' + r + '"' + (rank === r ? ' selected' : '') + '>' + rankLabels[i] + '</option>';
  }).join('');
  var html =
    '<div class="modal-header"><h3>' + (id ? '编辑奖项' : '添加奖项') + '</h3><button class="modal-close">&times;</button></div>' +
    '<div class="form-group"><label>奖项名称</label><input class="form-control" id="awdTitle" value="' + escAttr(title) + '"></div>' +
    '<div class="form-group"><label>竞赛名称</label><input class="form-control" id="awdCompetition" value="' + escAttr(competition) + '"></div>' +
    '<div class="form-group"><label>等级</label><select class="form-control" id="awdRank">' + rankHtml + '</select></div>' +
    '<div class="form-group"><label>描述</label><textarea class="form-control form-textarea" id="awdDesc">' + escHtml(desc) + '</textarea></div>' +
    '<div class="form-group"><label>获奖日期</label><input class="form-control" type="date" id="awdDate" value="' + date + '"></div>' +
    '<div class="form-actions" style="display:flex;gap:8px;margin-top:16px">' +
      '<button class="btn btn-outline modal-close-btn">取消</button>' +
      '<button class="btn btn-primary" id="saveAwdBtn">保存</button>' +
    '</div>';
  openModal(html);
  document.getElementById('saveAwdBtn').addEventListener('click', function() {
    var fd = new FormData();
    fd.append('title', document.getElementById('awdTitle').value.trim());
    fd.append('competition', document.getElementById('awdCompetition').value);
    fd.append('rank', document.getElementById('awdRank').value);
    fd.append('description', document.getElementById('awdDesc').value);
    fd.append('award_date', document.getElementById('awdDate').value);
    fd.append('csrfmiddlewaretoken', getCSRF());
    if (id) fd.append('id', id);
    fetch('', { method: 'POST', body: fd }).then(function(r) {
      if (r.ok || r.redirected) { closeModal(); location.reload(); }
    });
  });
}

// ========== 账号创建模态 ==========
function openAccountCreator() {
  var html =
    '<div class="modal-header"><h3>创建账号</h3><button class="modal-close">&times;</button></div>' +
    '<div class="form-group"><label>用户名</label><input class="form-control" id="acctUser" placeholder="登录用户名"></div>' +
    '<div class="form-group"><label>密码</label><input class="form-control" type="password" id="acctPass" placeholder="密码"></div>' +
    '<div class="form-group"><label>显示名称</label><input class="form-control" id="acctDisplay" placeholder="显示名称"></div>' +
    '<div class="form-group"><label>角色</label><select class="form-control" id="acctRole"><option value="editor">编辑者</option><option value="admin">管理员</option></select></div>' +
    '<div class="form-actions" style="display:flex;gap:8px;margin-top:16px">' +
      '<button class="btn btn-outline modal-close-btn">取消</button>' +
      '<button class="btn btn-primary" id="saveAcctBtn">创建</button>' +
    '</div>';
  openModal(html);
  document.getElementById('saveAcctBtn').addEventListener('click', function() {
    var fd = new FormData();
    fd.append('username', document.getElementById('acctUser').value.trim());
    fd.append('password', document.getElementById('acctPass').value);
    fd.append('display_name', document.getElementById('acctDisplay').value);
    fd.append('role', document.getElementById('acctRole').value);
    fd.append('csrfmiddlewaretoken', getCSRF());
    fetch('', { method: 'POST', body: fd }).then(function(r) {
      if (r.ok || r.redirected) { closeModal(); location.reload(); }
    });
  });
}

// ========== 辅助 ==========
function getCSRF() {
  var el = document.querySelector('[name=csrfmiddlewaretoken]');
  if (el) return el.value;
  // Fallback: read from Django's csrftoken cookie
  var cookies = document.cookie.split(';');
  for (var i = 0; i < cookies.length; i++) {
    var c = cookies[i].trim();
    if (c.startsWith('csrftoken=')) return c.substring(10);
  }
  return '';
}
function escAttr(s) { return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escHtml(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ========== 上传页面：可执行文件检测 ==========
document.addEventListener('DOMContentLoaded', function() {
  var fileInput = document.getElementById('fileInput');
  var shaField = document.getElementById('sha256Group');
  if (fileInput && shaField) {
    fileInput.addEventListener('change', function() {
      var name = (this.files[0] || {}).name || '';
      var ext = name.toLowerCase().split('.').pop();
      shaField.style.display = (['exe','msi','apk','deb','rpm'].indexOf(ext) >= 0) ? '' : 'none';
    });
  }
  // 拖拽上传区域
  var dropzone = document.getElementById('uploadDropzone');
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', function() { fileInput.click(); });
    dropzone.addEventListener('dragover', function(e) { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', function() { dropzone.classList.remove('dragover'); });
    dropzone.addEventListener('drop', function(e) {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; fileInput.dispatchEvent(new Event('change')); }
    });
  }
});

// ========== HTMX CSRF 配置 ==========
document.body.addEventListener('htmx:configRequest', function(e) {
  e.detail.headers['X-CSRFToken'] = getCSRF();
});

// ========== HTMX afterSwap 重新绑定关闭事件 ==========
if (document.body) document.body.addEventListener('htmx:afterSwap', function(e) {
  e.target.querySelectorAll('.modal-close, .modal-close-btn').forEach(function(b) {
    b.addEventListener('click', closeModal);
  });
});
