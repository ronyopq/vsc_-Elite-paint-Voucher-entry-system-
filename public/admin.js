// Admin Dashboard Application

class AdminApp {
  constructor() {
    this.user = null;
    this.users = [];
    this.stats = {};
    this.currentModal = null;
    this.apiBase = '/api';
    this.init();
  }

  async init() {
    // Check authorization
    const sessionToken = this.getCookie('session_token');
    
    if (!sessionToken) {
      window.location.href = '/';
      return;
    }

    try {
      const response = await fetch(`${this.apiBase}/auth/user`);
      if (!response.ok) {
        window.location.href = '/';
        return;
      }

      const data = await response.json();
      this.user = data.user;

      // Check if admin
      if (this.user.role !== 'admin' && this.user.role !== 'super_admin') {
        alert('অ্যাডমিন অ্যাক্সেস প্রয়োজন');
        window.location.href = '/';
        return;
      }

      this.renderNav();
      this.loadDashboard();
    } catch (error) {
      console.error('Auth check error:', error);
      window.location.href = '/';
    }
  }

  renderNav() {
    const navHTML = `
      <div class="nav-card" onclick="adminApp.switchSection('dashboard')">
        <div class="nav-card-icon">📊</div>
        <div class="nav-card-title">ড্যাশবোর্ড</div>
      </div>
      <div class="nav-card" onclick="adminApp.switchSection('users')">
        <div class="nav-card-icon">👥</div>
        <div class="nav-card-title">ব্যবহারকারী</div>
      </div>
      <div class="nav-card" onclick="adminApp.switchSection('vouchers')">
        <div class="nav-card-icon">🎫</div>
        <div class="nav-card-title">ভাউচার</div>
      </div>
      <div class="nav-card" onclick="adminApp.switchSection('settings')">
        <div class="nav-card-icon">⚙️</div>
        <div class="nav-card-title">সেটিংস</div>
      </div>
      <div class="nav-card" onclick="adminApp.switchSection('logs')">
        <div class="nav-card-icon">📋</div>
        <div class="nav-card-title">লগ</div>
      </div>
    `;

    document.getElementById('navCards').innerHTML = navHTML;
  }

  async loadDashboard() {
    try {
      const response = await fetch(`${this.apiBase}/admin/users?limit=100`);
      const data = await response.json();
      this.users = data.users || [];

      // Calculate stats
      this.stats = {
        totalUsers: this.users.length,
        activeUsers: this.users.filter(u => !u.is_blocked).length,
        trialsExpired: this.users.filter(u => new Date(u.trial_end) < new Date()).length
      };

      this.renderDashboard();
    } catch (error) {
      console.error('Load dashboard error:', error);
    }
  }

  renderDashboard() {
    const statsHTML = `
      <div class="stat-card">
        <div class="stat-label">মোট ব্যবহারকারী</div>
        <div class="stat-number">${this.stats.totalUsers}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">সক্রিয় ব্যবহারকারী</div>
        <div class="stat-number">${this.stats.activeUsers}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">মেয়াদ উত্তীর্ণ</div>
        <div class="stat-number">${this.stats.trialsExpired}</div>
      </div>
    `;

    document.getElementById('statsGrid').innerHTML = statsHTML;

    // Show recent users
    const recentHTML = `
      <h3>সম্প্রতি সংযুক্ত ব্যবহারকারী</h3>
      <table class="users-table">
        <thead>
          <tr>
            <th>নাম</th>
            <th>ইমেইল</th>
            <th>ভূমিকা</th>
            <th>অ্যাকশন</th>
          </tr>
        </thead>
        <tbody>
          ${this.users.slice(0, 5).map(u => `
            <tr>
              <td>${u.name}</td>
              <td>${u.email}</td>
              <td>${u.role}</td>
              <td>
                <button class="btn btn-small btn-primary" onclick="adminApp.loginAsUser('${u.id}')">ইনগেস লগইন</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    document.getElementById('recentActivity').innerHTML = recentHTML;
  }

  async switchSection(section) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

    // Show selected section
    const sectionElement = document.getElementById(section + 'Section');
    if (sectionElement) {
      sectionElement.classList.add('active');
    }

    // Load section content
    if (section === 'users') {
      await this.loadUsersSection();
    } else if (section === 'vouchers') {
      await this.loadVouchersSection();
    } else if (section === 'settings') {
      this.loadSettingsSection();
    } else if (section === 'logs') {
      await this.loadLogsSection();
    }
  }

  async loadUsersSection() {
    const content = document.getElementById('usersContent');
    
    if (this.users.length === 0) {
      content.innerHTML = '<p class="no-data">কোন ব্যবহারকারী নেই</p>';
      return;
    }

    const tableHTML = `
      <table class="users-table">
        <thead>
          <tr>
            <th>নাম</th>
            <th>ইমেইল</th>
            <th>ভূমিকা</th>
            <th>স্থিতি</th>
            <th>মেয়াদ শেষ</th>
            <th>অ্যাকশন</th>
          </tr>
        </thead>
        <tbody>
          ${this.users.map(u => {
            const trialEnds = new Date(u.trial_end);
            const daysLeft = Math.ceil((trialEnds - new Date()) / (1000 * 60 * 60 * 24));
            const status = u.is_blocked ? 'blocked' : (daysLeft > 0 ? 'active' : 'expired');
            
            return `
              <tr>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${u.role}</td>
                <td>
                  <span class="user-status status-${status}">
                    ${status === 'blocked' ? 'ব্লক করা' : (status === 'active' ? 'সক্রিয়' : 'মেয়াদ শেষ')}
                  </span>
                </td>
                <td>${daysLeft > 0 ? daysLeft + ' দিন' : 'শেষ'}</td>
                <td>
                  <div class="action-buttons">
                    <button class="btn btn-small btn-primary" onclick="adminApp.extendTrial('${u.id}')">সম্প্রসারণ</button>
                    <button class="btn btn-small ${u.is_blocked ? 'btn-success' : 'btn-danger'}" onclick="adminApp.toggleBlock('${u.id}', ${!u.is_blocked})">
                      ${u.is_blocked ? 'আনব্লক' : 'ব্লক'}
                    </button>
                    <button class="btn btn-small btn-primary" onclick="adminApp.loginAsUser('${u.id}')">লগইন</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    content.innerHTML = tableHTML;
  }

  async loadVouchersSection() {
    const content = document.getElementById('vouchersContent');
    content.innerHTML = '<p class="no-data">ভাউচার অনুসন্ধান বিকাশাধীন</p>';
  }

  loadSettingsSection() {
    const content = document.getElementById('settingsContent');
    const html = `
      <div class="form-group">
        <label>গ্লোবাল প্রিন্ট অফসেট X (পিক্সেল)</label>
        <input type="number" id="offsetX" value="0">
      </div>
      <div class="form-group">
        <label>গ্লোবাল প্রিন্ট অফসেট Y (পিক্সেল)</label>
        <input type="number" id="offsetY" value="0">
      </div>
      <div class="form-group">
        <label>গ্লোবাল ফন্ট সাইজ স্কেল (%)</label>
        <input type="number" id="fontScale" value="100">
      </div>
      <button class="btn btn-primary" onclick="adminApp.saveSettings()">সংরক্ষণ করুন</button>
    `;

    content.innerHTML = html;
  }

  async saveSettings() {
    const offsetX = document.getElementById('offsetX').value;
    const offsetY = document.getElementById('offsetY').value;
    const fontScale = document.getElementById('fontScale').value;

    // Save to backend
    alert('সেটিংস সংরক্ষিত হয়েছে');
  }

  async loadLogsSection() {
    const content = document.getElementById('logsContent');
    content.innerHTML = '<p class="no-data">লগ বিকাশাধীন</p>';
  }

  async toggleBlock(userId, block) {
    if (confirm(`এই ব্যবহারকারীকে ${block ? 'ব্লক' : 'আনব্লক'} করতে চান?`)) {
      try {
        const response = await fetch(`${this.apiBase}/admin/user/block`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, blocked: block })
        });

        if (response.ok) {
          await this.loadDashboard();
          await this.switchSection('users');
        }
      } catch (error) {
        console.error('Block error:', error);
      }
    }
  }

  extendTrial(userId) {
    this.currentModal = { userId, action: 'extend' };
    
    const html = `
      <div class="form-group">
        <label>দিনের সংখ্যা যোগ করুন</label>
        <input type="number" id="extensionDays" value="30" min="1" max="365">
      </div>
    `;

    this.showModal('ট্রায়াল সম্প্রসারণ', html);
  }

  async handleModalSubmit() {
    if (this.currentModal.action === 'extend') {
      const days = document.getElementById('extensionDays').value;
      
      try {
        const response = await fetch(`${this.apiBase}/admin/user/extend-trial`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: this.currentModal.userId, days: parseInt(days) })
        });

        if (response.ok) {
          await this.loadDashboard();
          await this.switchSection('users');
          this.closeModal();
        }
      } catch (error) {
        console.error('Extend trial error:', error);
      }
    }
  }

  async loginAsUser(userId) {
    try {
      const response = await fetch(`${this.apiBase}/admin/user/login-as`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Login as error:', error);
    }
  }

  showModal(title, body) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modal').classList.add('active');
  }

  closeModal() {
    document.getElementById('modal').classList.remove('active');
    this.currentModal = null;
  }

  async logout() {
    if (confirm('লগ আউট করতে চান?')) {
      try {
        await fetch('/auth/logout', { method: 'POST' });
        window.location.href = '/';
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
  }

  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }
}

// Initialize admin app
let adminApp;
document.addEventListener('DOMContentLoaded', () => {
  adminApp = new AdminApp();
});
