function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Format a date range with its year: "September 10th–12th, 2026" / "22–24 de setembro de 2026".
 * The group page has no year headers, so every date carries its own year.
 */
export function formatDateRangePretty(startDateStr: string, endDateStr: string, locale: string): string {
  try {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return `${startDateStr}`;
    const isPt = locale === 'pt';
    const localeStr = isPt ? 'pt-PT' : 'en-US';
    const startMonth = startDate.toLocaleDateString(localeStr, { month: 'long' });
    const endMonth = endDate.toLocaleDateString(localeStr, { month: 'long' });
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const sameMonth = startMonth === endMonth && startYear === endYear;

    if (isPt) {
      // Portuguese: "18 de abril de 2026", "1–5 de novembro de 2026"
      if (startYear !== endYear) {
        return `${startDay} de ${startMonth} de ${startYear} – ${endDay} de ${endMonth} de ${endYear}`;
      }
      if (sameMonth && startDay === endDay) return `${startDay} de ${startMonth} de ${startYear}`;
      if (sameMonth) return `${startDay}–${endDay} de ${startMonth} de ${startYear}`;
      return `${startDay} de ${startMonth} – ${endDay} de ${endMonth} de ${endYear}`;
    }

    // English: "April 18th, 2026", "November 1st–5th, 2026"
    if (startYear !== endYear) {
      return `${startMonth} ${getOrdinal(startDay)}, ${startYear} – ${endMonth} ${getOrdinal(endDay)}, ${endYear}`;
    }
    if (sameMonth && startDay === endDay) return `${startMonth} ${getOrdinal(startDay)}, ${startYear}`;
    if (sameMonth) return `${startMonth} ${getOrdinal(startDay)}–${getOrdinal(endDay)}, ${startYear}`;
    return `${startMonth} ${getOrdinal(startDay)} – ${endMonth} ${getOrdinal(endDay)}, ${endYear}`;
  } catch {
    return `${startDateStr}`;
  }
}
