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

  initVoucherForm() {
    const formHTML = `
      <h2>নতুন ভাউচার এন্ট্রি</h2>
      <form id="voucherEntryForm">
        <div class="form-row">
          <div class="form-group">
            <label>ভাউচার নম্বর *</label>
            <input type="text" id="voucherNo" placeholder="উদা: VOC-001" required>
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
            <ul class="suggestions" id="payToSuggestions"></ul>
          </div>
          <div class="form-group">
            <label>কোড নম্বর</label>
            <input type="text" id="codeNo" placeholder="কোড">
            <ul class="suggestions" id="codeNoSuggestions"></ul>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>নিয়ন্ত্রণ অ্যাকাউন্ট *</label>
            <input type="text" id="controlAc" placeholder="অ্যাকাউন্ট" required>
            <ul class="suggestions" id="controlAcSuggestions"></ul>
          </div>
          <div class="form-group">
            <label>অ্যাকাউন্ট নম্বর</label>
            <input type="text" id="accountNo" placeholder="অ্যাকাউন্ট নম্বর">
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

        <div class="form-group full-width">
          <label>পেমেন্ট পদ্ধতি</label>
          <select id="paymentMethod">
            <option value="">নির্বাচন করুন</option>
            <option value="নগদ">নগদ</option>
            <option value="চেক">চেক</option>
            <option value="ট্রান্সফার">ব্যাংক ট্রান্সফার</option>
            <option value="ক্রেডিট কার্ড">ক্রেডিট কার্ড</option>
          </select>
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

    // Setup auto-suggestions
    ['payTo', 'codeNo', 'controlAc'].forEach(field => {
      const input = document.getElementById(field);
      if (input) {
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
  }

  async handleVoucherSubmit(e) {
    e.preventDefault();

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

    const voucherData = {
      date: document.getElementById('date').value,
      voucherNo: document.getElementById('voucherNo').value,
      payTo: document.getElementById('payTo').value,
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
    const previewHTML = `
      <div class="voucher-preview">
        <div class="preview-header">
          <h3>প্রিভিউ</h3>
          <button type="button" class="btn-primary" onclick="app.printVoucher(${JSON.stringify(voucher).replace(/"/g, '&quot;')})">প্রিন্ট করুন</button>
          <button type="button" class="btn-secondary" onclick="app.copyLink('${voucher.publicId}')">লিঙ্ক কপি</button>
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
    const rows = this.parseVoucherRows(voucher);
    const total = rows.reduce((sum, row) => sum + (row.amount || 0), 0) || (parseFloat(voucher.amount) || 0);
    const publicId = voucher.publicId || voucher.public_id || '';
    const shareUrl = publicId ? `${window.location.origin}/v/${publicId}` : '';
    const qrUrl = shareUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=95x95&data=${encodeURIComponent(shareUrl)}`
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
          right: 30px;
          top: 32px;
          width: 95px;
          height: 95px;
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
        <div class="memo-qr">
          ${qrUrl
            ? `<img src="${qrUrl}" alt="Voucher QR">`
            : `<div class="memo-qr-fallback">${this.escapeHtml(publicId || 'QR')}</div>`}
        </div>

        <div class="memo-header">
          <div class="company-name">ELITE PAINT & CHEMICAL INDUSTRIES LTD.</div>
          <div class="company-address">
            Corporate Office: Syed Grand Centre (Level-B & 12), Plot # 89 Road # 28, Sector # 7, Uttara, Dhaka-1230.<br>
            Khulna Office: 12, Sher-E-Bangla Road, Khulna.
          </div>
          <div style="font-weight: bold; margin-top: 5px;">Khulna Depot</div>
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
            <span class="row-value"></span>
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
                <button onclick="app.shareVoucher('${v.public_id}')" class="btn-small">শেয়ার</button>
                <button onclick="app.updateVoucherWorkflow('${v.id}', 'prepared')" class="btn-small">প্রস্তুত</button>
                <button onclick="app.updateVoucherWorkflow('${v.id}', 'verified')" class="btn-small">যাচাই</button>
                <button onclick="app.updateVoucherWorkflow('${v.id}', 'recommended')" class="btn-small">সুপারিশ</button>
                <button onclick="app.updateVoucherWorkflow('${v.id}', 'approved')" class="btn-small">অনুমোদন</button>
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
    `;

    try {
      // Load stats from DB
      const stats = await this.getUserStats();
      const weekly = this.getWeeklyStats(this.voucherHistory);
      document.getElementById('monthlyStats').innerHTML = `
        <p>মোট ভাউচার: ${stats.total || 0}</p>
        <p>মোট পরিমাণ: ${(stats.total_amount || 0).toLocaleString('bn-BD')} টাকা</p>
      `;

      document.getElementById('weeklyStats').innerHTML = weekly.length
        ? weekly.map((w) => `<p>${w.label}: ${w.count} টি, ${this.formatAmount(w.total)} টাকা</p>`).join('')
        : '<p>কোন ডাটা নেই</p>';
    } catch (error) {
      console.error('Load reports error:', error);
    }
  }

  async loadSettings() {
    document.getElementById('settings').innerHTML = `
      <h2>সেটিংস</h2>
      <div class="settings-section">
        <h3>প্রোফাইল</h3>
        <p>নাম: ${this.user.name}</p>
        <p>ইমেইল: ${this.user.email}</p>
        <p>ভূমিকা: ${this.user.role}</p>
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
      <div class="settings-section" id="trialInfo"></div>
    `;

    this.populatePrintCalibration();

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

  autoIncrementVoucher() {
    // Format: VOC-YYYYMM-###
    if (this.voucherHistory.length > 0) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const prefix = `VOC-${y}${m}-`;

      const monthVouchers = this.voucherHistory.filter(v => String(v.voucher_no || '').startsWith(prefix));
      let maxSerial = 0;
      monthVouchers.forEach((v) => {
        const serial = parseInt(String(v.voucher_no).replace(prefix, ''), 10);
        if (serial > maxSerial) maxSerial = serial;
      });

      const nextNum = String(maxSerial + 1).padStart(3, '0');
      document.getElementById('voucherNo').value = `${prefix}${nextNum}`;
      return;
    }

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    document.getElementById('voucherNo').value = `VOC-${y}${m}-001`;
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
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 5000);
  }

  showMessage(message) {
    alert(message);
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
