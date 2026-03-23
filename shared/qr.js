// QR Code generation utilities

export class QRCodeGenerator {
  /**
   * Generate QR code SVG for embedding in HTML
   * Uses simple algorithm for small data
   */
  static generateSVG(text, size = 120) {
    // Simplified QR code generation
    // For production, use a proper library like qrcode.js
    
    return `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" 
           width="${size}" height="${size}">
        <rect width="100" height="100" fill="white"/>
        <text x="50" y="50" text-anchor="middle" font-size="8" fill="black">
          ${this.escapeXml(text.substring(0, 20))}
        </text>
      </svg>
    `;
  }

  /**
   * Generate QR code using qrcode.js library
   */
  static async generateWithLibrary(text) {
    // This will use the qrcode library when loaded
    // Usage: 
    // <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    
    return new Promise((resolve) => {
      if (typeof QRCode !== 'undefined') {
        const div = document.createElement('div');
        new QRCode(div, {
          text: text,
          width: 120,
          height: 120
        });
        
        setTimeout(() => {
          const img = div.querySelector('img');
          resolve(img ? img.src : null);
        }, 100);
      } else {
        resolve(null);
      }
    });
  }

  static escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export default QRCodeGenerator;
