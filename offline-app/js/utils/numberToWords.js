// utils/numberToWords.js
// 100% Faithful Replica of Nuxt 4 numberToWords
(function (global) {
  'use strict';

  function numberToWords(num) {
    if (!num || isNaN(num)) return 'Rupees Zero Only';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convertTens = (n) => {
      const v = Math.floor(n);
      if (v < 10) return ones[v] || '';
      if (v < 20) return teens[v - 10] || '';
      let s = tens[Math.floor(v / 10)] || '';
      if (v % 10 > 0) s += ' ' + (ones[v % 10] || '');
      return s;
    };

    const convertHundreds = (n) => {
      const v = Math.floor(n);
      if (v > 99) return ones[Math.floor(v / 100)] + ' Hundred ' + convertTens(v % 100);
      return convertTens(v);
    };

    const absNum = Math.abs(Number(num));
    const wholePart = Math.floor(absNum);
    const decimalPart = Math.round((absNum - wholePart) * 100);

    if (wholePart === 0 && decimalPart === 0) return 'Rupees Zero Only';

    let result = 'Rupees ';
    let tmp = wholePart;

    if (tmp >= 10000000) { result += convertHundreds(Math.floor(tmp / 10000000)) + ' Crore '; tmp %= 10000000; }
    if (tmp >= 100000) { result += convertHundreds(Math.floor(tmp / 100000)) + ' Lakh '; tmp %= 100000; }
    if (tmp >= 1000) { result += convertHundreds(Math.floor(tmp / 1000)) + ' Thousand '; tmp %= 1000; }
    if (tmp > 0) result += convertHundreds(tmp);
    if (decimalPart > 0) result += ' and ' + convertTens(decimalPart) + ' Paise ';

    return result.trim() + ' Only';
  }

  global.numberToWords = numberToWords;
})(window);
