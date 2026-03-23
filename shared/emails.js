// Email notification templates (for future use)

export const EmailTemplates = {
  welcomeEmail: (name, trialDays) => `
    <h1>স্বাগতম ${name}!</h1>
    <p>আপনার এলিট পেইন্ট ভাউচার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে।</p>
    <p>আপনার কাছে ${trialDays} দিনের ট্রায়াল অ্যাক্সেস আছে।</p>
    <a href="#">আপনার অ্যাকাউন্ট অ্যাক্সেস করুন</a>
  `,

  trialEndingEmail: (name, daysLeft) => `
    <h1>${name}, আপনার ট্রায়াল শেষ হচ্ছে</h1>
    <p>আপনার ট্রায়াল ${daysLeft} দিনে শেষ হবে।</p>
    <p>অ্যাক্সেস বজায় রাখতে আজই আপগ্রেড করুন।</p>
    <a href="#">আপগ্রেড করুন</a>
  `,

  voucherSharedEmail: (voucherNo, link) => `
    <h1>একটি ভাউচার আপনার সাথে শেয়ার করা হয়েছে</h1>
    <p>ভাউচার নম্বর: ${voucherNo}</p>
    <a href="${link}">ভাউচার দেখুন</a>
  `,

  trialExtendedEmail: (name, newExpiryDate) => `
    <h1>${name}, আপনার ট্রায়াল বর্ধিত হয়েছে</h1>
    <p>নতুন শেষতারিখ: ${newExpiryDate}</p>
    <p>এলিট পেইন্ট ভাউচার ব্যবহার করা চালিয়ে যান।</p>
  `
};

export default EmailTemplates;
