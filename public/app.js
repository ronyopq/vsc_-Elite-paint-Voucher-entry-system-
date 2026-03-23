// Elite Paint Voucher Entry System - Main Application
// Frontend Application Logic

class VoucherApp {
  constructor() {
    this.user = null;
    this.currentVoucher = null;
    this.voucherHistory = [];
    this.apiBase = '';
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
            <input type="text" id="particular1" class="particular-input" placeholder="প্রথম বিবরণ" />
            <input type="text" id="particular2" class="particular-input" placeholder="দ্বিতীয় বিবরণ" />
            <input type="text" id="particular3" class="particular-input" placeholder="তৃতীয় বিবরণ" />
            <input type="text" id="particular4" class="particular-input" placeholder="চতুর্থ বিবরণ" />
            <input type="text" id="particular5" class="particular-input" placeholder="পঞ্চম বিবরণ" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>পরিমাণ (টাকা) *</label>
            <input type="number" id="amount" placeholder="০" step="0.01" required>
            <div class="amount-words" id="amountWords"></div>
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

    // Setup amount to words conversion
    document.getElementById('amount').addEventListener('input', (e) => this.updateAmountWords(e.target.value));

    // Set today's date by default
    this.setToday();
  }

  async handleVoucherSubmit(e) {
    e.preventDefault();

    // Collect particulars from 5 fields
    const particulars = [
      document.getElementById('particular1').value.trim(),
      document.getElementById('particular2').value.trim(),
      document.getElementById('particular3').value.trim(),
      document.getElementById('particular4').value.trim(),
      document.getElementById('particular5').value.trim()
    ].filter(p => p).join(' | ');

    if (!particulars) {
      this.showError('অন্তত একটি বিবরণ প্রয়োজন।');
      return;
    }

    const voucherData = {
      date: document.getElementById('date').value,
      voucherNo: document.getElementById('voucherNo').value,
      payTo: document.getElementById('payTo').value,
      codeNo: document.getElementById('codeNo').value,
      controlAc: document.getElementById('controlAc').value,
      particulars: particulars,
      amount: parseFloat(document.getElementById('amount').value),
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
    const particulars = voucher.particulars.split(' | ').filter(p => p.trim());
    
    // Ensure 5 rows
    while (particulars.length < 5) particulars.push('');
    particulars.length = 5;

    const memoHTML = `
      <style>
        .voucher-memo {
          width: 900px;
          background: white;
          font-family: Arial, sans-serif;
          padding: 30px;
          margin: 20px auto;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
          color: #000;
        }
        .memo-header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
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
          margin-top: 10px;
        }
        .header-field {
          margin: 5px 0;
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
        .form-fields {
          margin: 15px 0;
          font-size: 12px;
        }
        .form-row {
          margin-bottom: 10px;
          display: flex;
          gap: 20px;
          align-items: center;
        }
        .form-row-full {
          margin-bottom: 10px;
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
          margin: 20px 0;
          font-size: 12px;
        }
        .memo-table th {
          border: 1px solid #000;
          padding: 8px;
          text-align: center;
          font-weight: bold;
          background: #f8f8f8;
        }
        .memo-table td {
          border: 1px solid #000;
          padding: 8px;
          height: 25px;
          vertical-align: top;
        }
        .particulars-col {
          width: 60%;
          text-align: left;
        }
        .taka-col {
          width: 20%;
          text-align: right;
        }
        .taka-col input {
          width: 100%;
          border: none;
          background: transparent;
          text-align: right;
          font-size: 12px;
          padding: 0 4px;
        }
        .ps-col {
          width: 20%;
          text-align: center;
        }
        .total-row {
          font-weight: bold;
        }
        .total-row .taka-col {
          background: #f8f8f8;
        }
        .footer-signatures {
          display: flex;
          justify-content: space-around;
          margin-top: 40px;
          font-size: 12px;
        }
        .sig-item {
          text-align: center;
        }
        .sig-line {
          border-top: 1px solid #000;
          width: 100px;
          margin-top: 30px;
        }
      </style>

      <div class="voucher-memo">
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
            <div class="field-label">Voucher No.</div>
            <div class="field-value">${voucher.voucherNo || ''}</div>
          </div>
          <div class="header-field">
            <div class="field-label">Date</div>
            <div class="field-value">${this.formatVoucherDate(voucher.date)}</div>
          </div>
        </div>

        <div class="form-fields">
          <div class="form-row">
            <span class="row-label">Code No.</span>
            <span class="row-value">${voucher.codeNo || ''}</span>
          </div>
          <div class="form-row-full">
            <div class="row-label">Pay to</div>
            <div class="row-value" style="border-bottom: 1px solid #000;">${voucher.payTo || ''}</div>
          </div>
          <div class="form-row">
            <span class="row-label">Head of Accounts</span>
            <span class="row-value"></span>
            <span class="row-label" style="margin-left: 30px;">Control A/C.</span>
            <span class="row-value">${voucher.controlAc || ''}</span>
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
            ${particulars.map((part, idx) => `
              <tr>
                <td class="particulars-col">${part}</td>
                <td class="taka-col"><input type="number" step="0.01" /></td>
                <td class="ps-col"></td>
              </tr>
            `).join('')}
            <tr>
              <td colspan="3" style="border:none; height:15px;"></td>
            </tr>
            <tr>
              <td colspan="3">
                <div style="display:flex; gap:20px;">
                  <div style="flex:1;">
                    <strong style="font-size:11px;">CASH/CHEQUE/P.O/D.D</strong>
                    <div style="border-bottom:1px solid #000; height:15px;"></div>
                  </div>
                  <div style="flex:1;">
                    <strong style="font-size:11px;">A/c. No. :</strong>
                    <div style="border-bottom:1px solid #000; height:15px;">${voucher.accountNo || ''}</div>
                  </div>
                  <div style="flex:1;">
                    <strong style="font-size:11px;">Date :</strong>
                    <div style="border-bottom:1px solid #000; height:15px;"></div>
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td colspan="3" style="padding:10px; background:#f8f8f8;">
                <div><strong style="font-size:11px;">Taka (In words) :</strong></div>
                <div style="font-size:13px; font-weight:bold; margin-top:5px;">${this.numberToBanglaWords(voucher.amount)}</div>
              </td>
            </tr>
            <tr class="total-row">
              <td colspan="1"></td>
              <td class="taka-col"><strong>${this.formatAmount(voucher.amount)}</strong></td>
              <td class="ps-col"></td>
            </tr>
            <tr>
              <td colspan="3" style="border:none; text-align:right; padding-right:20px; font-weight:bold;">Total</td>
            </tr>
          </tbody>
        </table>

        <div class="footer-signatures">
          <div class="sig-item">
            <div>Acknowledged by</div>
            <div class="sig-line"></div>
          </div>
          <div class="sig-item">
            <div>Prepared by</div>
            <div class="sig-line"></div>
          </div>
          <div class="sig-item">
            <div>Verified by</div>
            <div class="sig-line"></div>
          </div>
          <div class="sig-item">
            <div>Recommend by</div>
            <div class="sig-line"></div>
          </div>
          <div class="sig-item">
            <div>Approved by</div>
            <div class="sig-line"></div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = memoHTML;
  }

  formatVoucherDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
  }

  formatAmount(amount) {
    return parseFloat(amount).toFixed(2);
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
    // This will generate the exact print layout
    return `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@400;700&display=swap" rel="stylesheet">
  <style>
    @page { size: 8.3in 5.65in; margin: 0; }
    body { margin: 0; padding: 0; font-family: 'Noto Serif Bengali', serif; }
    .voucher { width: 8.3in; height: 5.65in; position: relative; padding: 0; }
  </style>
</head>
<body>
  <div class="voucher" id="voucherForPrint"></div>
  <script src="/voucher-renderer.js"><\/script>
  <script>
    const voucher = ${JSON.stringify(voucher)};
    VoucherRenderer.render(document.getElementById('voucherForPrint'), voucher);
  <\/script>
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
    } catch (error) {
      console.error('Load history error:', error);
    }
  }

  displayVoucherHistory() {
    const historyHTML = `
      <h2>ভাউচার ইতিহাস</h2>
      <table class="history-table">
        <thead>
          <tr>
            <th>তারিখ</th>
            <th>নম্বর</th>
            <th>যাকে দিতে হবে</th>
            <th>পরিমাণ</th>
            <th>অ্যাকশন</th>
          </tr>
        </thead>
        <tbody>
          ${this.voucherHistory.map(v => `
            <tr>
              <td>${v.date}</td>
              <td>${v.voucher_no}</td>
              <td>${v.pay_to}</td>
              <td>${v.amount}</td>
              <td>
                <button onclick="app.viewVoucher('${v.id}')" class="btn-small">দেখুন</button>
                <button onclick="app.shareVoucher('${v.public_id}')" class="btn-small">শেয়ার</button>
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
      document.getElementById('monthlyStats').innerHTML = `
        <p>মোট ভাউচার: ${stats.total || 0}</p>
        <p>মোট পরিমাণ: ${(stats.total_amount || 0).toLocaleString('bn-BD')} টাকা</p>
      `;
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
      <div class="settings-section" id="trialInfo"></div>
    `;

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

      return {
        total: vouchers.length,
        total_amount: vouchers.reduce((sum, v) => sum + (v.amount || 0), 0)
      };
    } catch (error) {
      console.error('Get stats error:', error);
      return { total: 0, total_amount: 0 };
    }
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

  autoIncrementVoucher() {
    // Get last voucher number and increment
    if (this.voucherHistory.length > 0) {
      const lastVoucher = this.voucherHistory[0];
      const lastNum = parseInt(lastVoucher.voucher_no.split('-')[1]) || 0;
      const nextNum = (lastNum + 1).toString().padStart(3, '0');
      document.getElementById('voucherNo').value = `VOC-${nextNum}`;
    }
  }

  setToday() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
  }

  clearForm() {
    document.getElementById('voucherEntryForm').reset();
    this.setToday();
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-tabs button').forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabName + 'Tab').classList.add('active');
    event.target.classList.add('active');
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
