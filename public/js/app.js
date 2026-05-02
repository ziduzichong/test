/* ==============================
   电子科学与技术协会 — 前端 SPA
   ============================== */

const App = {
  state: { user: null, loggedIn: false },
  currentRoute: '', currentTab: 'announcements',

  /* -------- API 客户端 -------- */
  api: {
    base: '/api',
    async request(method, path, body) {
      const opts = { method, headers: {} };
      if (body instanceof FormData) {
        opts.body = body;
      } else if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(this.base + path, opts);
      const data = await res.json().catch(() => ({ ok: false, error: '服务器错误' }));
      if (!data.ok && data.error) throw new Error(data.error);
      return data;
    },
    get: (p) => App.api.request('GET', p),
    post: (p, b) => App.api.request('POST', p, b),
    put: (p, b) => App.api.request('PUT', p, b),
    del: (p) => App.api.request('DELETE', p),
    upload: (p, fd) => App.api.request('POST', p, fd),
  },

  /* -------- Toast 通知 -------- */
  toast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => { el.classList.add('toast-removing'); setTimeout(() => el.remove(), 300); }, 3000);
  },

  /* -------- 认证管理 -------- */
  async checkSession() {
    try {
      const data = await App.api.get('/auth/session');
      if (data.logged_in) {
        App.state.loggedIn = true;
        App.state.user = data.user;
      } else {
        App.state.loggedIn = false;
        App.state.user = null;
      }
    } catch { App.state.loggedIn = false; App.state.user = null; }
    App.updateNav();
  },

  async login(username, password) {
    const data = await App.api.post('/auth/login', { username, password });
    App.state.loggedIn = true;
    App.state.user = data.user;
    App.updateNav();
    App.toast('登录成功', 'success');
    App.navigate('/dashboard');
  },

  async logout() {
    await App.api.post('/auth/logout');
    App.state.loggedIn = false;
    App.state.user = null;
    App.updateNav();
    App.toast('已退出登录', 'info');
    App.navigate('/home');
  },

  updateNav() {
    document.querySelectorAll('.nav-auth').forEach(el => el.style.display = App.state.loggedIn ? '' : 'none');
    document.querySelectorAll('.nav-login').forEach(el => el.style.display = App.state.loggedIn ? 'none' : '');
    document.querySelectorAll('.nav-logout').forEach(el => el.style.display = App.state.loggedIn ? '' : 'none');
    document.querySelectorAll('.nav-link').forEach(el => {
      el.classList.toggle('active', el.dataset.route === App.currentRoute);
    });
  },

  /* -------- 导航 -------- */
  navigate(hash) {
    window.location.hash = '#' + hash;
  },

  /* -------- 路由 -------- */
  async handleRoute() {
    const hash = window.location.hash.slice(1) || '/home';
    App.currentRoute = hash.split('?')[0];
    App.updateNav();

    const main = document.getElementById('main-content');

    // 公开页面
    if (hash === '/home') { await App.renderHome(main); return; }
    if (hash === '/announcements') { await App.renderAnnouncements(main); return; }
    if (hash.startsWith('/announcement/')) { await App.renderAnnouncementDetail(main, hash.split('/')[2]); return; }
    if (hash === '/members') { await App.renderMembers(main); return; }
    if (hash.startsWith('/member/')) { await App.renderMemberDetail(main, hash.split('/')[2]); return; }
    if (hash === '/login') { App.renderLogin(main); return; }

    // 认证页面
    if (!App.state.loggedIn) {
      App.renderLogin(main);
      App.toast('请先登录', 'error');
      return;
    }
    if (hash === '/dashboard') { await App.renderDashboard(main); return; }
    if (hash === '/logout') { await App.logout(); return; }

    main.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>页面未找到</p></div>';
  },

  /* ======== 页面渲染 ======== */

  /* -------- 首页 -------- */
  async renderHome(main) {
    try {
      const [annData, memData] = await Promise.all([
        App.api.get('/announcements?limit=4'),
        App.api.get('/members')
      ]);
      const anns = annData.data.announcements || [];
      const mems = memData.data.members || [];

      main.innerHTML = `
        <section class="hero">
          <h1>⚡ 电子科学与技术协会</h1>
          <p>致力于为同学们提供电子技术学习与交流的平台。探索电子世界，从这里开始。</p>
          <div class="hero-actions">
            <a href="#/announcements" class="btn btn-primary">查看公告</a>
            <a href="#/members" class="btn" style="background:rgba(255,255,255,.15);color:#fff">认识成员</a>
          </div>
        </section>

        <section>
          <div class="page-header"><h2>📢 最新公告</h2><a href="#/announcements" class="btn btn-outline btn-sm">查看全部</a></div>
          <div class="grid-2" id="homeAnns">
            ${anns.length ? anns.map(a => `
              <a class="card" href="#/announcement/${a.id}" style="display:block;color:inherit">
                <div class="card-title">${App.esc(a.title)}</div>
                <div class="card-text">${App.stripHtml(a.content).slice(0, 120)}...</div>
                <div style="margin-top:8px;font-size:.8rem;color:var(--gray-400)">
                  <span class="category-badge category-${App.esc(a.category)}">${App.esc(a.category)}</span>
                  <span style="margin-left:8px">${a.created_at}</span>
                </div>
              </a>
            `).join('') : '<div class="empty-state"><p>暂无公告</p></div>'}
          </div>
        </section>

        <section style="margin-top:32px">
          <div class="page-header"><h2>👥 协会成员</h2><a href="#/members" class="btn btn-outline btn-sm">查看全部</a></div>
          <div class="grid-3" id="homeMembers">
            ${mems.slice(0, 6).map(m => `
              <div class="card member-card">
                <div class="member-avatar">${m.name ? m.name[0] : '?'}</div>
                <div class="member-name">${App.esc(m.name)}</div>
                <div class="member-position">${App.esc(m.position)}</div>
                <div class="member-skills">${(m.skills || '').split(',').filter(Boolean).map(s => `<span class="skill-tag">${App.esc(s.trim())}</span>`).join('')}</div>
              </div>
            `).join('')}
          </div>
        </section>
      `;
    } catch (e) {
      main.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败: ${App.esc(e.message)}</p></div>`;
    }
  },

  /* -------- 公告列表 -------- */
  async renderAnnouncements(main) {
    try {
      const data = await App.api.get('/announcements?limit=100');
      const anns = data.data.announcements || [];
      const categories = [...new Set(anns.map(a => a.category))];
      main.innerHTML = `
        <div class="page-header"><h1>📢 公告</h1></div>
        <div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap" id="annFilters">
          <button class="btn btn-sm btn-outline active" data-cat="">全部</button>
          ${categories.map(c => `<button class="btn btn-sm btn-outline" data-cat="${App.esc(c)}">${App.esc(c)}</button>`).join('')}
        </div>
        <div id="annList" class="grid-2">
          ${anns.length ? anns.map(a => `
            <a class="card" href="#/announcement/${a.id}" style="display:block;color:inherit">
              <div class="card-title">${App.esc(a.title)}</div>
              <div class="card-text">${App.stripHtml(a.content).slice(0, 150)}...</div>
              <div style="margin-top:8px;font-size:.8rem;color:var(--gray-400)">
                <span class="category-badge category-${App.esc(a.category)}">${App.esc(a.category)}</span>
                <span style="margin-left:8px">${a.created_at}</span>
              </div>
            </a>
          `).join('') : '<div class="empty-state"><div class="empty-icon">📭</div><p>暂无公告</p></div>'}
        </div>
      `;
      document.getElementById('annFilters')?.addEventListener('click', e => {
        const btn = e.target.closest('.btn');
        if (!btn) return;
        document.querySelectorAll('#annFilters .btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.cat;
        document.querySelectorAll('#annList .card').forEach(card => {
          const badge = card.querySelector('.category-badge');
          card.style.display = (!cat || (badge && badge.textContent.trim() === cat)) ? '' : 'none';
        });
      });
    } catch (e) {
      main.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败: ${App.esc(e.message)}</p></div>`;
    }
  },

  /* -------- 公告详情 -------- */
  async renderAnnouncementDetail(main, id) {
    try {
      const data = await App.api.get('/announcements?limit=100');
      const ann = (data.data.announcements || []).find(a => a.id == id);
      if (!ann) { main.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>公告未找到</p></div>'; return; }
      const sanitized = DOMPurify.sanitize(ann.content);
      main.innerHTML = `
        <div style="margin-bottom:16px"><a href="#/announcements" class="btn btn-outline btn-sm">← 返回公告列表</a></div>
        <div class="card">
          <h1 style="font-size:1.4rem;margin-bottom:8px">${App.esc(ann.title)}</h1>
          <div class="announcement-meta">
            <span class="category-badge category-${App.esc(ann.category)}">${App.esc(ann.category)}</span>
            <span>🕐 ${ann.created_at}</span>
            ${ann.updated_at !== ann.created_at ? `<span>📝 更新于 ${ann.updated_at}</span>` : ''}
          </div>
          <div class="announcement-content">${sanitized}</div>
        </div>
      `;
    } catch (e) {
      main.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败: ${App.esc(e.message)}</p></div>`;
    }
  },

  /* -------- 成员列表 -------- */
  async renderMembers(main) {
    try {
      const data = await App.api.get('/members?limit=100');
      const mems = data.data.members || [];
      main.innerHTML = `
        <div class="page-header"><h1>👥 协会成员</h1></div>
        <div class="grid-3">
          ${mems.length ? mems.map(m => `
            <div class="card member-card">
              <div class="member-avatar">${m.name ? m.name[0] : '?'}</div>
              <div class="member-name">${App.esc(m.name)}</div>
              <div class="member-position">${App.esc(m.position)}</div>
              ${m.bio ? `<div class="member-bio">${App.esc(m.bio)}</div>` : ''}
              <div class="member-skills">${(m.skills || '').split(',').filter(Boolean).map(s => `<span class="skill-tag">${App.esc(s.trim())}</span>`).join('')}</div>
              ${m.contact ? `<div style="margin-top:8px;font-size:.82rem;color:var(--gray-400)">📧 ${App.esc(m.contact)}</div>` : ''}
            </div>
          `).join('') : '<div class="empty-state"><div class="empty-icon">👥</div><p>暂无成员信息</p></div>'}
        </div>
      `;
    } catch (e) {
      main.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败: ${App.esc(e.message)}</p></div>`;
    }
  },

  /* -------- 成员详情 -------- */
  async renderMemberDetail(main, id) {
    try {
      const data = await App.api.get('/members');
      const mem = (data.data.members || []).find(m => m.id == id);
      if (!mem) { main.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>成员未找到</p></div>'; return; }
      main.innerHTML = `
        <div style="margin-bottom:16px"><a href="#/members" class="btn btn-outline btn-sm">← 返回成员列表</a></div>
        <div class="card" style="max-width:600px;margin:0 auto;text-align:center">
          <div class="member-avatar" style="width:100px;height:100px;font-size:2.5rem">${mem.name ? mem.name[0] : '?'}</div>
          <div class="member-name" style="font-size:1.3rem">${App.esc(mem.name)}</div>
          <div class="member-position">${App.esc(mem.position)}</div>
          ${mem.bio ? `<p style="margin:12px 0;color:var(--gray-600);line-height:1.7">${App.esc(mem.bio)}</p>` : ''}
          <div class="member-skills" style="justify-content:center">${(mem.skills || '').split(',').filter(Boolean).map(s => `<span class="skill-tag">${App.esc(s.trim())}</span>`).join('')}</div>
          ${mem.contact ? `<p style="margin-top:12px;color:var(--gray-400)">📧 ${App.esc(mem.contact)}</p>` : ''}
          ${mem.joined_at ? `<p style="color:var(--gray-400);font-size:.85rem">加入于 ${App.esc(mem.joined_at)}</p>` : ''}
        </div>
      `;
    } catch (e) {
      main.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败: ${App.esc(e.message)}</p></div>`;
    }
  },

  /* -------- 登录页面 -------- */
  renderLogin(main) {
    main.innerHTML = `
      <div class="login-page">
        <div class="card login-card">
          <h2>🔐 开发者登录</h2>
          <form id="loginForm">
            <div class="form-group">
              <label class="form-label">用户名</label>
              <input class="form-input" name="username" required placeholder="输入用户名" autocomplete="username">
            </div>
            <div class="form-group">
              <label class="form-label">密码</label>
              <input class="form-input" type="password" name="password" required placeholder="输入密码" autocomplete="current-password">
            </div>
            <button class="btn btn-primary btn-block" type="submit" id="loginBtn">登 录</button>
          </form>
        </div>
      </div>
    `;
    document.getElementById('loginForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('loginBtn');
      btn.disabled = true; btn.textContent = '登录中...';
      try {
        await App.login(e.target.username.value, e.target.password.value);
      } catch (err) {
        App.toast(err.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = '登 录';
      }
    });
  },

  /* ======== 管理面板 ======== */

  async renderDashboard(main) {
    main.innerHTML = `
      <div class="dashboard-layout">
        <aside class="dashboard-sidebar" id="dashSidebar">
          <a class="nav-link active" data-tab="announcements" href="#">📢 公告管理</a>
          <a class="nav-link" data-tab="members" href="#">👥 成员管理</a>
          <a class="nav-link" data-tab="files" href="#">📁 文件管理</a>
          ${App.state.user?.role === 'admin' ? '<a class="nav-link" data-tab="accounts" href="#">🔑 账号管理</a>' : ''}
        </aside>
        <div class="dashboard-content" id="dashContent">
          <div class="loading">加载中...</div>
        </div>
      </div>
    `;
    App.currentTab = 'announcements';
    await App.loadDashTab('announcements');
    document.getElementById('dashSidebar')?.addEventListener('click', async e => {
      const link = e.target.closest('.nav-link');
      if (!link) return;
      e.preventDefault();
      document.querySelectorAll('#dashSidebar .nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      App.currentTab = link.dataset.tab;
      await App.loadDashTab(App.currentTab);
    });
  },

  async loadDashTab(tab) {
    const el = document.getElementById('dashContent');
    if (!el) return;
    if (tab === 'announcements') await App.renderDashAnnouncements(el);
    else if (tab === 'members') await App.renderDashMembers(el);
    else if (tab === 'files') await App.renderDashFiles(el);
    else if (tab === 'accounts') await App.renderDashAccounts(el);
  },

  /* -------- 公告管理 -------- */
  async renderDashAnnouncements(el) {
    try {
      const data = await App.api.get('/announcements?limit=100');
      const anns = data.data.announcements || [];
      el.innerHTML = `
        <div class="page-header">
          <h1>📢 公告管理</h1>
          <button class="btn btn-primary" id="newAnnBtn">+ 新建公告</button>
        </div>
        ${anns.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>标题</th><th>分类</th><th>时间</th><th>操作</th></tr></thead>
              <tbody>
                ${anns.map(a => `
                  <tr>
                    <td><strong>${App.esc(a.title)}</strong></td>
                    <td><span class="category-badge category-${App.esc(a.category)}">${App.esc(a.category)}</span></td>
                    <td style="font-size:.85rem;color:var(--gray-400)">${a.created_at}</td>
                    <td>
                      <button class="btn btn-sm btn-outline edit-ann" data-id="${a.id}">编辑</button>
                      <button class="btn btn-sm btn-danger del-ann" data-id="${a.id}">删除</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty-state"><div class="empty-icon">📭</div><p>暂无公告</p></div>'}
      `;
      el.querySelector('#newAnnBtn')?.addEventListener('click', () => App.openAnnEditor(null));
      el.querySelectorAll('.edit-ann').forEach(b => b.addEventListener('click', () => App.openAnnEditor(parseInt(b.dataset.id))));
      el.querySelectorAll('.del-ann').forEach(b => b.addEventListener('click', () => App.deleteAnnouncement(b.dataset.id)));
    } catch (e) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败: ${App.esc(e.message)}</p></div>`;
    }
  },

  async openAnnEditor(id) {
    let ann = null;
    if (id) {
      const data = await App.api.get('/announcements?limit=100');
      ann = (data.data.announcements || []).find(a => a.id == id);
    }
    App.openModal(`
      <div class="modal-header">
        <h3>${ann ? '编辑公告' : '新建公告'}</h3>
        <button class="modal-close" id="modalClose">&times;</button>
      </div>
      <div class="form-group">
        <label class="form-label">标题</label>
        <input class="form-input" id="annTitle" value="${ann ? App.esc(ann.title) : ''}" placeholder="公告标题">
      </div>
      <div class="form-group">
        <label class="form-label">分类</label>
        <select class="form-select" id="annCategory">
          <option value="news" ${ann?.category === 'news' ? 'selected' : ''}>新闻</option>
          <option value="course" ${ann?.category === 'course' ? 'selected' : ''}>课程</option>
          <option value="exam" ${ann?.category === 'exam' ? 'selected' : ''}>考核</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">内容</label>
        <div id="editor-container"></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" id="saveAnnBtn">保存</button>
        <button class="btn btn-outline modal-close-btn">取消</button>
      </div>
    `, async () => {
      const quill = new Quill('#editor-container', { theme: 'snow', placeholder: '输入公告内容...' });
      if (ann) quill.root.innerHTML = ann.content;

      document.getElementById('saveAnnBtn')?.addEventListener('click', async () => {
        const title = document.getElementById('annTitle')?.value.trim();
        if (!title) { App.toast('请输入标题', 'error'); return; }
        const body = { title, content: quill.root.innerHTML, category: document.getElementById('annCategory')?.value || 'news' };
        try {
          if (ann) {
            await App.api.put(`/announcements/${ann.id}`, body);
            App.toast('公告已更新', 'success');
          } else {
            await App.api.post('/announcements', body);
            App.toast('公告已创建', 'success');
          }
          App.closeModal();
          await App.loadDashTab('announcements');
        } catch (e) { App.toast(e.message, 'error'); }
      });
    });
  },

  async deleteAnnouncement(id) {
    if (!confirm('确认删除此公告？')) return;
    try {
      await App.api.del(`/announcements/${id}`);
      App.toast('公告已删除', 'success');
      await App.loadDashTab('announcements');
    } catch (e) { App.toast(e.message, 'error'); }
  },

  /* -------- 成员管理 -------- */
  async renderDashMembers(el) {
    try {
      const data = await App.api.get('/members?limit=100');
      const mems = data.data.members || [];
      el.innerHTML = `
        <div class="page-header">
          <h1>👥 成员管理</h1>
          <button class="btn btn-primary" id="newMemBtn">+ 添加成员</button>
        </div>
        ${mems.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>姓名</th><th>职位</th><th>技能</th><th>操作</th></tr></thead>
              <tbody>
                ${mems.map(m => `
                  <tr>
                    <td><strong>${App.esc(m.name)}</strong></td>
                    <td>${App.esc(m.position)}</td>
                    <td style="font-size:.85rem">${App.esc((m.skills || '').slice(0, 60))}</td>
                    <td>
                      <button class="btn btn-sm btn-outline edit-mem" data-id="${m.id}">编辑</button>
                      <button class="btn btn-sm btn-danger del-mem" data-id="${m.id}">删除</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty-state"><div class="empty-icon">👥</div><p>暂无成员</p></div>'}
      `;
      el.querySelector('#newMemBtn')?.addEventListener('click', () => App.openMemEditor(null));
      el.querySelectorAll('.edit-mem').forEach(b => b.addEventListener('click', () => App.openMemEditor(parseInt(b.dataset.id))));
      el.querySelectorAll('.del-mem').forEach(b => b.addEventListener('click', () => App.deleteMember(b.dataset.id)));
    } catch (e) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败: ${App.esc(e.message)}</p></div>`;
    }
  },

  async openMemEditor(id) {
    let mem = null;
    if (id) {
      const data = await App.api.get('/members');
      mem = (data.data.members || []).find(m => m.id == id);
    }
    App.openModal(`
      <div class="modal-header">
        <h3>${mem ? '编辑成员' : '添加成员'}</h3>
        <button class="modal-close" id="modalClose">&times;</button>
      </div>
      <div class="form-group">
        <label class="form-label">姓名</label>
        <input class="form-input" id="memName" value="${mem ? App.esc(mem.name) : ''}" placeholder="姓名">
      </div>
      <div class="form-group">
        <label class="form-label">职位</label>
        <input class="form-input" id="memPosition" value="${mem ? App.esc(mem.position) : ''}" placeholder="如：会长、技术部长">
      </div>
      <div class="form-group">
        <label class="form-label">简介</label>
        <textarea class="form-textarea" id="memBio" placeholder="个人简介">${mem ? App.esc(mem.bio) : ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">联系方式</label>
        <input class="form-input" id="memContact" value="${mem ? App.esc(mem.contact) : ''}" placeholder="邮箱等">
      </div>
      <div class="form-group">
        <label class="form-label">技能（逗号分隔）</label>
        <input class="form-input" id="memSkills" value="${mem ? App.esc(mem.skills) : ''}" placeholder="STM32, PCB设计, 嵌入式">
      </div>
      <div class="form-group">
        <label class="form-label">加入时间</label>
        <input class="form-input" id="memJoined" value="${mem ? App.esc(mem.joined_at) : ''}" placeholder="如：2024-09">
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" id="saveMemBtn">保存</button>
        <button class="btn btn-outline modal-close-btn">取消</button>
      </div>
    `, () => {
      document.getElementById('saveMemBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('memName')?.value.trim();
        if (!name) { App.toast('请输入姓名', 'error'); return; }
        const body = {
          name, position: document.getElementById('memPosition')?.value || '',
          bio: document.getElementById('memBio')?.value || '',
          contact: document.getElementById('memContact')?.value || '',
          skills: document.getElementById('memSkills')?.value || '',
          joined_at: document.getElementById('memJoined')?.value || ''
        };
        try {
          if (mem) {
            await App.api.put(`/members/${mem.id}`, body);
            App.toast('成员信息已更新', 'success');
          } else {
            await App.api.post('/members', body);
            App.toast('成员已添加', 'success');
          }
          App.closeModal();
          await App.loadDashTab('members');
        } catch (e) { App.toast(e.message, 'error'); }
      });
    });
  },

  async deleteMember(id) {
    if (!confirm('确认删除此成员？')) return;
    try {
      await App.api.del(`/members/${id}`);
      App.toast('成员已删除', 'success');
      await App.loadDashTab('members');
    } catch (e) { App.toast(e.message, 'error'); }
  },

  /* -------- 文件管理 -------- */
  async renderDashFiles(el) {
    try {
      const data = await App.api.get('/files');
      const files = data.data.files || [];
      el.innerHTML = `
        <div class="page-header">
          <h1>📁 文件管理</h1>
          <button class="btn btn-primary" id="uploadFileBtn">+ 上传文件</button>
        </div>
        ${files.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>文件名</th><th>分类</th><th>大小</th><th>时间</th><th>操作</th></tr></thead>
              <tbody>
                ${files.map(f => `
                  <tr>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${App.esc(f.original_name)}">${App.esc(f.original_name)}</td>
                    <td><span class="category-badge category-${App.esc(f.category)}">${App.esc(f.category)}</span></td>
                    <td style="font-size:.85rem;color:var(--gray-400)">${App.formatSize(f.file_size)}</td>
                    <td style="font-size:.82rem;color:var(--gray-400)">${f.created_at}</td>
                    <td>
                      <a class="btn btn-sm btn-outline" href="/api/files/download/${f.id}" target="_blank">下载</a>
                      <button class="btn btn-sm btn-danger del-file" data-id="${f.id}">删除</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty-state"><div class="empty-icon">📁</div><p>暂无文件</p></div>'}
      `;
      el.querySelector('#uploadFileBtn')?.addEventListener('click', () => App.openFileUploader());
      el.querySelectorAll('.del-file').forEach(b => b.addEventListener('click', () => App.deleteFile(b.dataset.id)));
    } catch (e) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败: ${App.esc(e.message)}</p></div>`;
    }
  },

  openFileUploader() {
    App.openModal(`
      <div class="modal-header">
        <h3>📤 上传文件</h3>
        <button class="modal-close" id="modalClose">&times;</button>
      </div>
      <div class="form-group">
        <label class="form-label">分类</label>
        <select class="form-select" id="fileCategory">
          <option value="learning">学习资料</option>
          <option value="project">项目代码</option>
          <option value="tool">工具链</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">描述（可选）</label>
        <input class="form-input" id="fileDesc" placeholder="文件简介">
      </div>
      <div class="form-group">
        <label class="form-label">选择文件（最大 50MB）</label>
        <div class="file-drop-zone" id="fileDropZone">
          <div class="icon">📄</div>
          <p>点击选择文件或拖拽文件到这里</p>
        </div>
        <input type="file" id="fileInput" style="display:none">
        <div id="filePreviewArea"></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" id="uploadSubmitBtn" disabled>上传</button>
        <button class="btn btn-outline modal-close-btn">取消</button>
      </div>
    `, () => {
      let selectedFile = null;
      const dropZone = document.getElementById('fileDropZone');
      const fileInput = document.getElementById('fileInput');
      const previewArea = document.getElementById('filePreviewArea');
      const submitBtn = document.getElementById('uploadSubmitBtn');

      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
      dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); });
      fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

      function handleFile(file) {
        if (file.size > 50 * 1024 * 1024) { App.toast('文件超过 50MB 限制', 'error'); return; }
        selectedFile = file;
        previewArea.innerHTML = `<div class="file-preview"><span class="name">📄 ${file.name}</span><span class="size">${App.formatSize(file.size)}</span><span class="remove" id="removeFile">&times;</span></div>`;
        submitBtn.disabled = false;
        document.getElementById('removeFile')?.addEventListener('click', () => { selectedFile = null; previewArea.innerHTML = ''; submitBtn.disabled = true; });
      }

      submitBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        const fd = new FormData();
        fd.append('file', selectedFile);
        fd.append('category', document.getElementById('fileCategory')?.value || 'learning');
        fd.append('description', document.getElementById('fileDesc')?.value || '');
        submitBtn.disabled = true; submitBtn.textContent = '上传中...';
        try {
          await App.api.upload('/files/upload', fd);
          App.toast('文件上传成功', 'success');
          App.closeModal();
          await App.loadDashTab('files');
        } catch (e) { App.toast(e.message, 'error'); }
        finally { submitBtn.disabled = false; submitBtn.textContent = '上传'; }
      });
    });
  },

  async deleteFile(id) {
    if (!confirm('确认删除此文件？')) return;
    try {
      await App.api.del(`/files/${id}`);
      App.toast('文件已删除', 'success');
      await App.loadDashTab('files');
    } catch (e) { App.toast(e.message, 'error'); }
  },

  /* -------- 账号管理 -------- */
  async renderDashAccounts(el) {
    try {
      const data = await App.api.get('/accounts');
      const accounts = data.data.accounts || [];
      el.innerHTML = `
        <div class="page-header">
          <h1>🔑 账号管理</h1>
          <button class="btn btn-primary" id="newAccountBtn">+ 创建账号</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>用户名</th><th>显示名</th><th>角色</th><th>创建时间</th></tr></thead>
            <tbody>
              ${accounts.map(a => `
                <tr>
                  <td><strong>${App.esc(a.username)}</strong></td>
                  <td>${App.esc(a.display_name)}</td>
                  <td><span class="category-badge ${a.role === 'admin' ? 'category-exam' : 'category-news'}">${App.esc(a.role)}</span></td>
                  <td style="font-size:.85rem;color:var(--gray-400)">${a.created_at}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      el.querySelector('#newAccountBtn')?.addEventListener('click', () => App.openAccountCreator());
    } catch (e) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败: ${App.esc(e.message)}</p></div>`;
    }
  },

  openAccountCreator() {
    App.openModal(`
      <div class="modal-header">
        <h3>创建账号</h3>
        <button class="modal-close" id="modalClose">&times;</button>
      </div>
      <div class="form-group">
        <label class="form-label">用户名</label>
        <input class="form-input" id="acctUsername" placeholder="登录用用户名">
      </div>
      <div class="form-group">
        <label class="form-label">密码</label>
        <input class="form-input" type="password" id="acctPassword" placeholder="密码">
      </div>
      <div class="form-group">
        <label class="form-label">显示名称</label>
        <input class="form-input" id="acctDisplayName" placeholder="显示名称">
      </div>
      <div class="form-group">
        <label class="form-label">角色</label>
        <select class="form-select" id="acctRole">
          <option value="editor">编辑者</option>
          <option value="admin">管理员</option>
        </select>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" id="saveAcctBtn">创建</button>
        <button class="btn btn-outline modal-close-btn">取消</button>
      </div>
    `, () => {
      document.getElementById('saveAcctBtn')?.addEventListener('click', async () => {
        const username = document.getElementById('acctUsername')?.value.trim();
        const password = document.getElementById('acctPassword')?.value;
        if (!username || !password) { App.toast('用户名和密码不能为空', 'error'); return; }
        try {
          await App.api.post('/accounts', { username, password, display_name: document.getElementById('acctDisplayName')?.value || username, role: document.getElementById('acctRole')?.value || 'editor' });
          App.toast('账号已创建', 'success');
          App.closeModal();
          await App.loadDashTab('accounts');
        } catch (e) { App.toast(e.message, 'error'); }
      });
    });
  },

  /* ======== 通用工具 ======== */

  openModal(html, init) {
    App.closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modalOverlay';
    overlay.innerHTML = `<div class="modal-content">${html}</div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) App.closeModal(); });
    overlay.querySelector('#modalClose')?.addEventListener('click', () => App.closeModal());
    overlay.querySelectorAll('.modal-close-btn').forEach(b => b.addEventListener('click', () => App.closeModal()));
    if (init) init();
  },

  closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.remove();
  },

  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  },

  stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return div.textContent || '';
  },

  formatSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0; let size = bytes;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
  },
};

/* ======== 启动 ======== */
window.addEventListener('DOMContentLoaded', async () => {
  await App.checkSession();
  await App.handleRoute();

  window.addEventListener('hashchange', () => App.handleRoute());

  document.getElementById('navToggle')?.addEventListener('click', () => {
    document.getElementById('navLinks')?.classList.toggle('open');
  });

  document.addEventListener('click', e => {
    const link = e.target.closest('.nav-link[data-route="/logout"]');
    if (link) { e.preventDefault(); App.logout(); }
  });
});
