// Elite Paint Voucher Renderer
// Handles exact positioning and print layout of vouchers
// Canvas: 797px × 542px (96DPI = 8.3in × 5.65in)

const VoucherRenderer = {
  // Voucher canvas dimensions
  CANVAS_WIDTH: 797,
  CANVAS_HEIGHT: 542,
  DPI: 96,

  // Field coordinates (in pixels)
  FIELDS: {
    voucherNo: { x: 80, y: 45, fontSize: 18 },
    date: { x: 580, y: 45, fontSize: 18 },
    payTo: { x: 120, y: 110, fontSize: 18, width: 480, height: 30 },
    controlAc: { x: 120, y: 150, fontSize: 18, width: 480, height: 30 },
    particulars: { x: 70, y: 210, fontSize: 16, width: 500, height: 250 },
    amount: { x: 610, y: 210, fontSize: 20 },
    accountNo: { x: 610, y: 270, fontSize: 16 },
    paymentMethod: { x: 610, y: 310, fontSize: 16 },
    amountWords: { x: 120, y: 480, fontSize: 16, width: 560, height: 30 },
    qrCode: { x: 650, y: 15, size: 120 },
    prepared: { x: 80, y: 510, fontSize: 14 },
    verified: { x: 250, y: 510, fontSize: 14 },
    recommended: { x: 420, y: 510, fontSize: 14 },
    approved: { x: 590, y: 510, fontSize: 14 }
  },

  /**
   * Main render function
   * @param {HTMLElement} container - Container to render voucher in
   * @param {Object} voucher - Voucher data
   */
  render(container, voucher) {
    // Create canvas element
    const canvas = this.createVoucherCanvas(voucher);
    container.innerHTML = '';
    container.appendChild(canvas);

    // If printing, draw to canvas and print
    if (window.isPrinting) {
      this.drawToCanvas(canvas, voucher);
    }
  },

  /**
   * Create voucher HTML canvas
   */
  createVoucherCanvas(voucher) {
    const canvas = document.createElement('div');
    canvas.className = 'voucher-canvas';
    canvas.style.cssText = `
      width: 8.3in;
      height: 5.65in;
      background: white;
      border: 1px solid #ddd;
      position: relative;
      font-family: 'Noto Serif Bengali', serif;
      overflow: hidden;
      margin: 20px auto;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      page-break-after: always;
    `;

    // Draw border background
    const borderDiv = document.createElement('div');
    borderDiv.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: 2px solid #333;
      pointer-events: none;
    `;
    canvas.appendChild(borderDiv);

    // Add header line
    const headerLine = document.createElement('div');
    headerLine.style.cssText = `
      position: absolute;
      top: 130px;
      left: 50px;
      right: 50px;
      height: 1px;
      background: #333;
    `;
    canvas.appendChild(headerLine);

    // Add signature line
    const sigLine = document.createElement('div');
    sigLine.style.cssText = `
      position: absolute;
      top: 505px;
      left: 50px;
      right: 50px;
      height: 1px;
      background: #333;
    `;
    canvas.appendChild(sigLine);

    // Voucher No
    this.addField(canvas, voucher.voucher_no || voucher.voucherNo, 'voucherNo', true);

    // Date
    const displayDate = this.formatDateBangla(voucher.date);
    this.addField(canvas, displayDate, 'date', true);

    // Pay To
    this.addField(canvas, voucher.pay_to || voucher.payTo, 'payTo');

    // Control A/C
    this.addField(canvas, voucher.control_ac || voucher.controlAc, 'controlAc');

    // Particulars (with line wrapping)
    this.addParticularField(canvas, voucher.particulars || '');

    // Amount
    const amountStr = this.formatAmount(voucher.amount);
    this.addField(canvas, amountStr, 'amount', true);

    // Account No
    if (voucher.account_no || voucher.accountNo) {
      this.addField(canvas, voucher.account_no || voucher.accountNo, 'accountNo');
    }

    // Payment Method
    if (voucher.payment_method || voucher.paymentMethod) {
      this.addField(canvas, voucher.payment_method || voucher.paymentMethod, 'paymentMethod');
    }

    // Amount in Words (Bangla)
    const amountWords = this.convertNumberToBanglaWords(voucher.amount);
    this.addField(canvas, amountWords, 'amountWords');

    // QR Code
    this.addQRCode(canvas, voucher.public_id || voucher.publicId);

    // Signature row labels
    this.addSignatureLabels(canvas);

    return canvas;
  },

  /**
   * Add a regular field to the voucher
   */
  addField(canvas, text, fieldName, isBold = false) {
    if (!text || text.length === 0) return;

    const field = this.FIELDS[fieldName];
    const div = document.createElement('div');

    div.style.cssText = `
      position: absolute;
      left: ${field.x}px;
      top: ${field.y}px;
      font-size: ${field.fontSize}px;
      font-weight: ${isBold ? 'bold' : 'normal'};
      font-family: 'Noto Serif Bengali', serif;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      ${field.width ? `width: ${field.width}px;` : ''}
      ${field.height ? `height: ${field.height}px;` : ''}
    `;

    div.textContent = text;
    canvas.appendChild(div);
  },

  /**
   * Add particulars field with line wrapping
   */
  addParticularField(canvas, text) {
    const field = this.FIELDS.particulars;
    const div = document.createElement('div');

    div.style.cssText = `
      position: absolute;
      left: ${field.x}px;
      top: ${field.y}px;
      font-size: ${field.fontSize}px;
      font-family: 'Noto Serif Bengali', serif;
      width: ${field.width}px;
      height: ${field.height}px;
      overflow: hidden;
      word-wrap: break-word;
      line-height: 1.4;
      padding: 5px;
    `;

    // Count lines and adjust font if needed
    const lines = text.split('\n');
    if (lines.length > 6) {
      div.style.fontSize = '14px';
    }

    div.textContent = text;
    canvas.appendChild(div);
  },

  /**
   * Add QR code
   */
  addQRCode(canvas, publicId) {
    const field = this.FIELDS.qrCode;
    const qrContainer = document.createElement('div');

    qrContainer.style.cssText = `
      position: absolute;
      left: ${field.x}px;
      top: ${field.y}px;
      width: ${field.size}px;
      height: ${field.size}px;
      background: white;
      border: 1px solid #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      text-align: center;
      padding: 5px;
      box-sizing: border-box;
      overflow: hidden;
    `;

    // Generate QR code using qrcode.js library
    // If qrcode library is available, use it; otherwise show URL
    const url = `${window.location.origin}/v/${publicId}`;

    if (typeof QRCode !== 'undefined') {
      // Use qrcode library
      const tempContainer = document.createElement('div');
      new QRCode(tempContainer, {
        text: url,
        width: field.size - 10,
        height: field.size - 10,
        colorDark: '#000',
        colorLight: '#fff'
      });
      
      const qrImage = tempContainer.querySelector('img');
      if (qrImage) {
        qrImage.style.width = '100%';
        qrImage.style.height = '100%';
        qrContainer.innerHTML = '';
        qrContainer.appendChild(qrImage);
      }
    } else {
      // Fallback: show URL text
      qrContainer.innerHTML = `<div style="font-size: 9px; word-break: break-all;">${publicId}</div>`;
    }

    canvas.appendChild(qrContainer);
  },

  /**
   * Add signature row labels
   */
  addSignatureLabels(canvas) {
    const labels = [
      { x: 80, text: 'প্রস্তুত' },
      { x: 250, text: 'যাচাইকৃত' },
      { x: 420, text: 'সুপারিশকৃত' },
      { x: 590, text: 'অনুমোদিত' }
    ];

    labels.forEach(label => {
      const div = document.createElement('div');
      div.style.cssText = `
        position: absolute;
        left: ${label.x}px;
        top: 515px;
        font-size: 12px;
        font-family: 'Noto Serif Bengali', serif;
        font-weight: bold;
      `;
      div.textContent = label.text;
      canvas.appendChild(div);
    });
  },

  /**
   * Format amount with Bangla comma separation
   */
  formatAmount(amount) {
    if (!amount) return '০';
    
    const parts = amount.toFixed(2).split('.');
    const intPart = parseInt(parts[0]).toLocaleString('bn-BD');
    const decimalPart = parts[1];
    
    return decimalPart && decimalPart !== '00' 
      ? `${intPart}.${decimalPart}`
      : intPart;
  },

  /**
   * Format date in Bengali format
   */
  formatDateBangla(dateString) {
    const date = new Date(dateString);
    
    const banglaMonths = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];

    const day = date.getDate().toString().padStart(2, '0');
    const month = banglaMonths[date.getMonth()];
    const year = date.getFullYear();

    // Convert digits to Bangla
    const bengaliDay = this.convertDigitsToBangla(day);
    const bengaliYear = this.convertDigitsToBangla(year);

    return `${bengaliDay} ${month}, ${bengaliYear}`;
  },

  /**
   * Convert number to Bangla words
   */
  convertNumberToBanglaWords(num) {
    if (!num || isNaN(num)) return 'শূন্য টাকা';

    const units = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
    const tens = {
      10: 'দশ', 11: 'এগার', 12: 'বার', 13: 'তের', 14: 'চৌদ্দ',
      15: 'পনের', 16: 'ষোল', 17: 'সতের', 18: 'আঠার', 19: 'উনিশ',
      20: 'বিশ', 30: 'ত্রিশ', 40: 'চল্লিশ', 50: 'পঞ্চাশ',
      60: 'ষাট', 70: 'সত্তর', 80: 'আশি', 90: 'নব্বই'
    };

    const convertLessThan100 = (n) => {
      if (n < 10) return units[n];
      if (n < 20) return tens[n];
      const ten = Math.floor(n / 10) * 10;
      const unit = n % 10;
      return tens[ten] + (unit > 0 ? ' ' + units[unit] : '');
    };

    const convertLessThan1000 = (n) => {
      if (n < 100) return convertLessThan100(n);
      const h = Math.floor(n / 100);
      const remainder = n % 100;
      return units[h] + ' শত' + (remainder > 0 ? ' ' + convertLessThan100(remainder) : '');
    };

    let result = '';
    const n = Math.floor(num);

    if (n === 0) return 'শূন্য টাকা';

    // Crores
    if (n >= 10000000) {
      const c = Math.floor(n / 10000000);
      result += convertLessThan1000(c) + ' কোটি ';
      const remainder = n % 10000000;
      if (remainder > 0) {
        return result + this.convertNumberToBanglaWords(remainder) + ' টাকা';
      }
    }

    // Lakhs
    if (n >= 100000) {
      const l = Math.floor(n / 100000);
      result += convertLessThan100(l) + ' লক্ষ ';
      const remainder = n % 100000;
      if (remainder > 0) {
        return result + this.convertNumberToBanglaWords(remainder) + ' টাকা';
      }
    }

    // Thousands
    if (n >= 1000) {
      const t = Math.floor(n / 1000);
      result += convertLessThan1000(t) + ' হাজার ';
      const remainder = n % 1000;
      if (remainder > 0) {
        return result + convertLessThan1000(remainder) + ' টাকা';
      }
    }

    // Hundreds, tens, units
    if (n > 0) {
      result += convertLessThan1000(n);
    }

    return result.trim() + ' টাকা';
  },

  /**
   * Convert digits to Bangla
   */
  convertDigitsToBangla(numStr) {
    const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(numStr).replace(/\d/g, d => banglaDigits[d]);
  },

  /**
   * Draw canvas to actual canvas for printing
   */
  drawToCanvas(container, voucher) {
    // This is called when actually printing
    // The HTML div render is sufficient for print
  }
};

// Make VoucherRenderer globally available
if (typeof window !== 'undefined') {
  window.VoucherRenderer = VoucherRenderer;
}
