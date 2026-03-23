// Public HTML rendering utilities
// Generates HTML for public voucher pages

export function generatePublicVoucherHTML(voucher) {
  return `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ভাউচার #${voucher.voucher_no}</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <style>
    @media print {
      body { margin: 0; padding: 0; background: white; }
      .header, .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="public-viewer">
    <div class="header">
      <h1>🎫 এলিট পেইন্ট ভাউচার</h1>
      <p>ভাউচার: ${voucher.voucher_no}</p>
    </div>
    
    <div id="voucherContainer"></div>
    
    <div class="actions">
      <button onclick="window.print()">🖨️ প্রিন্ট</button>
      <button onclick="navigator.clipboard.writeText(window.location.href)">📋 লিঙ্ক কপি</button>
    </div>
  </div>

  <script src="/voucher-renderer.js"><\/script>
  <script>
    const voucher = ${JSON.stringify(voucher)};
    if (VoucherRenderer) {
      VoucherRenderer.render(document.getElementById('voucherContainer'), voucher);
    }
  <\/script>
</body>
</html>
  `;
}

export function generateErrorHTML(message) {
  return `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ত্রুটি</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@400;700&display=swap" rel="stylesheet">
</head>
<body style="font-family: 'Noto Serif Bengali', serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5;">
  <div style="background: white; padding: 40px; border-radius: 8px; text-align: center; max-width: 500px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h1 style="color: #d32f2f; margin-top: 0;">⚠️ ত্রুটি</h1>
    <p style="color: #666; font-size: 16px;">${message}</p>
    <a href="/" style="color: #667eea; text-decoration: none;">← হোম এ ফিরে যান</a>
  </div>
</body>
</html>
  `;
}

export default {
  generatePublicVoucherHTML,
  generateErrorHTML
};
