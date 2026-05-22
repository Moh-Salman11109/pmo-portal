export const TODAY = new Date().toISOString().split("T")[0];

export const daysSince = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((new Date() - d) / 86_400_000);
};
