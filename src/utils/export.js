export const exportExcel = (rows, filename, deptMap = {}) => {
  const SC = {
    "On Track":    { bg: "#dcfce7", fg: "#15803d" },
    "At Risk":     { bg: "#fef9c3", fg: "#854d0e" },
    "Delayed":     { bg: "#fee2e2", fg: "#991b1b" },
    "Completed":   { bg: "#dbeafe", fg: "#1e40af" },
    "Not Started": { bg: "#f3f4f6", fg: "#4b5563" },
  };
  const RC = {
    "Critical": { bg: "#fee2e2", fg: "#991b1b" },
    "High":     { bg: "#fef3c7", fg: "#92400e" },
    "Medium":   { bg: "#fef9c3", fg: "#854d0e" },
    "Low":      { bg: "#dcfce7", fg: "#15803d" },
  };

  const td = (val, style = "") =>
    `<td style="border:1px solid #dce8dc;padding:7px 12px;font-size:12px;font-family:'Segoe UI',sans-serif;vertical-align:middle;${style}">${val ?? "—"}</td>`;
  const th = (val) =>
    `<td style="background:#003932;color:#ffffff;font-weight:700;padding:10px 14px;font-size:12px;font-family:'Segoe UI',sans-serif;border:1px solid #00524a;white-space:nowrap;">${val}</td>`;

  const HEADERS = ["Code","Project Name","Department","PM","Sponsor","Phase","Status","Progress","Risk","Budget (SAR)","Actual Cost (SAR)","Budget Status","Gate","Start Date","Planned End"];
  const COL_COUNT = HEADERS.length;

  const titleRow  = `<tr><td colspan="${COL_COUNT}" style="background:#003932;color:#00ffb3;font-size:16px;font-weight:900;padding:14px 18px;font-family:'Segoe UI',sans-serif;border:none;letter-spacing:0.02em;">PMO Portal — Project Export</td></tr>`;
  const dateRow   = `<tr><td colspan="${COL_COUNT}" style="background:#003932;color:#a1c9b8;font-size:11px;padding:4px 18px 12px;font-family:'Segoe UI',sans-serif;border:none;">Generated ${new Date().toLocaleDateString("en-US",{dateStyle:"full"})} · ${rows.length} project${rows.length!==1?"s":""}</td></tr>`;
  const spaceRow  = `<tr><td colspan="${COL_COUNT}" style="height:8px;border:none;background:#f4f6f4;"></td></tr>`;
  const headerRow = `<tr>${HEADERS.map(h => th(h)).join("")}</tr>`;

  const dataRows = rows.map((p, i) => {
    const sc    = SC[p.status]    || {};
    const rc    = RC[p.riskLevel] || {};
    const rowBg = i % 2 === 0 ? "#ffffff" : "#f9fbf9";
    const b     = `background:${rowBg};`;
    const budgetOk = p.budgetStatus !== "Over Budget";
    return `<tr>
      ${td(p.code,        b + "font-weight:700;color:#003932;")}
      ${td(p.name,        b + "font-weight:600;")}
      ${td(deptMap[p.deptId] || p.deptId, b)}
      ${td(p.pm,          b)}
      ${td(p.sponsor,     b)}
      ${td(p.phase,       b)}
      ${td(p.status,      `background:${sc.bg||rowBg};color:${sc.fg||"#000"};font-weight:700;text-align:center;`)}
      ${td((p.progress||0)+"%", b + "text-align:center;font-weight:700;")}
      ${td(p.riskLevel,   `background:${rc.bg||rowBg};color:${rc.fg||"#000"};font-weight:700;text-align:center;`)}
      ${td((p.budget||0).toLocaleString(),     b + "text-align:right;")}
      ${td((p.actualCost||0).toLocaleString(), b + "text-align:right;")}
      ${td(p.budgetStatus, b + `color:${budgetOk?"#15803d":"#991b1b"};font-weight:700;`)}
      ${td(p.gate,        b)}
      ${td(p.startDate||"—", b)}
      ${td(p.plannedEnd||"—", b)}
    </tr>`;
  }).join("");

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="UTF-8">
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
  <x:ExcelWorksheet><x:Name>Projects</x:Name></x:ExcelWorksheet>
  </x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
  </head><body>
  <table style="border-collapse:collapse;">
    ${titleRow}${dateRow}${spaceRow}${headerRow}${dataRows}
  </table>
  </body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
};
