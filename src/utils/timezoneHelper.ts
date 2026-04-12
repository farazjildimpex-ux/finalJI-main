export const IST_TIMEZONE = 'Asia/Kolkata';
export const IST_UTC_OFFSET = 5.5 * 60 * 60 * 1000;

export function convertISTToUTC(dateString: string, timeString: string): Date {
  const istDate = new Date(`${dateString}T${timeString}:00`);

  const istTime = istDate.getTime();
  const utcTime = istTime - IST_UTC_OFFSET;

  return new Date(utcTime);
}

export function getUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function formatISTTime(date: Date): string {
  const offset = IST_UTC_OFFSET;
  const istDate = new Date(date.getTime() + offset);
  return istDate.toISOString();
}
