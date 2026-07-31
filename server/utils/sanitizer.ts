import xss from 'xss';

export const sanitizeString = (value: string): string => {
  return xss(value);
};

export const sanitizeObject = (obj: any): void => {
  if (!obj || typeof obj !== 'object') return;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeString(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (Array.isArray(obj[key])) {
          obj[key] = obj[key].map((item: any) =>
            typeof item === 'string' ? sanitizeString(item) : item
          );
        } else {
          sanitizeObject(obj[key]);
        }
      }
    }
  }
};

export const sanitizeQueryParams = (queryParams: Record<string, any>): void => {
  if (queryParams && typeof queryParams === 'object') {
    for (const [key, value] of Object.entries(queryParams)) {
      if (typeof value === 'string') {
        queryParams[key] = sanitizeString(value);
      } else if (Array.isArray(value)) {
        queryParams[key] = value.map(v =>
          typeof v === 'string' ? sanitizeString(v) : v
        );
      }
    }
  }
};
