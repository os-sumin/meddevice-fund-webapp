import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const runtime = "nodejs";
export const maxDuration = 60;

const LABELS: Record<string, string> = {
  fund: "펀드명", region: "구분", authority: "소관", year: "연도", size: "규모",
  funding_structure: "재원구조", risk_sharing: "리스크분담", governance: "거버넌스",
  gov_type: "유형", mandate: "주목적 투자의무", term_exit: "존속·회수",
  multiplier: "승수", meddevice_implication: "의료기기 시사점", source: "출처",
  category: "구분", metric: "지표", value: "값", unit: "단위",
  source_org: "출처기관", url: "URL", thesis: "논거 연결", note: "비고",
  name: "시나리오", gov: "정부출자", private: "민간출자", total: "총 결성",
  first_loss: "first-loss", first_loss_pct: "first-loss %", private_cover: "민간커버",
};

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2);
  if (typeof v === "object") return "";
  return String(v);
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title: string = body.title || "결과";
    const format: string = body.format || "xlsx";
    const summary: string = body.summary || "";
    const sources: string[] = Array.isArray(body.sources) ? body.sources : [];
    const rows: Record<string, unknown>[] = Array.isArray(body.rows)
      ? body.rows.filter((r: unknown) => r && typeof r === "object")
      : [];

    const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).filter((c) =>
      rows.some((r) => r[c] !== null && r[c] !== undefined && typeof r[c] !== "object")
    );
    const today = new Date().toISOString().slice(0, 10);
    const fname = `${title}_${today}`;

    if (format === "doc") {
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font-family:'맑은 고딕',Malgun Gothic,sans-serif;font-size:10pt;line-height:1.6}
h1{font-size:16pt;border-bottom:2px solid #1F3864;padding-bottom:6px}
h2{font-size:12pt;color:#1F3864;margin-top:18pt}
table{border-collapse:collapse;width:100%;font-size:8.5pt}
th{background:#1F3864;color:#fff;border:1px solid #999;padding:5px;text-align:left}
td{border:1px solid #999;padding:5px;vertical-align:top}
.meta{color:#666;font-size:9pt}
</style></head><body>
<h1>${esc(title)}</h1>
<p class="meta">생성일: ${today} · EnF Advisor</p>
${summary ? `<h2>요약</h2><p>${esc(summary).replace(/\n/g, "<br>")}</p>` : ""}
${rows.length ? `<h2>결과 (${rows.length}건)</h2>
<table><tr>${cols.map((c) => `<th>${esc(LABELS[c] || c)}</th>`).join("")}</tr>
${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(cell(r[c]))}</td>`).join("")}</tr>`).join("")}
</table>` : ""}
${sources.length ? `<h2>출처 (${sources.length}건)</h2><ol>${sources
        .map((s) => `<li><a href="${esc(s)}">${esc(s)}</a></li>`)
        .join("")}</ol>` : ""}
</body></html>`;
      return new NextResponse("\ufeff" + html, {
        headers: {
          "content-type": "application/msword; charset=utf-8",
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fname)}.doc`,
        },
      });
    }

    // xlsx
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("결과");
    ws.columns = cols.map((c) => ({
      header: LABELS[c] || c,
      key: c,
      width: ["meddevice_implication", "thesis", "governance", "mandate", "size", "funding_structure"].includes(c) ? 34 : 16,
    }));
    ws.getRow(1).eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
      c.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 10 };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    ws.getRow(1).height = 26;
    rows.forEach((r) => {
      const o: Record<string, string> = {};
      cols.forEach((c) => (o[c] = cell(r[c])));
      const row = ws.addRow(o);
      row.eachCell((c) => {
        c.alignment = { vertical: "top", wrapText: true };
        c.font = { size: 10 };
      });
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
    if (cols.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

    if (summary || sources.length) {
      const ws2 = wb.addWorksheet("요약·출처");
      ws2.columns = [{ width: 100 }];
      if (summary) {
        ws2.addRow(["요약"]).font = { bold: true, size: 12 };
        const r = ws2.addRow([summary]);
        r.alignment = { wrapText: true, vertical: "top" };
        r.height = 120;
      }
      if (sources.length) {
        ws2.addRow([]);
        ws2.addRow([`출처 (${sources.length}건)`]).font = { bold: true, size: 12 };
        sources.forEach((s) => ws2.addRow([s]));
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buf as ArrayBuffer), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fname)}.xlsx`,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "export failed" },
      { status: 500 }
    );
  }
}