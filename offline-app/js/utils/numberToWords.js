// utils/numberToWords.js
(function (global) {
  'use strict';

  function numberToWords(amount) {
    const num = Math.floor(Math.abs(Number(amount) || 0));
    if (num === 0) return 'Zero Only';

    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertGroup(n) {
      let str = '';
      if (n >= 100) {
        str += units[Math.floor(n / 100)] + ' Hundred ';
        n %= 100;
      }
      if (n >= 10 && n <= 19) {
        str += teens[n - 10] + ' ';
      } else if (n >= 20) {
        str += tens[Math.floor(n / 10)] + ' ';
        if (n % 10 > 0) str += units[n % 10] + ' ';
      } else if (n > 0) {
        str += units[n] + ' ';
      }
      return str.trim();
    }

    let result = '';
    const crore = Math.floor(num / 10000000);
    let remainder = num % 10000000;

    const lakh = Math.floor(remainder / 100000);
    remainder %= 100000;

    const thousand = Math.floor(remainder / 1000);
    remainder %= 1000;

    if (crore > 0) result += convertGroup(crore) + ' Crore ';
    if (lakh > 0) result += convertGroup(lakh) + ' Lakh ';
    if (thousand > 0) result += convertGroup(thousand) + ' Thousand ';
    if (remainder > 0) result += convertGroup(remainder) + ' ';

    return (result.trim() + ' Only').replace(/\s+/g, ' ');
  }

  global.numberToWords = numberToWords;
})(window);
