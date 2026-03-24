// Elite Paint Voucher Entry System - Main Application
// Frontend Application Logic

class VoucherApp {
  constructor() {
    this.user = null;
    this.currentVoucher = null;
    this.voucherHistory = [];
    this.apiBase = '';
    this.historyFilter = '';
    this.init();
  }

  async init() {
    // Show OAuth error message if callback returned with an error.
    this.showAuthErrorFromQuery();

    try {
      // Session cookie is HttpOnly, so frontend must validate auth via API.
      const response = await fetch(`${this.apiBase}/auth/user`);
      if (!response.ok) {
        this.showAuthPage();
        return;
      }

      const data = await response.json();
      this.user = data.user;
      this.showDashboard();
    } catch (error) {
      console.error('Auth check error:', error);
      this.showAuthPage();
    }
  }

  showAuthErrorFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('auth_error');
    const description = params.get('auth_error_description');

    if (!code) return;

    const messages = {
      access_denied: 'আপনি Google লগইন অনুমতি দেননি। আবার চেষ্টা করুন।',
      invalid_state: 'লগইন সেশন মেয়াদ শেষ হয়েছে। আবার লগইন করুন।',
      missing_code_or_state: 'Google লগইন সম্পন্ন হয়নি। আবার চেষ্টা করুন।',
      oauth_callback_failed: 'Google লগইন যাচাই করা যায়নি। আবার চেষ্টা করুন।'
    };

    const fallback = 'লগইন করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।';
    const extra = description ? `\nবিস্তারিত: ${description}` : '';
    this.showError((messages[code] || fallback) + extra);

    // Clean query params so refresh does not repeat the same error state.
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('auth_error');
    cleanUrl.searchParams.delete('auth_error_description');
    window.history.replaceState({}, '', cleanUrl.toString());
  }

  showAuthPage() {
    document.getElementById('authContainer').style.display = 'block';
    document.getElementById('dashboardContainer').style.display = 'none';
  }

  showDashboard() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('dashboardContainer').style.display = 'block';
    document.getElementById('userName').textContent = this.user.name || this.user.email;
    
    // Initialize tabs
    this.initVoucherForm();
    this.loadVoucherHistory();
    this.loadReports();
    this.loadSettings();
  }

  getUserSettings() {
    const defaults = {
      depotName: 'Khulna Depot',
      voucherNo: {
        mode: 'auto',
        format: 'VOC-{YYYY}{MM}-{####}',
        start: 1,
        sequential: true
      },
      code: {
        mode: 'manual',
        format: 'CODE-{####}',
        start: 1,
        sequential: true
      },
      headOfAccounts: {
        inputType: 'dropdown',
        options: ['Office Expense', 'Depot Expense', 'Transport Expense'],
        defaultValue: ''
      },
      controlAccount: {
        mode: 'manual',
        defaultValue: '',
        options: ['Cash', 'Bank', 'Petty Cash']
      },
      qr: {
        enabled: true,
        size: 60,
        x: 0,
        y: 0
      },
      officers: {
        show: false,
        acknowledged: '',
        prepared: '',
        verified: '',
        recommended: '',
        approved: ''
      },
      publicUrl: {
        enabled: true,
        showShareButtons: true,
        showVerifyLink: true,
        showQr: true
      }
    };

    try {
      const stored = JSON.parse(localStorage.getItem('userConfigSettings') || '{}');
      return {
        ...defaults,
        ...stored,
        voucherNo: { ...defaults.voucherNo, ...(stored.voucherNo || {}) },
        code: { ...defaults.code, ...(stored.code || {}) },
        headOfAccounts: { ...defaults.headOfAccounts, ...(stored.headOfAccounts || {}) },
        controlAccount: { ...defaults.controlAccount, ...(stored.controlAccount || {}) },
        qr: { ...defaults.qr, ...(stored.qr || {}) },
        officers: { ...defaults.officers, ...(stored.officers || {}) },
        publicUrl: { ...defaults.publicUrl, ...(stored.publicUrl || {}) }
      };
    } catch {
      return defaults;
    }
  }

  saveUserSettings(settings) {
    localStorage.setItem('userConfigSettings', JSON.stringify(settings));
  }

  formatSerialByPattern(pattern, serial, dateObj = new Date()) {
    const y = String(dateObj.getFullYear());
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const serial4 = String(serial).padStart(4, '0');
    const serial3 = String(serial).padStart(3, '0');
    const serial2 = String(serial).padStart(2, '0');

    return String(pattern || '{####}')
      .replaceAll('{YYYY}', y)
      .replaceAll('{MM}', mm)
      .replaceAll('{DD}', dd)
      .replaceAll('{####}', serial4)
      .replaceAll('{###}', serial3)
      .replaceAll('{##}', serial2)
      .replaceAll('{#}', String(serial));
  }

  getNextSerialValue(typeKey) {
    const settings = this.getUserSettings();
    const cfg = typeKey === 'voucher' ? settings.voucherNo : settings.code;
    const start = parseInt(cfg.start, 10) || 1;

    if (!cfg.sequential) {
      return start;
    }

    const formattedList = this.voucherHistory
      .map((v) => typeKey === 'voucher' ? (v.voucher_no || '') : (v.code_no || ''))
      .filter(Boolean);

    let maxFound = start - 1;
    formattedList.forEach((value) => {
      const digits = String(value).match(/(\d+)(?!.*\d)/);
      if (!digits) return;
      const serial = parseInt(digits[1], 10);
      if (!Number.isNaN(serial) && serial > maxFound) {
        maxFound = serial;
      }
    });

    return maxFound + 1;
  }

  // Bengali Number-to-Word Converter (Indian Format)
  convertNumberToBengaliWords(num) {
    if (num === 0) return 'শূন্য';
    
    const ones = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
    const teens = ['দশ', 'এগার', 'বার', 'তের', 'চৌদ্দ', 'পনের', 'ষোল', 'সতের', 'আঠার', 'উনিশ'];
    const tens = ['', '', 'বিশ', 'ত্রিশ', 'চল্লিশ', 'পঞ্চাশ', 'ষাট', 'সত্তর', 'আশি', 'নব্বই'];
    const scales = [
      { name: 'কোটি', value: 10000000 },
      { name: 'লক্ষ', value: 100000 },
      { name: 'হাজার', value: 1000 },
      { name: 'শত', value: 100 }
    ];

    const convertHundreds = (n) => {
      let result = '';
      const hundred = Math.floor(n / 100);
      if (hundred > 0) {
        result += ones[hundred] + ' শত ';
      }
      const remainder = n % 100;
      if (remainder >= 10 && remainder < 20) {
        result += teens[remainder - 10] + ' ';
      } else {
        const ten = Math.floor(remainder / 10);
        const one = remainder % 10;
        if (ten > 0) result += tens[ten] + ' ';
        if (one > 0) result += ones[one] + ' ';
      }
      return result.trim();
    };

    let result = '';
    let n = Math.floor(num);
    
    for (const scale of scales) {
      const part = Math.floor(n / scale.value);
      if (part > 0) {
        result += convertHundreds(part) + ' ' + scale.name + ' ';
        n %= scale.value;
      }
    }

    if (n > 0) {
      result += convertHundreds(n);
    }

    return result.trim() + ' টাকা';
  }

  // Animated Notification System
  showNotification(title, message, type = 'success', actions = []) {
    const modal = document.getElementById('notificationModal');
    const iconEl = document.getElementById('notificationIcon');
    const titleEl = document.getElementById('notificationTitle');
    const messageEl = document.getElementById('notificationMessage');
    const actionsEl = document.getElementById('notificationActions');

    // Set icon based on type
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    iconEl.textContent = icons[type] || icons.info;
    iconEl.style.color = {
      'success': '#0f4c81',
      'error': '#ea4335',
      'warning': '#f59e0b',
      'info': '#0f4c81'
    }[type] || '#0f4c81';

    titleEl.textContent = title;
    messageEl.textContent = message;

    // Render action buttons
    actionsEl.innerHTML = actions.map(action => {
      const btnClass = action.type === 'primary' ? 'btn-primary' : 'btn-secondary';
      return `<button class="${btnClass}" onclick="${action.handler}">${action.label}</button>`;
    }).join('');

    modal.style.display = 'flex';

    // Auto-close after 5 seconds if no interactive actions
    if (actions.length === 0) {
      setTimeout(() => {
        this.closeNotification();
      }, 5000);
    }
  }

  closeNotification() {
    const modal = document.getElementById('notificationModal');
    modal.style.display = 'none';
  }

  // PDF Export with jsPDF library (fallback to print)
  async exportVoucherToPDF(voucher) {
    const voucherHtml = this.buildVoucherMemoHTML(voucher, { forPrint: true });
    
    // Create temporary container
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = voucherHtml;
    tempDiv.style.display = 'none';
    document.body.appendChild(tempDiv);

    // Use html2canvas and jsPDF if available, otherwise fallback to print
    try {
      const script1 = await import('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      const script2 = await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      
      const html2canvas = script1.default;
      const jsPDF = script2.jsPDF;

      const canvas = await html2canvas(tempDiv.querySelector('.voucher-memo'));
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF.jsPDF({
        orientation: 'landscape',
        unit: 'cm',
        format: [21.1, 14.35]
      });
      pdf.addImage(img, 'PNG', 0, 0, 21.1, 14.35);
      pdf.save(`voucher-${voucher.public_id || 'export'}.pdf`);
    } catch {
      // Fallback: Open print dialog
      const printWindow = window.open('', '', 'width=900,height=700');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="bn">
        <head>
          <meta charset="UTF-8">
          <style>
            @page { size: 21.1cm 14.35cm; margin: 0; }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; }
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          </style>
        </head>
        <body>
          ${voucherHtml}
          <script>
            window.print();
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
    
    document.body.removeChild(tempDiv);
  }

  initVoucherForm() {
    const userSettings = this.getUserSettings();

    const formHTML = `
      <h2>নতুন ভাউচার এন্ট্রি</h2>
      <form id="voucherEntryForm">
        <div class="template-toolbar">
          <select id="voucherTemplateSelect">
            <option value="">টেমপ্লেট নির্বাচন করুন</option>
          </select>
          <button type="button" class="btn-secondary" onclick="app.applySelectedTemplate()">লোড টেমপ্লেট</button>
          <button type="button" class="btn-secondary" onclick="app.saveCurrentTemplate()">টেমপ্লেট সেভ</button>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>ভাউচার নম্বর *</label>
            <input type="text" id="voucherNo" placeholder="উদা: VOC-001" required ${userSettings.voucherNo.mode === 'auto' ? 'readonly' : ''}>
            <button type="button" class="auto-btn" onclick="app.autoIncrementVoucher()">স্বয়ংক্রিয়</button>
          </div>
          <div class="form-group">
            <label>তারিখ *</label>
            <input type="date" id="date" required>
            <button type="button" class="auto-btn" onclick="app.setToday()">আজ</button>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>যাকে দিতে হবে *</label>
            <input type="text" id="payTo" placeholder="নাম" required>
            <div class="payee-description">
              <input type="text" id="payeeDescription" placeholder="বিবরণ (ঐচ্ছিক)">
            </div>
            <ul class="suggestions" id="payToSuggestions"></ul>
          </div>
          <div class="form-group">
            <label>কোড নম্বর</label>
            <input type="text" id="codeNo" placeholder="কোড" ${userSettings.code.mode === 'auto' ? 'readonly' : ''}>
            <ul class="suggestions" id="codeNoSuggestions"></ul>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>হেড অফ একাউন্টস</label>
            <select id="headOfAccounts" class="select2-dropdown"></select>
          </div>
          <div class="form-group">
            <label>নিয়ন্ত্রণ অ্যাকাউন্ট *</label>
            <select id="controlAc" class="select2-dropdown" required></select>
            <ul class="suggestions" id="controlAcSuggestions"></ul>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>অ্যাকাউন্ট নম্বর</label>
            <select id="accountNo" class="select2-dropdown"></select>
          </div>
          <div class="form-group">
            <label>পেমেন্ট পদ্ধতি</label>
            <select id="paymentMethod">
              <option value="">নির্বাচন করুন</option>
              <option value="নগদ">নগদ</option>
              <option value="চেক">চেক</option>
              <option value="ট্রান্সফার">ব্যাংক ট্রান্সফার</option>
              <option value="ক্রেডিট কার্ড">ক্রেডিট কার্ড</option>
            </select>
          </div>
        </div>

        <div class="form-group full-width">
          <label>বিবরণ (বিশেষ তথ্য) *</label>
          <div class="particulars-grid">
            <div class="particular-row">
              <input type="text" id="particular1" class="particular-input" placeholder="প্রথম বিবরণ" />
              <input type="text" id="particularAmount1" class="particular-amount-input" placeholder="টাকা (বাংলা/ইংরেজি সংখ্যা)" inputmode="decimal" />
            </div>
            <div class="particular-row">
              <input type="text" id="particular2" class="particular-input" placeholder="দ্বিতীয় বিবরণ" />
              <input type="text" id="particularAmount2" class="particular-amount-input" placeholder="টাকা (বাংলা/ইংরেজি সংখ্যা)" inputmode="decimal" />
            </div>
            <div class="particular-row">
              <input type="text" id="particular3" class="particular-input" placeholder="তৃতীয় বিবরণ" />
              <input type="text" id="particularAmount3" class="particular-amount-input" placeholder="টাকা (বাংলা/ইংরেজি সংখ্যা)" inputmode="decimal" />
            </div>
            <div class="particular-row">
              <input type="text" id="particular4" class="particular-input" placeholder="চতুর্থ বিবরণ" />
              <input type="text" id="particularAmount4" class="particular-amount-input" placeholder="টাকা (বাংলা/ইংরেজি সংখ্যা)" inputmode="decimal" />
            </div>
            <div class="particular-row">
              <input type="text" id="particular5" class="particular-input" placeholder="পঞ্চম বিবরণ" />
              <input type="text" id="particularAmount5" class="particular-amount-input" placeholder="টাকা (বাংলা/ইংরেজি সংখ্যা)" inputmode="decimal" />
            </div>
          </div>
          <div class="particular-total-row">
            <label for="amount">মোট টাকা *</label>
            <input type="text" id="amount" placeholder="০.০০" required readonly>
          </div>
          <div class="amount-words" id="amountWords"></div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-primary">সংরক্ষণ ও প্রিন্ট</button>
          <button type="button" class="btn-secondary" onclick="app.clearForm()">পরিষ্কার</button>
        </div>
      </form>
    `;

    const formContainer = document.getElementById('voucherForm');
    formContainer.innerHTML = formHTML;

    // Setup form listeners
    document.getElementById('voucherEntryForm').addEventListener('submit', (e) => this.handleVoucherSubmit(e));

    // Initialize Select2 dropdowns after DOM is ready
    setTimeout(() => {
      this.initializeSelect2Dropdowns(userSettings);
    }, 50);

    // Setup auto-suggestions
    ['payTo', 'codeNo'].forEach(field => {
      const input = document.getElementById(field);
      if (input && input.tagName === 'INPUT') {
        input.addEventListener('input', (e) => this.getSuggestions(field, e.target.value));
      }
    });

    // Setup particulars amount listeners to auto-calculate total
    for (let i = 1; i <= 5; i += 1) {
      const amountInput = document.getElementById(`particularAmount${i}`);
      if (amountInput) {
        amountInput.addEventListener('input', () => this.updateParticularsTotal());
      }
    }

    // Set today's date by default
    this.setToday();
    this.updateParticularsTotal();
    this.renderTemplateOptions();

    if (userSettings.voucherNo.mode === 'auto') {
      this.autoIncrementVoucher();
    }

    if (userSettings.code.mode === 'auto') {
      const serial = this.getNextSerialValue('code');
      document.getElementById('codeNo').value = this.formatSerialByPattern(userSettings.code.format, serial, new Date());
    }

    if (userSettings.controlAccount.mode === 'auto') {
      const controlInput = document.getElementById('controlAc');
      if (controlInput) {
        controlInput.value = userSettings.controlAccount.defaultValue || '';
      }
    }

    const headInput = document.getElementById('headOfAccounts');
    if (headInput && userSettings.headOfAccounts.defaultValue) {
      headInput.value = userSettings.headOfAccounts.defaultValue;
    }
  }

  initializeSelect2Dropdowns(userSettings) {
    // Head of Accounts
    const headSelect = $('#headOfAccounts');
    if (headSelect.length) {
      headSelect.select2({
        data: (userSettings.headOfAccounts.options || []).map(opt => ({id: opt, text: opt})),
        tags: true,
        tokenSeparators: [','],
        createTag: function (params) {
          const term = $.trim(params.term);
          if (term === '') return null;
          return {id: term, text: term, newTag: true};
        },
        language: {
          noResults: () => 'কোনো ফলাফল নেই',
          searching: () => 'অনুসন্ধান করছি...'
        }
      });
      if (userSettings.headOfAccounts.defaultValue) {
        headSelect.val(userSettings.headOfAccounts.defaultValue).trigger('change');
      }
    }

    // Control Account
    const controlSelect = $('#controlAc');
    if (controlSelect.length) {
      controlSelect.select2({
        data: (userSettings.controlAccount.options || []).map(opt => ({id: opt, text: opt})),
        tags: true,
        tokenSeparators: [','],
        createTag: function (params) {
          const term = $.trim(params.term);
          if (term === '') return null;
          return {id: term, text: term, newTag: true};
        },
        language: {
          noResults: () => 'কোনো ফলাফল নেই',
          searching: () => 'অনুসন্ধান করছি...'
        }
      });
      if (userSettings.controlAccount.defaultValue) {
        controlSelect.val(userSettings.controlAccount.defaultValue).trigger('change');
      } else if (userSettings.controlAccount.mode === 'auto') {
        controlSelect.val(userSettings.controlAccount.defaultValue || '').trigger('change');
      }
    }

    // Account Number
    const accountSelect = $('#accountNo');
    if (accountSelect.length) {
      // Assuming account numbers can be added dynamically
      accountSelect.select2({
        data: [
          {id: 'ACC001', text: 'ACC001 - প্রধান অ্যাকাউন্ট'},
          {id: 'ACC002', text: 'ACC002 - গৌণ অ্যাকাউন্ট'},
          {id: 'ACC003', text: 'ACC003 - বিশেষ অ্যাকাউন্ট'}
        ],
        tags: true,
        tokenSeparators: [','],
        createTag: function (params) {
          const term = $.trim(params.term);
          if (term === '') return null;
          return {id: term, text: term, newTag: true};
        },
        language: {
          noResults: () => 'কোনো ফলাফল নেই',
          searching: () => 'অনুসন্ধান করছি...'
        }
      });
    }
  }

  newVoucherQuick() {
    // Switch to voucher tab and clear form
    switchTab('voucher');
    this.clearForm();
    // Focus on first field
    setTimeout(() => {
      const firstInput = document.getElementById('voucherNo');
      if (firstInput) firstInput.focus();
    }, 100);
    
    // Show notification
    this.showNotification('নতুন ভাউচার', 'ফর্ম প্রস্তুত। এখন ভাউচার তথ্য প্রবেश করুন।', 'info');
  }

  async handleVoucherSubmit(e) {
    e.preventDefault();
    const userSettings = this.getUserSettings();

    const rows = [];
    for (let i = 1; i <= 5; i += 1) {
      const text = (document.getElementById(`particular${i}`).value || '').trim();
      const amount = this.parseLocalizedAmount(document.getElementById(`particularAmount${i}`).value || '0');
      if (text || amount > 0) {
        rows.push({ text, amount });
      }
    }

    const particulars = rows.map(row => `${row.text}|||${row.amount}`).join(' || ');
    const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

    if (!rows.length) {
      this.showError('অন্তত একটি বিবরণ প্রয়োজন।');
      return;
    }

    if (totalAmount <= 0) {
      this.showError('অন্তত একটি টাকার পরিমাণ প্রয়োজন।');
      return;
    }

    const isLikelyDuplicate = this.voucherHistory.some((v) => {
      const sameDate = (v.date || '') === document.getElementById('date').value;
      const samePayTo = String(v.pay_to || '').trim().toLowerCase() === String(document.getElementById('payTo').value || '').trim().toLowerCase();
      const sameAmount = Math.abs((parseFloat(v.amount) || 0) - totalAmount) < 0.001;
      return sameDate && samePayTo && sameAmount;
    });

    if (isLikelyDuplicate) {
      const confirmed = confirm('একই তারিখ, নাম ও টাকার একটি ভাউচার আগেই আছে। তবুও সংরক্ষণ করতে চান?');
      if (!confirmed) {
        return;
      }
    }

    const budgetSettings = this.getBudgetSettings();
    if (budgetSettings.monthlyLimit > 0) {
      const currentMonthSpent = this.getCurrentMonthSpent();
      const projected = currentMonthSpent + totalAmount;
      if (projected > budgetSettings.monthlyLimit) {
        const overBy = projected - budgetSettings.monthlyLimit;
        const proceed = confirm(`মাসিক বাজেট ছাড়িয়ে যাবে। সীমা: ${this.formatAmount(budgetSettings.monthlyLimit)} টাকা, অতিরিক্ত: ${this.formatAmount(overBy)} টাকা। তবুও সংরক্ষণ করবেন?`);
        if (!proceed) {
          return;
        }
      }
    }

    const voucherData = {
      date: document.getElementById('date').value,
      voucherNo: document.getElementById('voucherNo').value,
      payTo: document.getElementById('payTo').value,
      payeeDescription: document.getElementById('payeeDescription')?.value || '',
      codeNo: document.getElementById('codeNo').value,
      controlAc: document.getElementById('controlAc').value,
      particulars: particulars,
      amount: totalAmount,
      accountNo: document.getElementById('accountNo').value,
      paymentMethod: document.getElementById('paymentMethod').value
    };

    try {
      const response = await fetch(`${this.apiBase}/api/voucher/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voucherData)
      });

      if (!response.ok) {
        const error = await response.json();
        this.showError(error.error || 'ভাউচার সংরক্ষণ ব্যর্থ');
        return;
      }

      const result = await response.json();
      result.voucher.headOfAccounts = document.getElementById('headOfAccounts')?.value || userSettings.headOfAccounts.defaultValue || '';
      result.voucher.payeeDescription = voucherData.payeeDescription;
      this.currentVoucher = result.voucher;

      // Show preview
      this.showVoucherPreview(result.voucher);

      // Offer to print
      setTimeout(() => {
        if (confirm('ভাউচার প্রিন্ট করতে চাইছেন?')) {
          this.printVoucher(result.voucher);
        }
      }, 500);

      // Reload history
      this.loadVoucherHistory();

    } catch (error) {
      console.error('Submit error:', error);
      this.showError('একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।');
    }
  }

  async getSuggestions(field, value) {
    if (!value || value.length < 1) {
      this.clearSuggestions(field);
      return;
    }

    try {
      const typeMap = {
        payTo: 'payto',
        codeNo: 'code',
        controlAc: 'ac',
        particulars: 'particulars'
      };

      const response = await fetch(`${this.apiBase}/api/suggest/${typeMap[field]}?q=${encodeURIComponent(value)}`);
      const data = await response.json();

      this.displaySuggestions(field, data.suggestions || []);
    } catch (error) {
      console.error('Suggestions error:', error);
    }
  }

  displaySuggestions(field, suggestions) {
    const container = document.getElementById(`${field}Suggestions`);
    if (!container) return;

    if (!suggestions || suggestions.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = suggestions.map(s => 
      `<li onclick="app.selectSuggestion('${field}', '${s.replace(/'/g, "\\'")}')">${this.escapeHtml(s)}</li>`
    ).join('');
  }

  clearSuggestions(field) {
    const container = document.getElementById(`${field}Suggestions`);
    if (container) container.innerHTML = '';
  }

  selectSuggestion(field, value) {
    document.getElementById(field).value = value;
    this.clearSuggestions(field);
    this.saveSuggestion(field, value);
  }

  async saveSuggestion(field, value) {
    const typeMap = {
      payTo: 'payto',
      codeNo: 'code',
      controlAc: 'ac',
      particulars: 'particulars'
    };

    try {
      await fetch(`${this.apiBase}/api/suggest/${typeMap[field]}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
    } catch (error) {
      console.error('Save suggestion error:', error);
    }
  }

  updateAmountWords(amount) {
    if (!amount || isNaN(amount)) {
      document.getElementById('amountWords').innerHTML = '';
      return;
    }

    // Convert number to Bangla words
    const words = this.numberToBanglaWords(parseFloat(amount));
    document.getElementById('amountWords').innerHTML = `<em>${words}</em>`;
  }

  updateParticularsTotal() {
    let total = 0;
    for (let i = 1; i <= 5; i += 1) {
      const amount = this.parseLocalizedAmount(document.getElementById(`particularAmount${i}`)?.value || '0');
      total += amount;
    }

    const amountInput = document.getElementById('amount');
    if (amountInput) {
      amountInput.value = total > 0 ? this.formatAmount(total) : '';
    }

    this.updateAmountWords(total);
  }

  parseLocalizedAmount(value) {
    if (value === null || value === undefined) return 0;
    const normalized = String(value)
      .replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))
      .replace(/,/g, '')
      .trim();
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  numberToBanglaWords(num) {
    const units = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
    const tens = ['', '', 'বিশ', 'ত্রিশ', 'চল্লিশ', 'পঞ্চাশ', 'ষাট', 'সত্তর', 'আশি', 'নব্বই'];
    const hundreds = ['', 'একশত', 'দুইশত', 'তিনশত', 'চারশত', 'পাঁচশত', 'ছয়শত', 'সাতশত', 'আটশত', 'নয়শত'];

    if (num === 0) return 'শূন্য টাকা';

    let result = '';

    // Handle crores
    if (num >= 10000000) {
      const crore = Math.floor(num / 10000000);
      result += this.convertToBangla(crore) + ' কোটি ';
      num %= 10000000;
    }

    // Handle lakhs
    if (num >= 100000) {
      const lakh = Math.floor(num / 100000);
      result += this.convertToBangla(lakh) + ' লক্ষ ';
      num %= 100000;
    }

    // Handle thousands
    if (num >= 1000) {
      const thousand = Math.floor(num / 1000);
      result += this.convertToBangla(thousand) + ' হাজার ';
      num %= 1000;
    }

    // Handle hundreds
    if (num >= 100) {
      const hundred = Math.floor(num / 100);
      result += hundreds[hundred] + ' ';
      num %= 100;
    }

    // Handle 10-99
    if (num >= 10) {
      const ten = Math.floor(num / 10);
      const unit = num % 10;
      if (unit === 0) {
        result += tens[ten] + ' ';
      } else {
        result += tens[ten] + ' ' + units[unit] + ' ';
      }
    } else if (num > 0) {
      result += units[num] + ' ';
    }

    return result.trim() + ' টাকা';
  }

  convertToBangla(num) {
    const units = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
    if (num < 10) return units[num];
    if (num < 100) {
      const tens = ['', '', 'বিশ', 'ত্রিশ', 'চল্লিশ', 'পঞ্চাশ', 'ষাট', 'সত্তর', 'আশি', 'নব্বই'];
      return tens[Math.floor(num / 10)] + (num % 10 > 0 ? ' ' + units[num % 10] : '');
    }
    return [];
  }

  showVoucherPreview(voucher) {
    const settings = this.getUserSettings();
    const previewHTML = `
      <div class="voucher-preview">
        <div class="preview-header">
          <h3>প্রিভিউ</h3>
          <button type="button" class="btn-primary" onclick="app.printVoucher(${JSON.stringify(voucher).replace(/"/g, '&quot;')})">প্রিন্ট করুন</button>
          ${settings.publicUrl.enabled && settings.publicUrl.showShareButtons ? `<button type="button" class="btn-secondary" onclick="app.copyLink('${voucher.publicId}')">লিঙ্ক কপি</button>` : ''}
        </div>
        <div id="voucherCanvas"></div>
      </div>
    `;

    document.getElementById('voucherPreview').innerHTML = previewHTML;
    this.renderVoucher(voucher, 'voucherCanvas');
  }

  renderVoucher(voucher, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = this.buildVoucherMemoHTML(voucher);
  }

  parseVoucherRows(voucher) {
    const rawParticulars = (voucher.particulars || '').trim();
    const rows = [];

    if (rawParticulars.includes('|||')) {
      const rawRows = rawParticulars.split(' || ');
      rawRows.forEach((row) => {
        const [text = '', amountRaw = '0'] = row.split('|||');
        rows.push({
          text: text.trim(),
          amount: this.parseLocalizedAmount(amountRaw || '0')
        });
      });
    } else {
      const legacyRows = rawParticulars.split(' | ').filter(p => p.trim());
      legacyRows.forEach((text, index) => {
        rows.push({
          text: text.trim(),
          amount: index === 0 ? (parseFloat(voucher.amount) || 0) : 0
        });
      });
    }

    while (rows.length < 5) {
      rows.push({ text: '', amount: 0 });
    }

    return rows.slice(0, 5);
  }

  buildVoucherMemoHTML(voucher, options = {}) {
    const forPrint = options.forPrint === true;
    const userSettings = this.getUserSettings();
    const rows = this.parseVoucherRows(voucher);
    const total = rows.reduce((sum, row) => sum + (row.amount || 0), 0) || (parseFloat(voucher.amount) || 0);
    const publicId = voucher.publicId || voucher.public_id || '';
    const shareUrl = publicId ? `${window.location.origin}/v/${publicId}` : '';
    const qrEnabled = userSettings.publicUrl.enabled && userSettings.publicUrl.showQr && userSettings.qr.enabled;
    const qrSize = Number(userSettings.qr.size) || 60;
    const qrX = Number(userSettings.qr.x) || 0;
    const qrY = Number(userSettings.qr.y) || 0;
    const qrUrl = shareUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(shareUrl)}`
      : '';
    const dateParts = this.getDateParts(voucher.date);

    return `
      <style>
        .voucher-memo {
          width: 8.3in;
          height: 5.65in;
          background: white;
          background-image: url('/voucher-template.jpg');
          background-size: 100% 100%;
          background-repeat: no-repeat;
          font-family: Arial, sans-serif;
          padding: 24px 28px;
          margin: ${forPrint ? '0' : '20px auto'};
          box-shadow: ${forPrint ? 'none' : '0 0 10px rgba(0,0,0,0.1)'};
          color: #000;
          position: relative;
          overflow: hidden;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .memo-header {
          text-align: center;
          margin-bottom: 18px;
          border-bottom: 2px solid #000;
          padding-bottom: 12px;
        }
        .company-name {
          font-weight: bold;
          font-size: 16px;
          margin-bottom: 3px;
        }
        .company-address {
          font-size: 11px;
          line-height: 1.3;
          margin-bottom: 3px;
        }
        .voucher-type {
          font-weight: bold;
          font-size: 14px;
          margin: 5px 0;
          border: 2px solid #000;
          padding: 5px 15px;
          display: inline-block;
          border-radius: 3px;
        }
        .header-info {
          text-align: right;
          font-size: 12px;
          margin-top: 4px;
          margin-right: 110px;
        }
        .header-field {
          margin: 4px 0;
        }
        .field-label {
          font-weight: bold;
          display: inline-block;
          width: 100px;
        }
        .field-value {
          border-bottom: 1px solid #000;
          display: inline-block;
          width: 150px;
          text-align: center;
        }
        .date-boxes {
          display: inline-flex;
          gap: 2px;
          vertical-align: middle;
        }
        .date-box {
          width: 36px;
          height: 20px;
          border: 1px solid #000;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: bold;
          background: #fff;
        }
        .date-box.year {
          width: 52px;
        }
        .memo-qr {
          position: absolute;
          right: ${30 - qrX}px;
          top: ${32 + qrY}px;
          width: ${qrSize}px;
          height: ${qrSize}px;
          border: 1px solid #000;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .memo-qr img {
          width: 100%;
          height: 100%;
        }
        .memo-qr-fallback {
          font-size: 10px;
          text-align: center;
          padding: 4px;
          word-break: break-all;
        }
        .form-fields {
          margin: 10px 0;
          font-size: 12px;
        }
        .form-row {
          margin-bottom: 8px;
          display: flex;
          gap: 20px;
          align-items: center;
        }
        .form-row-full {
          margin-bottom: 8px;
        }
        .row-label {
          font-weight: bold;
          min-width: 110px;
        }
        .row-value {
          flex: 1;
          border-bottom: 1px solid #000;
          min-height: 18px;
        }
        .memo-table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
          font-size: 12px;
        }
        .memo-table th,
        .memo-table td {
          border: 1px solid #000;
          padding: 5px 6px;
        }
        .memo-table th {
          text-align: center;
          font-weight: bold;
          background: #f8f8f8;
        }
        .particulars-col {
          width: 70%;
        }
        .taka-col {
          width: 26%;
          text-align: right;
        }
        .ps-col {
          width: 4%;
          text-align: center;
        }
        .total-label {
          text-align: right;
          font-weight: bold;
        }
        .total-amount {
          font-weight: bold;
          background: #f8f8f8;
        }
        .footer-signatures {
          display: flex;
          justify-content: space-around;
          margin-top: 24px;
        }
        .sig-item {
          width: 130px;
          text-align: center;
        }
        .sig-line {
          border-top: 1px solid #000;
          margin-top: 26px;
        }
      </style>

      <div class="voucher-memo">
        ${qrEnabled ? `<div class="memo-qr">
          ${qrUrl
            ? `<img src="${qrUrl}" alt="Voucher QR">`
            : `<div class="memo-qr-fallback">${this.escapeHtml(publicId || 'QR')}</div>`}
        </div>` : ''}

        <div class="memo-header">
          <div class="company-name">ELITE PAINT & CHEMICAL INDUSTRIES LTD.</div>
          <div class="company-address">
            Corporate Office: Syed Grand Centre (Level-B & 12), Plot # 89 Road # 28, Sector # 7, Uttara, Dhaka-1230.<br>
            Khulna Office: 12, Sher-E-Bangla Road, Khulna.
          </div>
          <div style="font-weight: bold; margin-top: 5px;">${this.escapeHtml(voucher.depotName || userSettings.depotName || 'Khulna Depot')}</div>
          <div class="voucher-type">DEBIT VOUCHER</div>
        </div>

        <div class="header-info">
          <div class="header-field">
            <span class="field-label">Voucher No.</span>
            <span class="field-value">${this.escapeHtml(voucher.voucherNo || '')}</span>
          </div>
          <div class="header-field">
            <span class="field-label">Date</span>
            <span class="date-boxes">
              <span class="date-box">${dateParts.day}</span>
              <span class="date-box">${dateParts.month}</span>
              <span class="date-box year">${dateParts.year}</span>
            </span>
          </div>
        </div>

        <div class="form-fields">
          <div class="form-row">
            <span class="row-label">Code No.</span>
            <span class="row-value">${this.escapeHtml(voucher.codeNo || '')}</span>
          </div>
          <div class="form-row-full">
            <div class="row-label">Pay to</div>
            <div class="row-value">${this.escapeHtml(voucher.payTo || '')}</div>
          </div>
          <div class="form-row">
            <span class="row-label">Head of Accounts</span>
            <span class="row-value">${this.escapeHtml(voucher.headOfAccounts || userSettings.headOfAccounts.defaultValue || '')}</span>
            <span class="row-label" style="margin-left: 30px;">Control A/C.</span>
            <span class="row-value">${this.escapeHtml(voucher.controlAc || '')}</span>
          </div>
        </div>

        <table class="memo-table">
          <thead>
            <tr>
              <th class="particulars-col">PARTICULARS</th>
              <th class="taka-col">TAKA</th>
              <th class="ps-col">PS.</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td class="particulars-col">${this.escapeHtml(row.text)}</td>
                <td class="taka-col">${row.amount > 0 ? this.formatAmount(row.amount) : ''}</td>
                <td class="ps-col"></td>
              </tr>
            `).join('')}
            <tr>
              <td colspan="3" style="padding:7px;">
                <div style="display:flex; gap:20px;">
                  <div style="flex:1;">
                    <strong style="font-size:11px;">CASH/CHEQUE/P.O/D.D</strong>
                    <div style="border-bottom:1px solid #000; height:15px;"></div>
                  </div>
                  <div style="flex:1;">
                    <strong style="font-size:11px;">A/c. No. :</strong>
                    <div style="border-bottom:1px solid #000; height:15px;">${this.escapeHtml(voucher.accountNo || '')}</div>
                  </div>
                  <div style="flex:1;">
                    <strong style="font-size:11px;">Date :</strong>
                    <div style="border-bottom:1px solid #000; height:15px;"></div>
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td colspan="3" style="padding:10px;">
                <div><strong style="font-size:11px;">Taka (In words) :</strong></div>
                <div style="font-size:13px; font-weight:bold; margin-top:5px;">${this.numberToBanglaWords(total)}</div>
              </td>
            </tr>
            <tr>
              <td class="total-label">Total</td>
              <td class="taka-col total-amount">${this.formatAmount(total)}</td>
              <td class="ps-col"></td>
            </tr>
          </tbody>
        </table>

        <div class="footer-signatures">
          <div class="sig-item"><div class="sig-line"></div></div>
          <div class="sig-item"><div class="sig-line"></div></div>
          <div class="sig-item"><div class="sig-line"></div></div>
          <div class="sig-item"><div class="sig-line"></div></div>
          <div class="sig-item"><div class="sig-line"></div></div>
        </div>
      </div>
    `;
  }

  formatAmount(amount) {
    const value = parseFloat(amount) || 0;
    return value.toLocaleString('bn-BD', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  getDateParts(dateStr) {
    if (!dateStr) {
      return { day: '', month: '', year: '' };
    }

    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) {
      return { day: '', month: '', year: '' };
    }

    return {
      day: this.toBanglaDigits(String(d.getDate()).padStart(2, '0')),
      month: this.toBanglaDigits(String(d.getMonth() + 1).padStart(2, '0')),
      year: this.toBanglaDigits(String(d.getFullYear()))
    };
  }

  toBanglaDigits(value) {
    return String(value).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);
  }

  buildVoucherTextOnlyPrintHTML(voucher) {
    const rows = this.parseVoucherRows(voucher);
    const total = rows.reduce((sum, row) => sum + (row.amount || 0), 0) || (parseFloat(voucher.amount) || 0);
    const dateParts = this.getDateParts(voucher.date);
    const calibration = this.getPrintCalibrationSettings();
    const userSettings = this.getUserSettings();

    const baseTopRows = [7.11, 7.76, 8.41, 9.06, 9.71];
    const calibratedTopRows = baseTopRows.map((top, idx) => (top + calibration.offsetYCm + (calibration.lineGapCm * idx)).toFixed(2));

    const leftBasePart = (0.8 + calibration.offsetXCm).toFixed(2);
    const leftBaseAmount = (15.65 + calibration.offsetXCm).toFixed(2);

    return `
      <div class="print-sheet">
        <div class="pf pf-code">${this.escapeHtml(voucher.codeNo || '')}</div>
        <div class="pf pf-vno">${this.escapeHtml(voucher.voucherNo || '')}</div>

        <div class="pf pf-date-day">${dateParts.day}</div>
        <div class="pf pf-date-month">${dateParts.month}</div>
        <div class="pf pf-date-year">${dateParts.year}</div>

        <div class="pf pf-payto">${this.escapeHtml(voucher.payTo || '')}</div>
        <div class="pf pf-control">${this.escapeHtml(voucher.controlAc || '')}</div>

        <style>
          .print-sheet { font-size: ${calibration.fontSizePx}px; }
          .pf-part { left: ${leftBasePart}cm; width: 14.7cm; }
          .pf-amt { left: ${leftBaseAmount}cm; width: 3.95cm; text-align: right; }
          .p1, .a1 { top: ${calibratedTopRows[0]}cm; }
          .p2, .a2 { top: ${calibratedTopRows[1]}cm; }
          .p3, .a3 { top: ${calibratedTopRows[2]}cm; }
          .p4, .a4 { top: ${calibratedTopRows[3]}cm; }
          .p5, .a5 { top: ${calibratedTopRows[4]}cm; }
        </style>

        ${rows.map((row, idx) => `
          <div class="pf pf-part p${idx + 1}">${this.escapeHtml(row.text)}</div>
          <div class="pf pf-amt a${idx + 1}">${row.amount > 0 ? this.formatAmount(row.amount) : ''}</div>
        `).join('')}

        <div class="pf pf-paymethod">${this.escapeHtml(voucher.paymentMethod || '')}</div>
        <div class="pf pf-account">${this.escapeHtml(voucher.accountNo || '')}</div>

        <div class="pf pf-words">${this.numberToBanglaWords(total)}</div>
        <div class="pf pf-total">${this.formatAmount(total)}</div>

        ${userSettings.officers.show ? `
          <div class="pf pf-officer o1">${this.escapeHtml(userSettings.officers.acknowledged || '')}</div>
          <div class="pf pf-officer o2">${this.escapeHtml(userSettings.officers.prepared || '')}</div>
          <div class="pf pf-officer o3">${this.escapeHtml(userSettings.officers.verified || '')}</div>
          <div class="pf pf-officer o4">${this.escapeHtml(userSettings.officers.recommended || '')}</div>
          <div class="pf pf-officer o5">${this.escapeHtml(userSettings.officers.approved || '')}</div>
        ` : ''}
      </div>
    `;
  }

  printVoucher(voucher) {
    const printWindow = window.open('', '', 'width=900,height=700');
    const html = this.generatePrintHTML(voucher);
    printWindow.document.write(html);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  generatePrintHTML(voucher) {
    const printOverlayHTML = this.buildVoucherTextOnlyPrintHTML(voucher);
    return `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@400;700&display=swap" rel="stylesheet">
  <style>
    @page { size: 21.1cm 14.35cm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { width: 21.1cm; height: 14.35cm; margin: 0; padding: 0; background: transparent; overflow: hidden; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }

    /* Text-only overlay for pre-printed form paper */
    .print-sheet {
      position: relative;
      width: 21.1cm;
      height: 14.35cm;
      font-family: 'Noto Serif Bengali', serif;
      color: #000;
      font-size: 11px;
      line-height: 1;
    }

    .pf {
      position: absolute;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .pf-code { left: 2.0cm; top: 4.35cm; width: 2.3cm; }
    .pf-vno { left: 18.15cm; top: 3.95cm; width: 2.1cm; text-align: center; }

    .pf-date-day { left: 18.0cm; top: 4.62cm; width: 0.8cm; text-align: center; }
    .pf-date-month { left: 18.85cm; top: 4.62cm; width: 0.8cm; text-align: center; }
    .pf-date-year { left: 19.75cm; top: 4.62cm; width: 1.2cm; text-align: center; }

    .pf-payto { left: 1.2cm; top: 5.20cm; width: 15.8cm; }
    .pf-control { left: 12.9cm; top: 6.03cm; width: 8.0cm; }

    .pf-part { left: 0.8cm; width: 14.7cm; }
    .pf-amt { left: 15.65cm; width: 3.95cm; text-align: right; }

    .p1, .a1 { top: 7.11cm; }
    .p2, .a2 { top: 7.76cm; }
    .p3, .a3 { top: 8.41cm; }
    .p4, .a4 { top: 9.06cm; }
    .p5, .a5 { top: 9.71cm; }

    .pf-paymethod { left: 0.95cm; top: 10.42cm; width: 6.1cm; }
    .pf-account { left: 8.35cm; top: 10.42cm; width: 4.1cm; }

    .pf-words { left: 1.1cm; top: 11.32cm; width: 14.45cm; white-space: normal; line-height: 1.1; }
    .pf-total { left: 15.65cm; top: 11.99cm; width: 3.95cm; text-align: right; font-weight: 700; }

    .pf-officer { width: 3.7cm; text-align: center; font-size: 10px; }
    .o1 { left: 0.65cm; top: 13.9cm; }
    .o2 { left: 4.7cm; top: 13.9cm; }
    .o3 { left: 8.7cm; top: 13.9cm; }
    .o4 { left: 12.7cm; top: 13.9cm; }
    .o5 { left: 16.7cm; top: 13.9cm; }
  </style>
</head>
<body>
  ${printOverlayHTML}
</body>
</html>
    `;
  }

  async loadVoucherHistory() {
    try {
      const response = await fetch(`${this.apiBase}/api/voucher/all`);
      const data = await response.json();

      this.voucherHistory = data.vouchers || [];
      this.displayVoucherHistory();
      this.loadReports();
    } catch (error) {
      console.error('Load history error:', error);
    }
  }

  displayVoucherHistory() {
    const settings = this.getUserSettings();
    const query = this.historyFilter.trim().toLowerCase();
    const filteredVouchers = this.voucherHistory.filter((v) => {
      if (!query) return true;
      const text = `${v.voucher_no || ''} ${v.pay_to || ''} ${v.control_ac || ''} ${v.code_no || ''}`.toLowerCase();
      return text.includes(query);
    });

    const historyHTML = `
      <h2>ভাউচার ইতিহাস</h2>
      <div class="history-toolbar">
        <input type="text" id="historySearch" class="history-search" placeholder="নম্বর/নাম দিয়ে খুঁজুন..." value="${this.escapeHtml(this.historyFilter)}" oninput="app.setHistoryFilter(this.value)">
        <button class="btn-secondary" onclick="app.exportVouchersCSV()">CSV Export</button>
        <button class="btn-secondary" onclick="app.exportVouchersJSON()">JSON Export</button>
      </div>
      <table class="history-table">
        <thead>
          <tr>
            <th>তারিখ</th>
            <th>নম্বর</th>
            <th>যাকে দিতে হবে</th>
            <th>পরিমাণ</th>
            <th>অবস্থা</th>
            <th>অ্যাকশন</th>
          </tr>
        </thead>
        <tbody>
          ${filteredVouchers.map(v => `
            <tr>
              <td>${v.date}</td>
              <td>${v.voucher_no}</td>
              <td>${v.pay_to}</td>
              <td>${this.formatAmount(v.amount)}</td>
              <td><span class="status-badge ${this.getWorkflowStatus(v).className}">${this.getWorkflowStatus(v).label}</span></td>
              <td>
                <button onclick="app.viewVoucher('${v.id}')" class="btn-small">দেখুন</button>
                ${settings.publicUrl.enabled && settings.publicUrl.showShareButtons ? `<button onclick="app.shareVoucher('${v.public_id}')" class="btn-small">শেয়ার</button>` : ''}
                ${settings.publicUrl.enabled && settings.publicUrl.showVerifyLink ? `<button onclick="app.copyVerifyLink('${v.public_id}')" class="btn-small">Verify Link</button>` : ''}
                ${this.renderWorkflowActionButtons(v)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    document.getElementById('voucherHistory').innerHTML = historyHTML;
  }

  async loadReports() {
    document.getElementById('reports').innerHTML = `
      <h2>রিপোর্ট</h2>
      <div class="report-section">
        <h3>এই মাসের সারাংশ</h3>
        <div id="monthlyStats"></div>
      </div>
      <div class="report-section">
        <h3>প্রতিটি সপ্তাহ</h3>
        <div id="weeklyStats"></div>
      </div>
      <div class="report-section">
        <h3>ব্যাংক রিকনসিলিয়েশন</h3>
        <div id="bankReconciliation"></div>
      </div>
    `;

    try {
      // Load stats from DB
      const stats = await this.getUserStats();
      const weekly = this.getWeeklyStats(this.voucherHistory);
      const budget = this.getBudgetSettings();
      const monthSpent = this.getCurrentMonthSpent();
      const remaining = budget.monthlyLimit > 0 ? (budget.monthlyLimit - monthSpent) : 0;
      document.getElementById('monthlyStats').innerHTML = `
        <p>মোট ভাউচার: ${stats.total || 0}</p>
        <p>মোট পরিমাণ: ${(stats.total_amount || 0).toLocaleString('bn-BD')} টাকা</p>
        <p>এই মাসে খরচ: ${this.formatAmount(monthSpent)} টাকা</p>
        <p>মাসিক বাজেট: ${budget.monthlyLimit > 0 ? this.formatAmount(budget.monthlyLimit) : 'সেট করা নেই'} </p>
        <p>বাজেট অবশিষ্ট: ${budget.monthlyLimit > 0 ? this.formatAmount(remaining) : 'N/A'} </p>
      `;

      document.getElementById('weeklyStats').innerHTML = weekly.length
        ? weekly.map((w) => `<p>${w.label}: ${w.count} টি, ${this.formatAmount(w.total)} টাকা</p>`).join('')
        : '<p>কোন ডাটা নেই</p>';

      document.getElementById('bankReconciliation').innerHTML = this.renderBankReconciliation();
    } catch (error) {
      console.error('Load reports error:', error);
    }
  }

  async loadSettings() {
    const userSettings = this.getUserSettings();
    document.getElementById('settings').innerHTML = `
      <h2>সেটিংস</h2>
      <div class="settings-section">
        <h3>প্রোফাইল</h3>
        <p>নাম: ${this.user.name}</p>
        <p>ইমেইল: ${this.user.email}</p>
        <p>ভূমিকা: ${this.user.role}</p>
      </div>
      <div class="settings-section">
        <h3>ভাউচার নাম্বার সেটিংস</h3>
        <div class="calibration-grid">
          <label>Mode
            <select id="setVoucherMode">
              <option value="auto" ${userSettings.voucherNo.mode === 'auto' ? 'selected' : ''}>Auto</option>
              <option value="manual" ${userSettings.voucherNo.mode === 'manual' ? 'selected' : ''}>Manual</option>
            </select>
          </label>
          <label>Format
            <input type="text" id="setVoucherFormat" value="${this.escapeHtml(userSettings.voucherNo.format)}">
          </label>
          <label>Start Number
            <input type="number" id="setVoucherStart" min="1" value="${userSettings.voucherNo.start}">
          </label>
          <label>Sequential
            <select id="setVoucherSequential">
              <option value="yes" ${userSettings.voucherNo.sequential ? 'selected' : ''}>Yes</option>
              <option value="no" ${!userSettings.voucherNo.sequential ? 'selected' : ''}>No</option>
            </select>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h3>কোড সেটিংস</h3>
        <div class="calibration-grid">
          <label>Mode
            <select id="setCodeMode">
              <option value="auto" ${userSettings.code.mode === 'auto' ? 'selected' : ''}>Auto</option>
              <option value="manual" ${userSettings.code.mode === 'manual' ? 'selected' : ''}>Manual</option>
            </select>
          </label>
          <label>Format
            <input type="text" id="setCodeFormat" value="${this.escapeHtml(userSettings.code.format)}">
          </label>
          <label>Start Number
            <input type="number" id="setCodeStart" min="1" value="${userSettings.code.start}">
          </label>
          <label>Sequential
            <select id="setCodeSequential">
              <option value="yes" ${userSettings.code.sequential ? 'selected' : ''}>Yes</option>
              <option value="no" ${!userSettings.code.sequential ? 'selected' : ''}>No</option>
            </select>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h3>ডিপো ও অ্যাকাউন্ট সেটিংস</h3>
        <div class="calibration-grid">
          <label>ডিপোর নাম
            <input type="text" id="setDepotName" value="${this.escapeHtml(userSettings.depotName || '')}">
          </label>
          <label>Head of Accounts Input
            <select id="setHeadInputType">
              <option value="dropdown" ${userSettings.headOfAccounts.inputType === 'dropdown' ? 'selected' : ''}>Dropdown</option>
              <option value="manual" ${userSettings.headOfAccounts.inputType === 'manual' ? 'selected' : ''}>Manual</option>
            </select>
          </label>
          <label>Head of Accounts List (comma)
            <input type="text" id="setHeadOptions" value="${this.escapeHtml((userSettings.headOfAccounts.options || []).join(', '))}">
          </label>
          <label>Head Default
            <input type="text" id="setHeadDefault" value="${this.escapeHtml(userSettings.headOfAccounts.defaultValue || '')}">
          </label>
          <label>Control A/C Mode
            <select id="setControlMode">
              <option value="auto" ${userSettings.controlAccount.mode === 'auto' ? 'selected' : ''}>Auto</option>
              <option value="manual" ${userSettings.controlAccount.mode === 'manual' ? 'selected' : ''}>Manual</option>
            </select>
          </label>
          <label>Control A/C Default
            <input type="text" id="setControlDefault" value="${this.escapeHtml(userSettings.controlAccount.defaultValue || '')}">
          </label>
          <label>Control A/C List (comma)
            <input type="text" id="setControlOptions" value="${this.escapeHtml((userSettings.controlAccount.options || []).join(', '))}">
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h3>QR ও Public URL সেটিংস</h3>
        <div class="calibration-grid">
          <label>QR Show
            <select id="setQrEnabled">
              <option value="yes" ${userSettings.qr.enabled ? 'selected' : ''}>Yes</option>
              <option value="no" ${!userSettings.qr.enabled ? 'selected' : ''}>No</option>
            </select>
          </label>
          <label>QR Size (px)
            <input type="number" id="setQrSize" min="40" max="180" value="${userSettings.qr.size}">
          </label>
          <label>QR X Offset (px)
            <input type="number" id="setQrX" value="${userSettings.qr.x}">
          </label>
          <label>QR Y Offset (px)
            <input type="number" id="setQrY" value="${userSettings.qr.y}">
          </label>
          <label>Public URL Enable
            <select id="setPublicUrlEnabled">
              <option value="yes" ${userSettings.publicUrl.enabled ? 'selected' : ''}>Yes</option>
              <option value="no" ${!userSettings.publicUrl.enabled ? 'selected' : ''}>No</option>
            </select>
          </label>
          <label>Share Buttons Show
            <select id="setPublicShareShow">
              <option value="yes" ${userSettings.publicUrl.showShareButtons ? 'selected' : ''}>Yes</option>
              <option value="no" ${!userSettings.publicUrl.showShareButtons ? 'selected' : ''}>No</option>
            </select>
          </label>
          <label>Verify Link Show
            <select id="setPublicVerifyShow">
              <option value="yes" ${userSettings.publicUrl.showVerifyLink ? 'selected' : ''}>Yes</option>
              <option value="no" ${!userSettings.publicUrl.showVerifyLink ? 'selected' : ''}>No</option>
            </select>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h3>কর্মকর্তার নাম ও শো অপশন</h3>
        <div class="calibration-grid">
          <label>Show Names
            <select id="setOfficerShow">
              <option value="yes" ${userSettings.officers.show ? 'selected' : ''}>Yes</option>
              <option value="no" ${!userSettings.officers.show ? 'selected' : ''}>No</option>
            </select>
          </label>
          <label>Acknowledged by
            <input type="text" id="setOfficerAcknowledged" value="${this.escapeHtml(userSettings.officers.acknowledged || '')}">
          </label>
          <label>Prepared by
            <input type="text" id="setOfficerPrepared" value="${this.escapeHtml(userSettings.officers.prepared || '')}">
          </label>
          <label>Verified by
            <input type="text" id="setOfficerVerified" value="${this.escapeHtml(userSettings.officers.verified || '')}">
          </label>
          <label>Recommended by
            <input type="text" id="setOfficerRecommended" value="${this.escapeHtml(userSettings.officers.recommended || '')}">
          </label>
          <label>Approved by
            <input type="text" id="setOfficerApproved" value="${this.escapeHtml(userSettings.officers.approved || '')}">
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h3>প্রিন্ট ক্যালিব্রেশন</h3>
        <div class="calibration-grid">
          <label>Horizontal Offset (cm)
            <input type="number" id="calOffsetX" step="0.01" value="0">
          </label>
          <label>Vertical Offset (cm)
            <input type="number" id="calOffsetY" step="0.01" value="0">
          </label>
          <label>Line Gap Increment (cm)
            <input type="number" id="calLineGap" step="0.01" value="0">
          </label>
          <label>Print Font Size (px)
            <input type="number" id="calFontSize" step="1" min="9" max="16" value="11">
          </label>
        </div>
        <div class="form-actions">
          <button class="btn-primary" onclick="app.savePrintCalibration()">ক্যালিব্রেশন সেভ</button>
          <button class="btn-secondary" onclick="app.resetPrintCalibration()">রিসেট</button>
        </div>
      </div>
      <div class="settings-section">
        <h3>বাজেট নিয়ন্ত্রণ</h3>
        <div class="calibration-grid">
          <label>মাসিক বাজেট সীমা (টাকা)
            <input type="number" id="monthlyBudgetLimit" min="0" step="0.01" value="0">
          </label>
        </div>
        <div class="form-actions">
          <button class="btn-primary" onclick="app.saveBudgetSettings()">বাজেট সেভ</button>
        </div>
      </div>
      <div class="settings-section" id="trialInfo"></div>
      <div class="form-actions">
        <button class="btn-primary" onclick="app.saveAdvancedUserSettings()">সব সেটিংস সেভ</button>
        <button class="btn-secondary" onclick="app.resetAdvancedUserSettings()">ডিফল্ট রিসেট</button>
      </div>
    `;

    this.populatePrintCalibration();
    this.populateBudgetSettings();

    if (this.user.trialEnd) {
      const daysLeft = this.getDaysRemaining(this.user.trialEnd);
      document.getElementById('trialInfo').innerHTML = `
        <h3>ট্রায়াল তথ্য</h3>
        <p>বাকি দিন: ${daysLeft}</p>
        <p>শেষ: ${new Date(this.user.trialEnd).toLocaleDateString('bn-BD')}</p>
      `;
    }
  }

  getDaysRemaining(dateString) {
    const end = new Date(dateString);
    const now = new Date();
    const diff = end - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  async getUserStats() {
    try {
      const response = await fetch(`${this.apiBase}/api/voucher/all?limit=1000`);
      if (!response.ok) return { total: 0, total_amount: 0 };

      const data = await response.json();
      const vouchers = data.vouchers || [];
      const totalAmount = vouchers.reduce((sum, v) => {
        const raw = v.amount ?? v.amount_value ?? 0;
        return sum + (parseFloat(raw) || 0);
      }, 0);

      return {
        total: vouchers.length,
        total_amount: totalAmount
      };
    } catch (error) {
      console.error('Get stats error:', error);
      return { total: 0, total_amount: 0 };
    }
  }

  getWeeklyStats(vouchers) {
    const weekMap = new Map();

    vouchers.forEach((v) => {
      const d = new Date(v.date);
      if (Number.isNaN(d.getTime())) return;

      const day = d.getDay();
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const key = monday.toISOString().slice(0, 10);
      if (!weekMap.has(key)) {
        weekMap.set(key, { count: 0, total: 0, start: new Date(monday) });
      }

      const item = weekMap.get(key);
      item.count += 1;
      item.total += parseFloat(v.amount) || 0;
    });

    return Array.from(weekMap.values())
      .sort((a, b) => b.start - a.start)
      .slice(0, 6)
      .map((w) => {
        const end = new Date(w.start);
        end.setDate(end.getDate() + 6);
        const label = `${w.start.toLocaleDateString('bn-BD')} - ${end.toLocaleDateString('bn-BD')}`;
        return { label, count: w.count, total: w.total };
      });
  }

  async viewVoucher(id) {
    try {
      const response = await fetch(`${this.apiBase}/api/voucher/${id}`);
      const data = await response.json();
      this.currentVoucher = data.voucher;
      this.showVoucherPreview(data.voucher);
      this.switchTab('voucher');
    } catch (error) {
      console.error('View voucher error:', error);
    }
  }

  async shareVoucher(publicId) {
    const url = `${window.location.origin}/v/${publicId}`;
    await navigator.clipboard.writeText(url);
    this.showMessage('লিঙ্ক কপি হয়েছে!');
  }

  async copyLink(publicId) {
    const url = `${window.location.origin}/v/${publicId}`;
    await navigator.clipboard.writeText(url);
    this.showMessage('লিঙ্ক কপি হয়েছে!');
  }

  setHistoryFilter(value) {
    this.historyFilter = value || '';
    this.displayVoucherHistory();
  }

  getWorkflowStatus(voucher) {
    if (voucher.approved_by) return { label: 'অনুমোদিত', className: 'approved' };
    if (voucher.recommended_by) return { label: 'সুপারিশকৃত', className: 'recommended' };
    if (voucher.verified_by) return { label: 'যাচাইকৃত', className: 'verified' };
    if (voucher.prepared_by) return { label: 'প্রস্তুত', className: 'prepared' };
    return { label: 'ড্রাফট', className: 'draft' };
  }

  async updateVoucherWorkflow(voucherId, stage) {
    try {
      if (!this.isStageAllowedForRole(stage)) {
        this.showError('এই ধাপের অনুমতি আপনার নেই');
        return;
      }

      const actor = this.user?.name || this.user?.email || 'User';
      const response = await fetch(`${this.apiBase}/api/voucher/workflow/${voucherId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, actor })
      });

      const data = await response.json();
      if (!response.ok) {
        this.showError(data.error || 'Workflow update failed');
        return;
      }

      this.showMessage('Workflow update সফল হয়েছে');
      this.loadVoucherHistory();
    } catch (error) {
      console.error('Workflow update error:', error);
      this.showError('Workflow update ব্যর্থ হয়েছে');
    }
  }

  isStageAllowedForRole(stage) {
    const role = this.user?.role || 'user';
    const map = {
      user: ['prepared'],
      admin: ['prepared', 'verified', 'recommended'],
      super_admin: ['prepared', 'verified', 'recommended', 'approved']
    };
    return (map[role] || []).includes(stage);
  }

  renderWorkflowActionButtons(voucher) {
    const actions = [
      { stage: 'prepared', label: 'প্রস্তুত', requires: null },
      { stage: 'verified', label: 'যাচাই', requires: 'prepared_by' },
      { stage: 'recommended', label: 'সুপারিশ', requires: 'verified_by' },
      { stage: 'approved', label: 'অনুমোদন', requires: 'recommended_by' }
    ];

    return actions
      .filter((a) => this.isStageAllowedForRole(a.stage))
      .filter((a) => !a.requires || voucher[a.requires])
      .map((a) => `<button onclick="app.updateVoucherWorkflow('${voucher.id}', '${a.stage}')" class="btn-small">${a.label}</button>`)
      .join('');
  }

  async copyVerifyLink(publicId) {
    const url = `${window.location.origin}/api/voucher/verify/${publicId}`;
    await navigator.clipboard.writeText(url);
    this.showMessage('Verification link কপি হয়েছে');
  }

  getReconciliationMap() {
    try {
      return JSON.parse(localStorage.getItem('bankReconciliationMap') || '{}');
    } catch {
      return {};
    }
  }

  saveReconciliationMap(map) {
    localStorage.setItem('bankReconciliationMap', JSON.stringify(map));
  }

  renderBankReconciliation() {
    const reconMap = this.getReconciliationMap();
    const list = this.voucherHistory.filter((v) => ['চেক', 'ট্রান্সফার'].includes(v.payment_method || v.paymentMethod || ''));

    if (!list.length) {
      return '<p>ব্যাংক পেমেন্ট ডাটা নেই</p>';
    }

    return `
      <table class="history-table">
        <thead>
          <tr>
            <th>ভাউচার</th>
            <th>পে-টু</th>
            <th>পদ্ধতি</th>
            <th>টাকা</th>
            <th>রিকন স্ট্যাটাস</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((v) => {
            const status = reconMap[v.id] || 'pending';
            return `
              <tr>
                <td>${v.voucher_no}</td>
                <td>${v.pay_to}</td>
                <td>${v.payment_method || ''}</td>
                <td>${this.formatAmount(v.amount)}</td>
                <td>
                  <select onchange="app.setVoucherReconciliationStatus('${v.id}', this.value)">
                    <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="cleared" ${status === 'cleared' ? 'selected' : ''}>Cleared</option>
                    <option value="failed" ${status === 'failed' ? 'selected' : ''}>Failed</option>
                  </select>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  setVoucherReconciliationStatus(voucherId, status) {
    const map = this.getReconciliationMap();
    map[voucherId] = status;
    this.saveReconciliationMap(map);
    this.showMessage('রিকনসিলিয়েশন স্ট্যাটাস আপডেট হয়েছে');
  }

  getBudgetSettings() {
    try {
      return JSON.parse(localStorage.getItem('budgetSettings') || '{"monthlyLimit":0}');
    } catch {
      return { monthlyLimit: 0 };
    }
  }

  getCurrentMonthSpent() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return this.voucherHistory
      .filter((v) => {
        const d = new Date(v.date);
        return !Number.isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() === m;
      })
      .reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);
  }

  populateBudgetSettings() {
    const settings = this.getBudgetSettings();
    const el = document.getElementById('monthlyBudgetLimit');
    if (el) {
      el.value = settings.monthlyLimit || 0;
    }
  }

  saveBudgetSettings() {
    const monthlyLimit = parseFloat(document.getElementById('monthlyBudgetLimit')?.value || '0') || 0;
    localStorage.setItem('budgetSettings', JSON.stringify({ monthlyLimit }));
    this.showMessage('বাজেট সেটিংস সংরক্ষণ হয়েছে');
    this.loadReports();
  }

  downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportVouchersCSV() {
    const headers = ['date', 'voucher_no', 'pay_to', 'control_ac', 'amount', 'prepared_by', 'verified_by', 'recommended_by', 'approved_by'];
    const lines = [headers.join(',')];

    this.voucherHistory.forEach((v) => {
      const row = headers.map((key) => {
        const value = String(v[key] ?? '').replace(/"/g, '""');
        return `"${value}"`;
      });
      lines.push(row.join(','));
    });

    this.downloadTextFile(`vouchers-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
  }

  exportVouchersJSON() {
    this.downloadTextFile(`vouchers-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(this.voucherHistory, null, 2), 'application/json;charset=utf-8');
  }

  getPrintCalibrationSettings() {
    const defaults = { offsetXCm: 0, offsetYCm: 0, lineGapCm: 0, fontSizePx: 11 };
    try {
      const raw = localStorage.getItem('printCalibrationSettings');
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return {
        offsetXCm: Number(parsed.offsetXCm) || 0,
        offsetYCm: Number(parsed.offsetYCm) || 0,
        lineGapCm: Number(parsed.lineGapCm) || 0,
        fontSizePx: Number(parsed.fontSizePx) || 11
      };
    } catch {
      return defaults;
    }
  }

  populatePrintCalibration() {
    const settings = this.getPrintCalibrationSettings();
    const fields = {
      calOffsetX: settings.offsetXCm,
      calOffsetY: settings.offsetYCm,
      calLineGap: settings.lineGapCm,
      calFontSize: settings.fontSizePx
    };

    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });
  }

  savePrintCalibration() {
    const settings = {
      offsetXCm: parseFloat(document.getElementById('calOffsetX')?.value || '0') || 0,
      offsetYCm: parseFloat(document.getElementById('calOffsetY')?.value || '0') || 0,
      lineGapCm: parseFloat(document.getElementById('calLineGap')?.value || '0') || 0,
      fontSizePx: parseFloat(document.getElementById('calFontSize')?.value || '11') || 11
    };
    localStorage.setItem('printCalibrationSettings', JSON.stringify(settings));
    this.showMessage('প্রিন্ট ক্যালিব্রেশন সংরক্ষণ করা হয়েছে');
  }

  resetPrintCalibration() {
    localStorage.removeItem('printCalibrationSettings');
    this.populatePrintCalibration();
    this.showMessage('ক্যালিব্রেশন রিসেট হয়েছে');
  }

  getVoucherTemplates() {
    try {
      return JSON.parse(localStorage.getItem('voucherTemplates') || '[]');
    } catch {
      return [];
    }
  }

  saveVoucherTemplates(templates) {
    localStorage.setItem('voucherTemplates', JSON.stringify(templates));
  }

  renderTemplateOptions() {
    const select = document.getElementById('voucherTemplateSelect');
    if (!select) return;

    const templates = this.getVoucherTemplates();
    select.innerHTML = '<option value="">টেমপ্লেট নির্বাচন করুন</option>' + templates.map((t) => (
      `<option value="${this.escapeHtml(t.id)}">${this.escapeHtml(t.name)}</option>`
    )).join('');
  }

  saveCurrentTemplate() {
    const name = prompt('টেমপ্লেটের নাম দিন');
    if (!name) return;

    const template = {
      id: `tpl-${Date.now()}`,
      name: name.trim(),
      payTo: document.getElementById('payTo')?.value || '',
      codeNo: document.getElementById('codeNo')?.value || '',
      controlAc: document.getElementById('controlAc')?.value || '',
      accountNo: document.getElementById('accountNo')?.value || '',
      paymentMethod: document.getElementById('paymentMethod')?.value || '',
      particulars: [1, 2, 3, 4, 5].map((i) => ({
        text: document.getElementById(`particular${i}`)?.value || '',
        amount: document.getElementById(`particularAmount${i}`)?.value || ''
      }))
    };

    const templates = this.getVoucherTemplates();
    templates.push(template);
    this.saveVoucherTemplates(templates);
    this.renderTemplateOptions();
    this.showMessage('টেমপ্লেট সংরক্ষণ হয়েছে');
  }

  saveAdvancedUserSettings() {
    const settings = this.getUserSettings();

    settings.voucherNo.mode = document.getElementById('setVoucherMode')?.value || settings.voucherNo.mode;
    settings.voucherNo.format = document.getElementById('setVoucherFormat')?.value || settings.voucherNo.format;
    settings.voucherNo.start = parseInt(document.getElementById('setVoucherStart')?.value || String(settings.voucherNo.start), 10) || settings.voucherNo.start;
    settings.voucherNo.sequential = (document.getElementById('setVoucherSequential')?.value || 'yes') === 'yes';

    settings.code.mode = document.getElementById('setCodeMode')?.value || settings.code.mode;
    settings.code.format = document.getElementById('setCodeFormat')?.value || settings.code.format;
    settings.code.start = parseInt(document.getElementById('setCodeStart')?.value || String(settings.code.start), 10) || settings.code.start;
    settings.code.sequential = (document.getElementById('setCodeSequential')?.value || 'yes') === 'yes';

    settings.depotName = document.getElementById('setDepotName')?.value || settings.depotName;

    settings.headOfAccounts.inputType = document.getElementById('setHeadInputType')?.value || settings.headOfAccounts.inputType;
    settings.headOfAccounts.options = String(document.getElementById('setHeadOptions')?.value || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    settings.headOfAccounts.defaultValue = document.getElementById('setHeadDefault')?.value || '';

    settings.controlAccount.mode = document.getElementById('setControlMode')?.value || settings.controlAccount.mode;
    settings.controlAccount.defaultValue = document.getElementById('setControlDefault')?.value || '';
    settings.controlAccount.options = String(document.getElementById('setControlOptions')?.value || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    settings.qr.enabled = (document.getElementById('setQrEnabled')?.value || 'yes') === 'yes';
    settings.qr.size = parseInt(document.getElementById('setQrSize')?.value || String(settings.qr.size), 10) || settings.qr.size;
    settings.qr.x = parseInt(document.getElementById('setQrX')?.value || String(settings.qr.x), 10) || 0;
    settings.qr.y = parseInt(document.getElementById('setQrY')?.value || String(settings.qr.y), 10) || 0;

    settings.publicUrl.enabled = (document.getElementById('setPublicUrlEnabled')?.value || 'yes') === 'yes';
    settings.publicUrl.showShareButtons = (document.getElementById('setPublicShareShow')?.value || 'yes') === 'yes';
    settings.publicUrl.showVerifyLink = (document.getElementById('setPublicVerifyShow')?.value || 'yes') === 'yes';

    settings.officers.show = (document.getElementById('setOfficerShow')?.value || 'no') === 'yes';
    settings.officers.acknowledged = document.getElementById('setOfficerAcknowledged')?.value || '';
    settings.officers.prepared = document.getElementById('setOfficerPrepared')?.value || '';
    settings.officers.verified = document.getElementById('setOfficerVerified')?.value || '';
    settings.officers.recommended = document.getElementById('setOfficerRecommended')?.value || '';
    settings.officers.approved = document.getElementById('setOfficerApproved')?.value || '';

    this.saveUserSettings(settings);
    this.showMessage('ইউজার সেটিংস সংরক্ষণ হয়েছে');
    this.initVoucherForm();
    this.loadVoucherHistory();
  }

  resetAdvancedUserSettings() {
    localStorage.removeItem('userConfigSettings');
    this.showMessage('ইউজার সেটিংস ডিফল্টে রিসেট হয়েছে');
    this.loadSettings();
    this.initVoucherForm();
  }

  applySelectedTemplate() {
    const select = document.getElementById('voucherTemplateSelect');
    if (!select || !select.value) return;

    const templates = this.getVoucherTemplates();
    const template = templates.find((t) => t.id === select.value);
    if (!template) return;

    document.getElementById('payTo').value = template.payTo || '';
    document.getElementById('codeNo').value = template.codeNo || '';
    document.getElementById('controlAc').value = template.controlAc || '';
    document.getElementById('accountNo').value = template.accountNo || '';
    document.getElementById('paymentMethod').value = template.paymentMethod || '';

    (template.particulars || []).forEach((row, idx) => {
      const i = idx + 1;
      const textEl = document.getElementById(`particular${i}`);
      const amountEl = document.getElementById(`particularAmount${i}`);
      if (textEl) textEl.value = row.text || '';
      if (amountEl) amountEl.value = row.amount || '';
    });

    this.updateParticularsTotal();
    this.showMessage('টেমপ্লেট লোড হয়েছে');
  }

  autoIncrementVoucher() {
    const settings = this.getUserSettings();
    const serial = this.getNextSerialValue('voucher');
    const voucherNo = this.formatSerialByPattern(settings.voucherNo.format, serial, new Date());
    document.getElementById('voucherNo').value = voucherNo;
  }

  setToday() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
  }

  clearForm() {
    document.getElementById('voucherEntryForm').reset();
    this.setToday();
    this.updateParticularsTotal();
  }

  switchTab(tabName, clickedButton = null) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-tabs button').forEach(btn => btn.classList.remove('active'));

    const content = document.getElementById(tabName + 'Tab');
    if (content) {
      content.classList.add('active');
    }

    const button = clickedButton || document.querySelector(`.nav-tabs button[onclick*="'${tabName}'"]`);
    if (button) {
      button.classList.add('active');
    }
  }

  showError(message) {
    this.showNotification('ত্রুটি', message, 'error');
  }

  showMessage(message) {
    this.showNotification('সফল', message, 'success');
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    };
    return text.replace(/[&<>"]/g, m => map[m]);
  }

  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }
}

// Handle Google login
function setAuthLoading(method, isLoading) {
  const googleBtn = document.getElementById('googleLoginBtn');
  const localBtn = document.getElementById('localLoginBtn');
  const loading = document.getElementById('authLoading');
  const loadingText = document.getElementById('authLoadingText');

  if (isLoading) {
    if (googleBtn) googleBtn.disabled = true;
    if (localBtn) localBtn.disabled = true;
    if (loadingText) {
      loadingText.textContent = method === 'google'
        ? 'Google লগইন পেজে পাঠানো হচ্ছে...'
        : 'আপনার তথ্য যাচাই করা হচ্ছে...';
    }
    if (loading) loading.style.display = 'block';
    return;
  }

  if (googleBtn) googleBtn.disabled = false;
  if (localBtn) localBtn.disabled = false;
  if (loading) loading.style.display = 'none';
}

function handleGoogleLogin() {
  setAuthLoading('google', true);

  // Keep auth flow on the same domain so session cookie is available to the app.
  window.location.href = '/auth/login';
}

// Handle local login with ID/password
async function handleLocalLogin() {
  const loginIdInput = document.getElementById('localLoginId');
  const passwordInput = document.getElementById('localLoginPassword');

  const loginId = (loginIdInput?.value || '').trim();
  const password = passwordInput?.value || '';

  if (!loginId || !password) {
    if (window.app) {
      window.app.showError('লগইন আইডি এবং পাসওয়ার্ড দিন।');
    }
    return;
  }

  setAuthLoading('local', true);

  try {
    const response = await fetch('/auth/local-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'লগইন ব্যর্থ হয়েছে।');
    }

    window.location.href = result.redirectTo || '/dashboard';
  } catch (error) {
    if (window.app) {
      window.app.showError(error.message || 'লগইন ব্যর্থ হয়েছে।');
    }
    setAuthLoading('local', false);
  }
}

// Handle logout
async function handleLogout() {
  if (confirm('লগ আউট করতে চাইছেন?')) {
    try {
      await fetch('/auth/logout', { method: 'POST' });
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new VoucherApp();
  window.app = app;

  const passwordInput = document.getElementById('localLoginPassword');
  if (passwordInput) {
    passwordInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleLocalLogin();
      }
    });
  }
});

function switchTab(tabName) {
  if (window.app) {
    window.app.switchTab(tabName);
  }
}
