"""PDF executive summary export — production quality."""
import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)

from app.schemas.analytics import AnalysisResult, Recommendation, SimulationResult

# ── Color palette ────────────────────────────────────────────────────────────
INDIGO = colors.HexColor("#4f46e5")
INDIGO_LIGHT = colors.HexColor("#e0e7ff")
EMERALD = colors.HexColor("#059669")
EMERALD_LIGHT = colors.HexColor("#d1fae5")
RED = colors.HexColor("#dc2626")
RED_LIGHT = colors.HexColor("#fee2e2")
AMBER = colors.HexColor("#d97706")
AMBER_LIGHT = colors.HexColor("#fef3c7")
SLATE_100 = colors.HexColor("#f1f5f9")
SLATE_200 = colors.HexColor("#e2e8f0")
SLATE_600 = colors.HexColor("#475569")
SLATE_800 = colors.HexColor("#1e293b")
WHITE = colors.white


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("Title", fontSize=22, textColor=SLATE_800, spaceAfter=4, leading=28, fontName="Helvetica-Bold"),
        "subtitle": ParagraphStyle("Sub", fontSize=11, textColor=SLATE_600, spaceAfter=16, leading=14),
        "h2": ParagraphStyle("H2", fontSize=14, textColor=SLATE_800, spaceBefore=18, spaceAfter=8, fontName="Helvetica-Bold"),
        "h3": ParagraphStyle("H3", fontSize=11, textColor=SLATE_600, spaceBefore=10, spaceAfter=6, fontName="Helvetica-Bold"),
        "body": ParagraphStyle("Body", fontSize=10, textColor=SLATE_800, leading=15, spaceAfter=6),
        "small": ParagraphStyle("Small", fontSize=9, textColor=SLATE_600, leading=13),
        "tag_high": ParagraphStyle("TagH", fontSize=9, textColor=RED, fontName="Helvetica-Bold"),
        "tag_med": ParagraphStyle("TagM", fontSize=9, textColor=AMBER, fontName="Helvetica-Bold"),
        "tag_low": ParagraphStyle("TagL", fontSize=9, textColor=EMERALD, fontName="Helvetica-Bold"),
        "footer": ParagraphStyle("Footer", fontSize=8, textColor=SLATE_600, alignment=TA_CENTER),
    }


def _kpi_table(analysis: AnalysisResult, risk: dict | None) -> Table:
    s = _styles()
    risk_level = risk.get("overall_risk", "N/A").upper() if risk else "N/A"
    risk_score = risk.get("risk_score", 0) if risk else 0

    data = [
        ["Metric", "Value", "Status"],
        ["Cycle Time", f"{analysis.cycle_time_minutes:.1f} min", "—"],
        ["Throughput", f"{analysis.throughput_per_hour:.3f} /hr", "—"],
        ["Daily Cost", f"₹{analysis.cost_breakdown.daily_cost:,.2f}", "—"],
        ["Monthly Cost", f"₹{analysis.cost_breakdown.monthly_cost:,.2f}", "—"],
        ["SLA Risk Score", f"{analysis.sla_risk_score:.0f} / 100",
         "⚠ High" if analysis.sla_risk_score > 50 else "✓ OK"],
        ["Overall Risk", risk_level, f"Score: {risk_score}/100"],
    ]
    if analysis.cost_breakdown.delay_loss:
        data.append(["Delay Loss/Day", f"₹{analysis.cost_breakdown.delay_loss:,.2f}", "Revenue impact"])
    if analysis.cost_breakdown.revenue_impact:
        data.append(["Revenue Potential", f"₹{analysis.cost_breakdown.revenue_impact:,.2f}", "Per day"])

    t = Table(data, colWidths=[2.2 * inch, 2.2 * inch, 2.0 * inch])
    style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, SLATE_100]),
        ("GRID", (0, 0), (-1, -1), 0.5, SLATE_200),
        ("TOPPADDING", (0, 1), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ])
    t.setStyle(style)
    return t


def _bottleneck_table(analysis: AnalysisResult) -> Table:
    if not analysis.bottlenecks:
        return None

    data = [["Step", "Type", "Sev.", "Detail"]]
    for b in analysis.bottlenecks:
        type_label = b.type.value.title()
        sev_label = f"{b.severity * 100:.0f}%"
        data.append([b.step_name, type_label, sev_label, b.message])

    t = Table(data, colWidths=[1.5 * inch, 0.9 * inch, 0.6 * inch, 3.4 * inch])
    style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), RED),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [RED_LIGHT, WHITE]),
        ("GRID", (0, 0), (-1, -1), 0.5, SLATE_200),
        ("TOPPADDING", (0, 1), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("WORDWRAP", (3, 1), (3, -1), True),
    ])
    t.setStyle(style)
    return t


def _simulation_table(sim: SimulationResult) -> Table:
    improvement = "+" if sim.time_saved_minutes >= 0 else ""
    cost_dir = "-" if sim.cost_saved_daily >= 0 else "+"

    data = [
        ["Metric", "Before", "After", "Change"],
        ["Cycle Time (min)", f"{sim.original_cycle_time:.1f}", f"{sim.new_cycle_time:.1f}",
         f"-{abs(sim.time_saved_minutes):.1f} min"],
        ["Daily Cost (₹)", f"₹{sim.original_daily_cost:,.0f}", f"₹{sim.new_daily_cost:,.0f}",
         f"-₹{abs(sim.cost_saved_daily):,.0f}"],
        ["Throughput (/hr)", f"{sim.original_throughput:.3f}", f"{sim.new_throughput:.3f}", "↑"],
        ["Annual Savings", "—", "—", f"₹{sim.annual_savings:,.0f}"],
    ]
    if sim.roi is not None:
        data.append(["ROI", "—", "—", f"{sim.roi * 100:.0f}%"])
    if sim.payback_months is not None:
        data.append(["Payback Period", "—", "—", f"{sim.payback_months:.1f} months"])

    t = Table(data, colWidths=[2.0 * inch, 1.5 * inch, 1.5 * inch, 1.4 * inch])
    style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), EMERALD),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [EMERALD_LIGHT, WHITE]),
        ("GRID", (0, 0), (-1, -1), 0.5, SLATE_200),
        ("TOPPADDING", (0, 1), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (3, 1), (3, -1), EMERALD),
        ("FONTNAME", (3, 1), (3, -1), "Helvetica-Bold"),
    ])
    t.setStyle(style)
    return t


def _per_step_cost_table(analysis: AnalysisResult) -> Table:
    costs = sorted(analysis.cost_breakdown.per_step_costs.items(), key=lambda x: x[1], reverse=True)
    total = analysis.cost_breakdown.daily_cost
    data = [["Step", "Daily Cost (₹)", "% of Total"]]
    for name, cost in costs:
        pct = (cost / total * 100) if total > 0 else 0
        data.append([name, f"₹{cost:,.2f}", f"{pct:.1f}%"])
    data.append(["TOTAL", f"₹{total:,.2f}", "100%"])

    t = Table(data, colWidths=[2.5 * inch, 2.0 * inch, 1.9 * inch])
    style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), SLATE_600),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, SLATE_100]),
        ("BACKGROUND", (0, -1), (-1, -1), INDIGO_LIGHT),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, SLATE_200),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ])
    t.setStyle(style)
    return t


def generate_executive_summary_pdf(
    process_name: str,
    process_description: str | None,
    analysis: AnalysisResult,
    recommendations: list[Recommendation],
    simulation_result: SimulationResult | None = None,
    risk: dict | None = None,
) -> bytes:
    """Generate a professional PDF executive summary."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.8 * cm,
        leftMargin=1.8 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )
    s = _styles()
    story = []

    # ── Header ───────────────────────────────────────────────────────────────
    story.append(Paragraph("Process Optimization", s["title"]))
    story.append(Paragraph("Executive Summary Report", s["subtitle"]))
    story.append(HRFlowable(width="100%", thickness=2, color=INDIGO, spaceAfter=14))

    # Meta
    now = datetime.now().strftime("%d %B %Y, %H:%M")
    meta_data = [[
        Paragraph(f"<b>Process:</b> {process_name}", s["body"]),
        Paragraph(f"<b>Generated:</b> {now}", s["body"]),
    ]]
    if process_description:
        meta_data.append([Paragraph(f"<b>Description:</b> {process_description}", s["small"]), Paragraph("", s["body"])])
    meta_t = Table(meta_data, colWidths=[3.8 * inch, 2.6 * inch])
    meta_t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(meta_t)
    story.append(Spacer(1, 12))

    # ── Critical Path ────────────────────────────────────────────────────────
    if analysis.critical_path:
        cp_str = " → ".join(analysis.critical_path)
        story.append(Paragraph(f"<b>Critical Path:</b> {cp_str}", s["small"]))
        story.append(Spacer(1, 10))

    # ── KPI Summary ──────────────────────────────────────────────────────────
    story.append(Paragraph("1. Key Performance Indicators", s["h2"]))
    story.append(_kpi_table(analysis, risk))
    story.append(Spacer(1, 14))

    # ── Bottlenecks ──────────────────────────────────────────────────────────
    story.append(Paragraph("2. Identified Bottlenecks", s["h2"]))
    bt = _bottleneck_table(analysis)
    if bt:
        story.append(bt)
    else:
        story.append(Paragraph("✓ No bottlenecks detected. Process is operating efficiently.", s["body"]))
    story.append(Spacer(1, 14))

    # ── Financial Impact ─────────────────────────────────────────────────────
    story.append(Paragraph("3. Financial Impact", s["h2"]))
    story.append(_per_step_cost_table(analysis))
    story.append(Spacer(1, 8))
    monthly = analysis.cost_breakdown.monthly_cost
    story.append(Paragraph(
        f"The process costs <b>₹{analysis.cost_breakdown.daily_cost:,.2f}</b> per day "
        f"(<b>₹{monthly:,.2f}/month</b>). "
        + (f"Estimated delay-related revenue impact: <b>₹{analysis.cost_breakdown.delay_loss:,.2f}/day</b>."
           if analysis.cost_breakdown.delay_loss else ""),
        s["body"],
    ))
    story.append(Spacer(1, 14))

    # ── Simulation Results ───────────────────────────────────────────────────
    if simulation_result:
        story.append(Paragraph("4. Optimization Scenario Results", s["h2"]))
        story.append(_simulation_table(simulation_result))
        story.append(Spacer(1, 14))

    # ── Recommendations ──────────────────────────────────────────────────────
    sec_num = 5 if simulation_result else 4
    story.append(Paragraph(f"{sec_num}. Recommendations", s["h2"]))
    if recommendations:
        priority_colors = {"high": RED, "medium": AMBER, "low": EMERALD}
        for i, r in enumerate(recommendations, 1):
            pc = priority_colors.get(r.priority, SLATE_600)
            items = [
                [
                    Paragraph(f"<b>{i}. {r.title}</b>", s["body"]),
                    Paragraph(f"[{r.priority.upper()}]", ParagraphStyle(
                        "badge", fontSize=9, textColor=pc, fontName="Helvetica-Bold"
                    )),
                ]
            ]
            if r.step_name:
                items.append([Paragraph(f"Step: <i>{r.step_name}</i>", s["small"]), Paragraph("", s["small"])])
            items.append([Paragraph(r.description, s["small"]), Paragraph("", s["small"])])
            items.append([Paragraph(f"→ {r.suggested_action}", ParagraphStyle(
                "action", fontSize=9, textColor=INDIGO, leading=13
            )), Paragraph("", s["small"])])

            rec_t = Table(items, colWidths=[5.5 * inch, 0.9 * inch])
            rec_t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), SLATE_100),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("LINEBELOW", (0, -1), (-1, -1), 0.5, SLATE_200),
            ]))
            story.append(KeepTogether([rec_t, Spacer(1, 6)]))
    else:
        story.append(Paragraph("✓ No specific recommendations at this time.", s["body"]))

    # ── Footer ───────────────────────────────────────────────────────────────
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=SLATE_200, spaceAfter=8))
    story.append(Paragraph(
        f"Generated by Process Optimization & Impact Simulation Engine • {now}",
        s["footer"],
    ))

    doc.build(story)
    return buffer.getvalue()
