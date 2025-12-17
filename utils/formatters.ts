
export const formatCollectionDate = (dateStr?: string): string => {
  if (!dateStr) return 'Unknown Date';
  
  // Standard format YYYY-MM-DD
  const parts = dateStr.split('-');
  
  try {
    if (parts.length === 3) {
      // YYYY-MM-DD
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      }
    } else if (parts.length === 2) {
      // YYYY-MM
      const date = new Date(`${dateStr}-01`);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
      }
    } else if (parts.length === 1 && /^\d{4}$/.test(dateStr)) {
      // YYYY
      return dateStr;
    }
  } catch (e) {
    // If parsing fails, fall back to the raw string
  }

  return dateStr;
};
