// Public Voucher Viewer
// Displays read-only voucher view for sharing

class PublicVoucherViewer {
  constructor() {
    this.voucher = null;
    this.init();
  }

  async init() {
    // Get public ID from URL
    const publicId = window.location.pathname.split('/').pop();
    
    if (!publicId) {
      this.showError('ভাউচার আইডি পাওয়া যায়নি');
      return;
    }

    try {
      const response = await fetch(`/api/v/${publicId}`);
      if (!response.ok) {
        this.showError('ভাউচার পাওয়া যায়নি');
        return;
      }

      const data = await response.json();
      this.voucher = data.voucher;
      this.render();
    } catch (error) {
      console.error('Error loading voucher:', error);
      this.showError('ভাউচার লোড করতে ব্যর্থ হয়েছে');
    }
  }

  render() {
    document.body.innerHTML = '';
    
    const container = document.createElement('div');
    container.className = 'public-viewer';
    container.style.cssText = `
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
      min-height: 100vh;
      font-family: 'Noto Serif Bengali', serif;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    header.innerHTML = `
      <h1 style="margin: 0 0 10px 0; color: #333;">🎫 এলিট পেইন্ট ভাউচার</h1>
      <p style="color: #666; margin: 0;">ভাউচার নম্বর: ${this.voucher.voucher_no || this.voucher.voucherNo}</p>
    `;
    container.appendChild(header);

    // Voucher canvas
    const voucherDiv = document.createElement('div');
    voucherDiv.id = 'voucherContainer';
    container.appendChild(voucherDiv);

    // Actions
    const actions = document.createElement('div');
    actions.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
      display: flex;
      gap: 10px;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    actions.innerHTML = `
      <button onclick="viewer.print()" style="
        padding: 12px 24px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-family: 'Noto Serif Bengali', serif;
        font-size: 16px;
      ">🖨️ প্রিন্ট করুন</button>
      <button onclick="viewer.share()" style="
        padding: 12px 24px;
        background: #4caf50;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-family: 'Noto Serif Bengali', serif;
        font-size: 16px;
      ">📤 শেয়ার করুন</button>
      <button onclick="viewer.copyLink()" style="
        padding: 12px 24px;
        background: #ff9800;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-family: 'Noto Serif Bengali', serif;
        font-size: 16px;
      ">📋 লিঙ্ক কপি করুন</button>
    `;
    container.appendChild(actions);

    document.body.appendChild(container);

    // Load link stylesheet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/styles.css';
    document.head.appendChild(link);

    // Load font
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@400;700&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    // Render voucher
    if (window.VoucherRenderer) {
      window.VoucherRenderer.render(document.getElementById('voucherContainer'), this.voucher);
    }
  }

  print() {
    window.print();
  }

  share() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: 'এলিট পেইন্ট ভাউচার',
        text: `ভাউচার #${this.voucher.voucher_no}`,
        url: url
      });
    } else {
      alert('এই ব্রাউজার শেয়ারিং সমর্থন করে না।');
    }
  }

  copyLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      alert('লিঙ্ক কপি হয়েছে!');
    });
  }

  showError(message) {
    document.body.innerHTML = `
      <div style="
        max-width: 600px;
        margin: 100px auto;
        padding: 30px;
        background: white;
        border-radius: 8px;
        text-align: center;
        font-family: 'Noto Serif Bengali', serif;
      ">
        <p style="color: #d32f2f; font-size: 18px;">${message}</p>
      </div>
    `;
  }
}

// Initialize when DOM is ready
let viewer;
document.addEventListener('DOMContentLoaded', () => {
  viewer = new PublicVoucherViewer();
});
