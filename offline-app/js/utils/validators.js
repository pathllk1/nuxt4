// utils/validators.js
(function (global) {
  'use strict';

  const Validators = {
    validateItem(item) {
      const errors = {};
      if (!item.title || !item.title.trim()) {
        errors.title = 'Title is required';
      } else if (item.title.trim().length < 2) {
        errors.title = 'Title must be at least 2 characters';
      }

      if (!item.category) {
        errors.category = 'Category is required';
      }

      if (item.value !== undefined && item.value !== null && item.value !== '') {
        const val = Number(item.value);
        if (isNaN(val) || val < 0) {
          errors.value = 'Value must be a non-negative number';
        }
      }

      return {
        isValid: Object.keys(errors).length === 0,
        errors
      };
    },

    sanitizeSqlInput(input) {
      if (typeof input !== 'string') return input;
      // Basic sanitization
      return input.trim();
    }
  };

  global.Validators = Validators;
})(window);
