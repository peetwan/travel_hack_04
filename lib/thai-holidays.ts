// Hardcoded Thai public holidays + high-tourism cultural dates for 2026 & 2027.
// Nager.Date does not support TH, and the official Bank of Thailand calendar is
// not exposed via API. Lunar dates (Makha/Visakha/Asalha Bucha, Loy Krathong)
// follow the Royal Thai Government's Cabinet announcements; verify each year
// against https://www.thaipost.net or the BOT bank-holiday list before shipping
// to production.

export type HolidayImpact = "national-holiday" | "cultural-festival";

export interface ThaiHoliday {
  date: string; // YYYY-MM-DD
  name_en: string;
  name_th: string;
  impact: HolidayImpact;
  /**
   * Heuristic for tourism crowd impact.
   * - 'high' = nationwide travel + foreign tourists flock here too (Songkran, Loy Krathong)
   * - 'medium' = domestic travel uptick (long weekends, royal/religious holidays)
   * - 'low' = official day off but minimal tourism shift
   */
  crowd_impact: "high" | "medium" | "low";
  notes?: string;
}

const HOLIDAYS_2026: ThaiHoliday[] = [
  { date: "2026-01-01", name_en: "New Year's Day", name_th: "วันขึ้นปีใหม่", impact: "national-holiday", crowd_impact: "high", notes: "Domestic travel peak — every popular spot is full." },
  { date: "2026-02-17", name_en: "Chinese New Year", name_th: "ตรุษจีน", impact: "cultural-festival", crowd_impact: "medium", notes: "Not an official holiday but Chinatown Bangkok and Phuket old town are packed." },
  { date: "2026-03-04", name_en: "Makha Bucha Day", name_th: "วันมาฆบูชา", impact: "national-holiday", crowd_impact: "medium", notes: "Buddhist holiday — temples are busy for candlelight processions." },
  { date: "2026-04-06", name_en: "Chakri Memorial Day", name_th: "วันจักรี", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2026-04-13", name_en: "Songkran Festival", name_th: "วันสงกรานต์", impact: "national-holiday", crowd_impact: "high", notes: "Thai New Year water festival — all of Thailand travels home or to Chiang Mai. Avoid if you hate crowds." },
  { date: "2026-04-14", name_en: "Songkran Festival", name_th: "วันสงกรานต์", impact: "national-holiday", crowd_impact: "high" },
  { date: "2026-04-15", name_en: "Songkran Festival", name_th: "วันสงกรานต์", impact: "national-holiday", crowd_impact: "high" },
  { date: "2026-05-01", name_en: "National Labour Day", name_th: "วันแรงงานแห่งชาติ", impact: "national-holiday", crowd_impact: "low" },
  { date: "2026-05-04", name_en: "Coronation Day", name_th: "วันฉัตรมงคล", impact: "national-holiday", crowd_impact: "medium", notes: "Long weekend if it falls beside Labour Day." },
  { date: "2026-06-01", name_en: "Visakha Bucha Day", name_th: "วันวิสาขบูชา", impact: "national-holiday", crowd_impact: "medium", notes: "Major Buddhist holiday — temples nationwide are very busy." },
  { date: "2026-06-03", name_en: "H.M. Queen Suthida's Birthday", name_th: "วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี", impact: "national-holiday", crowd_impact: "low" },
  { date: "2026-07-28", name_en: "H.M. King Vajiralongkorn's Birthday", name_th: "วันเฉลิมพระชนมพรรษาในหลวง ร.10", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2026-07-29", name_en: "Asalha Bucha Day", name_th: "วันอาสาฬหบูชา", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2026-07-30", name_en: "Khao Phansa (Buddhist Lent)", name_th: "วันเข้าพรรษา", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2026-08-12", name_en: "H.M. Queen Mother's Birthday / Mother's Day", name_th: "วันเฉลิมพระชนมพรรษาสมเด็จพระราชชนนี / วันแม่", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2026-10-13", name_en: "Passing of King Bhumibol Memorial Day", name_th: "วันคล้ายวันสวรรคต ร.9", impact: "national-holiday", crowd_impact: "low" },
  { date: "2026-10-23", name_en: "Chulalongkorn Day", name_th: "วันปิยมหาราช", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2026-11-24", name_en: "Loy Krathong", name_th: "วันลอยกระทง", impact: "cultural-festival", crowd_impact: "high", notes: "Lantern festival — Sukhothai, Chiang Mai (Yi Peng), Bangkok riverside are packed." },
  { date: "2026-12-05", name_en: "H.M. King Bhumibol's Birthday / Father's Day", name_th: "วันเฉลิมพระชนมพรรษา ร.9 / วันพ่อ", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2026-12-10", name_en: "Constitution Day", name_th: "วันรัฐธรรมนูญ", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2026-12-31", name_en: "New Year's Eve", name_th: "วันสิ้นปี", impact: "national-holiday", crowd_impact: "high", notes: "Domestic travel peak — beaches and ski-slope-substitutes (Khao Yai, Doi Inthanon) sold out." },
];

const HOLIDAYS_2027: ThaiHoliday[] = [
  { date: "2027-01-01", name_en: "New Year's Day", name_th: "วันขึ้นปีใหม่", impact: "national-holiday", crowd_impact: "high" },
  { date: "2027-02-06", name_en: "Chinese New Year", name_th: "ตรุษจีน", impact: "cultural-festival", crowd_impact: "medium" },
  { date: "2027-02-21", name_en: "Makha Bucha Day", name_th: "วันมาฆบูชา", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2027-04-06", name_en: "Chakri Memorial Day", name_th: "วันจักรี", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2027-04-13", name_en: "Songkran Festival", name_th: "วันสงกรานต์", impact: "national-holiday", crowd_impact: "high" },
  { date: "2027-04-14", name_en: "Songkran Festival", name_th: "วันสงกรานต์", impact: "national-holiday", crowd_impact: "high" },
  { date: "2027-04-15", name_en: "Songkran Festival", name_th: "วันสงกรานต์", impact: "national-holiday", crowd_impact: "high" },
  { date: "2027-05-01", name_en: "National Labour Day", name_th: "วันแรงงานแห่งชาติ", impact: "national-holiday", crowd_impact: "low" },
  { date: "2027-05-04", name_en: "Coronation Day", name_th: "วันฉัตรมงคล", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2027-05-21", name_en: "Visakha Bucha Day", name_th: "วันวิสาขบูชา", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2027-06-03", name_en: "H.M. Queen Suthida's Birthday", name_th: "วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี", impact: "national-holiday", crowd_impact: "low" },
  { date: "2027-07-19", name_en: "Asalha Bucha Day", name_th: "วันอาสาฬหบูชา", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2027-07-20", name_en: "Khao Phansa (Buddhist Lent)", name_th: "วันเข้าพรรษา", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2027-07-28", name_en: "H.M. King Vajiralongkorn's Birthday", name_th: "วันเฉลิมพระชนมพรรษาในหลวง ร.10", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2027-08-12", name_en: "H.M. Queen Mother's Birthday / Mother's Day", name_th: "วันเฉลิมพระชนมพรรษาสมเด็จพระราชชนนี / วันแม่", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2027-10-13", name_en: "Passing of King Bhumibol Memorial Day", name_th: "วันคล้ายวันสวรรคต ร.9", impact: "national-holiday", crowd_impact: "low" },
  { date: "2027-10-23", name_en: "Chulalongkorn Day", name_th: "วันปิยมหาราช", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2027-11-13", name_en: "Loy Krathong", name_th: "วันลอยกระทง", impact: "cultural-festival", crowd_impact: "high" },
  { date: "2027-12-05", name_en: "H.M. King Bhumibol's Birthday / Father's Day", name_th: "วันเฉลิมพระชนมพรรษา ร.9 / วันพ่อ", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2027-12-10", name_en: "Constitution Day", name_th: "วันรัฐธรรมนูญ", impact: "national-holiday", crowd_impact: "medium" },
  { date: "2027-12-31", name_en: "New Year's Eve", name_th: "วันสิ้นปี", impact: "national-holiday", crowd_impact: "high" },
];

const ALL_HOLIDAYS: ThaiHoliday[] = [...HOLIDAYS_2026, ...HOLIDAYS_2027].sort(
  (a, b) => a.date.localeCompare(b.date)
);

/**
 * Return holidays that fall within a contiguous date range, inclusive.
 * Both bounds are YYYY-MM-DD strings.
 */
export function holidaysInRange(
  startISO: string,
  endISO: string
): ThaiHoliday[] {
  return ALL_HOLIDAYS.filter((h) => h.date >= startISO && h.date <= endISO);
}

/**
 * Compute the end date by adding (nights - 1) days to start. We use this so a
 * 3-day trip starting Mon covers Mon/Tue/Wed.
 */
export function tripEndDate(startISO: string, days: number): string {
  const d = new Date(startISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + Math.max(days - 1, 0));
  return d.toISOString().slice(0, 10);
}
