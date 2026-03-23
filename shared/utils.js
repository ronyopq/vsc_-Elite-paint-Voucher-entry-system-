// Shared Utilities - Number to Bangla Text Conversion
// Custom implementation for number to Bangla word conversion

const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const banglaUnits = {
  0: '',
  1: 'এক',
  2: 'দুই',
  3: 'তিন',
  4: 'চার',
  5: 'পাঁচ',
  6: 'ছয়',
  7: 'সাত',
  8: 'আট',
  9: 'নয়'
};

const banglaTens = {
  10: 'দশ',
  11: 'এগার',
  12: 'বার',
  13: 'তের',
  14: 'চৌদ্দ',
  15: 'পনের',
  16: 'ষোল',
  17: 'সতের',
  18: 'আঠার',
  19: 'উনিশ',
  20: 'বিশ',
  30: 'ত্রিশ',
  40: 'চল্লিশ',
  50: 'পঞ্চাশ',
  60: 'ষাট',
  70: 'সত্তর',
  80: 'আশি',
  90: 'নব্বই'
};

const banglaScales = {
  100: 'শত',
  1000: 'হাজার',
  100000: 'লক্ষ',
  10000000: 'কোটি'
};

// Convert number to Bangla words
export function convertNumberToBangla(num) {
  if (num === 0) return 'শূন্য';
  
  const intPart = Math.floor(num);
  const fracPart = Math.round((num - intPart) * 100);
  
  let result = '';
  
  // Convert integer part
  if (intPart > 0) {
    result = convertIntegerToBangla(intPart);
  }
  
  // Add decimal part if exists
  if (fracPart > 0) {
    result += ' দশমিক ' + convertIntegerToBangla(fracPart);
  }
  
  return result.trim() + ' টাকা';
}

function convertIntegerToBangla(n) {
  if (n === 0) return '';
  if (n < 10) return banglaUnits[n];
  if (n < 20) return banglaTens[n];
  if (n < 100) {
    const tens = Math.floor(n / 10) * 10;
    const units = n % 10;
    return banglaTens[tens] + (units > 0 ? ' ' + banglaUnits[units] : '');
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const remainder = n % 100;
    return banglaUnits[hundreds] + ' শত' + (remainder > 0 ? ' ' + convertIntegerToBangla(remainder) : '');
  }
  if (n < 100000) {
    const thousands = Math.floor(n / 1000);
    const remainder = n % 1000;
    return convertIntegerToBangla(thousands) + ' হাজার' + (remainder > 0 ? ' ' + convertIntegerToBangla(remainder) : '');
  }
  if (n < 10000000) {
    const lakhs = Math.floor(n / 100000);
    const remainder = n % 100000;
    return convertIntegerToBangla(lakhs) + ' লক্ষ' + (remainder > 0 ? ' ' + convertIntegerToBangla(remainder) : '');
  }
  if (n < 1000000000) {
    const crores = Math.floor(n / 10000000);
    const remainder = n % 10000000;
    return convertIntegerToBangla(crores) + ' কোটি' + (remainder > 0 ? ' ' + convertIntegerToBangla(remainder) : '');
  }
  
  return '';
}

// Convert regular digits to Bangla digits
export function convertDigitsToBangla(str) {
  return String(str).replace(/\d/g, d => banglaDigits[d]);
}

// Utility function to validate email
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Generate random ID
export function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}_${randomPart}` : `${timestamp}_${randomPart}`;
}

// Generate public ID for voucher (shorter, URL-friendly)
export function generatePublicId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Hash function for session tokens
export async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Format date in Bengali
export function formatDateBangla(date) {
  const d = new Date(date);
  
  const banglaMonths = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];
  
  const day = convertDigitsToBangla(d.getDate().toString().padStart(2, '0'));
  const month = banglaMonths[d.getMonth()];
  const year = convertDigitsToBangla(d.getFullYear());
  
  return `${day} ${month}, ${year}`;
}

// Parse ISO date to local date string (YYYY-MM-DD)
export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Check if user has trial active
export function isTrialActive(trialEnd) {
  if (!trialEnd) return false;
  return new Date(trialEnd) > new Date();
}

// Get trial days remaining
export function getTrialDaysRemaining(trialEnd) {
  if (!trialEnd) return 0;
  const now = new Date();
  const end = new Date(trialEnd);
  const diff = end - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}
