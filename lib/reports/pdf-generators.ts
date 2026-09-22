// NDNP MPA-MES — PDF Report Generators
// Uses jspdf + jspdf-autotable for client-side PDF generation
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type DateRange = { start: string; end: string }

const BRAND_COLOR: [number,number,number] = [13, 148, 136]   // teal
const DARK:        [number,number,number] = [7,  21,  36]    // dark bg
const TEXT:        [number,number,number] = [30, 58,  82]    // muted text
const LIGHT:       [number,number,number] = [240,248,255]    // light bg
const WHITE:       [number,number,number] = [255,255,255]

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function addHeader(doc: jsPDF, title: string, range: DateRange) {
  const w = doc.internal.pageSize.getWidth()

  // Dark header band
  doc.setFillColor(...DARK)
  doc.rect(0, 0, w, 28, 'F')

  // Teal accent stripe
  doc.setFillColor(...BRAND_COLOR)
  doc.rect(0, 28, w, 3, 'F')

  // Organisation name
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('NDNP MPA-MES', 14, 11)

  // Subtitle
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(160, 200, 220)
  doc.text('National Designated Natural Park — Marine Protected Area Management & Ecological System', 14, 17)

  // Report label on right
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...BRAND_COLOR)
  doc.text('OFFICIAL REPORT', w - 14, 10, { align: 'right' })
  doc.setTextColor(160, 200, 220)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(`Generated: ${formatDateTime(new Date().toISOString())}`, w - 14, 17, { align: 'right' })
  doc.text(`Period: ${formatDate(range.start)} — ${formatDate(range.end)}`, w - 14, 22, { align: 'right' })

  // Report title
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(title, 14, 42)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT)
  doc.text(`Reporting period: ${formatDate(range.start)} to ${formatDate(range.end)}`, 14, 50)
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()

  doc.setFillColor(...BRAND_COLOR)
  doc.rect(0, h - 10, w, 10, 'F')

  doc.setTextColor(...WHITE)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('NDNP MPA-MES | Confidential — For Management Use Only', 14, h - 3.5)
  doc.text(`Page ${pageNum} of ${totalPages}`, w - 14, h - 3.5, { align: 'right' })
}

function addSummaryTable(doc: jsPDF, yStart: number, stats: [string, string | number][]) {
  const rows = stats.map(([k, v]) => [k, String(v)])
  autoTable(doc, {
    startY: yStart,
    head: [['Metric', 'Value']],
    body: rows,
    margin: { left: 14, right: 14 },
    headStyles: { fillColor: BRAND_COLOR, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 9, textColor: DARK },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: { 0: { cellWidth: 120, fontStyle: 'bold' }, 1: { cellWidth: 60, halign: 'right' } },
    tableLineColor: [200, 220, 230],
    tableLineWidth: 0.3,
  })
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

// ──── PATROL OPERATIONS REPORT ────────────────────────────────────────────
export function generatePatrolReport(patrols: Record<string, unknown>[], range: DateRange): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  addHeader(doc, 'Patrol Operations Report', range)

  // Summary stats
  const totalPatrols   = patrols.length
  const activePatrols  = patrols.filter(p => p.is_active).length
  const completedP     = patrols.filter(p => !p.is_active).length
  const totalViolations = patrols.reduce((a, p) => a + (typeof p.violations === 'number' ? p.violations : 0), 0)
  const totalWarnings  = patrols.reduce((a, p) => a + (typeof p.warnings  === 'number' ? p.warnings  : 0), 0)
  const totalFuel      = patrols.reduce((a, p) => a + (typeof p.fuel_used_l === 'number' ? p.fuel_used_l : 0), 0)
  const boatCount      = patrols.filter(p => p.patrol_type === 'boat').length
  const footCount      = patrols.filter(p => p.patrol_type === 'foot').length
  const droneCount     = patrols.filter(p => p.patrol_type === 'drone').length

  const yAfterStats = addSummaryTable(doc, 58, [
    ['Total Patrols in Period',    totalPatrols],
    ['Completed Patrols',          completedP],
    ['Currently Active Patrols',   activePatrols],
    ['Boat Patrols',               boatCount],
    ['Foot Patrols',               footCount],
    ['Drone / Aerial Patrols',     droneCount],
    ['Total Violations Cited',     totalViolations],
    ['Total Warnings Issued',      totalWarnings],
    ['Total Fuel Consumed (L)',     totalFuel.toFixed(1)],
  ])

  // Detail table
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text('Patrol Log Detail', 14, yAfterStats + 10)

  const rows = patrols.map(p => {
    const profile = p.profiles as Record<string,string> | null
    const dur = p.end_time && p.start_time
      ? Math.round((new Date(p.end_time as string).getTime() - new Date(p.start_time as string).getTime()) / 60000)
      : null
    return [
      new Date(p.start_time as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      profile?.full_name ?? 'Unknown',
      String(p.patrol_type ?? '').toUpperCase(),
      String(p.sector ?? '—'),
      String(p.violations ?? 0),
      String(p.warnings ?? 0),
      dur !== null ? `${Math.floor(dur/60)}h ${dur%60}m` : 'Active',
      p.is_active ? 'Active' : 'Complete',
    ]
  })

  autoTable(doc, {
    startY: yAfterStats + 14,
    head: [['Date', 'Ranger', 'Type', 'Sector', 'Violations', 'Warnings', 'Duration', 'Status']],
    body: rows,
    margin: { left: 14, right: 14 },
    headStyles: { fillColor: BRAND_COLOR, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
    bodyStyles: { fontSize: 7, textColor: DARK },
    alternateRowStyles: { fillColor: LIGHT },
    tableLineColor: [200, 220, 230],
    tableLineWidth: 0.3,
  })

  // Final footer on last page
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    addFooter(doc, i, total)
  }
  return doc
}

// ──── WILDLIFE & CITIZEN SCIENCE REPORT ──────────────────────────────
export function generateWildlifeReport(reports: Record<string, unknown>[], range: DateRange): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  addHeader(doc, 'Wildlife Sightings & Incident Report', range)

  const sightings  = reports.filter(r => r.report_type === 'wildlife_sighting')
  const incidents  = reports.filter(r => r.report_type === 'environmental_incident')
  const approved   = reports.filter(r => r.validation_status === 'approved').length
  const pending    = reports.filter(r => r.validation_status === 'pending').length
  const rejected   = reports.filter(r => r.validation_status === 'rejected').length
  const highSev    = incidents.filter(r => typeof r.severity === 'number' && (r.severity as number) >= 4).length

  // Species breakdown
  const speciesMap: Record<string, number> = {}
  sightings.forEach(s => {
    const sp = typeof s.species_type === 'string' ? s.species_type : 'Unknown'
    speciesMap[sp] = (speciesMap[sp] ?? 0) + (typeof s.species_count === 'number' ? s.species_count : 1)
  })
  const topSpecies = Object.entries(speciesMap).sort((a,b) => b[1]-a[1]).slice(0, 5)

  const yAfterStats = addSummaryTable(doc, 58, [
    ['Total Citizen Science Reports',  reports.length],
    ['Wildlife Sightings',             sightings.length],
    ['Environmental Incidents',        incidents.length],
    ['High-Severity Incidents (4-5)',  highSev],
    ['Validated / Approved',           approved],
    ['Pending Validation',             pending],
    ['Rejected / Declined',            rejected],
    ['Top Sighted Species',            topSpecies[0] ? `${topSpecies[0][0]} (${topSpecies[0][1]})` : 'None'],
  ])

  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK)
  doc.text('Wildlife Sightings', 14, yAfterStats + 10)

  autoTable(doc, {
    startY: yAfterStats + 14,
    head: [['Date', 'Species', 'Count', 'Behaviour', 'GPS Lat', 'GPS Lng', 'Status']],
    body: sightings.map(s => [
      new Date(s.created_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      String(s.species_type ?? 'Unknown'),
      String(s.species_count ?? 1),
      String(s.behavior ?? '—'),
      typeof s.gps_lat === 'number' ? (s.gps_lat as number).toFixed(4) : '—',
      typeof s.gps_lng === 'number' ? (s.gps_lng as number).toFixed(4) : '—',
      String(s.validation_status ?? 'pending'),
    ]),
    margin: { left: 14, right: 14 },
    headStyles: { fillColor: [22, 163, 74], textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
    bodyStyles: { fontSize: 7, textColor: DARK },
    alternateRowStyles: { fillColor: LIGHT },
    tableLineColor: [200, 220, 230], tableLineWidth: 0.3,
  })

  const y2 = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK)
  doc.text('Environmental Incidents', 14, y2)

  autoTable(doc, {
    startY: y2 + 4,
    head: [['Date', 'Type', 'Severity', 'Description', 'GPS Lat', 'GPS Lng', 'Status']],
    body: incidents.map(i => [
      new Date(i.created_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      String(i.incident_type ?? 'Unknown'),
      `${i.severity ?? '?'}/5`,
      String(i.description ?? '—').slice(0, 50) + (String(i.description ?? '').length > 50 ? '...' : ''),
      typeof i.gps_lat === 'number' ? (i.gps_lat as number).toFixed(4) : '—',
      typeof i.gps_lng === 'number' ? (i.gps_lng as number).toFixed(4) : '—',
      String(i.validation_status ?? 'pending'),
    ]),
    margin: { left: 14, right: 14 },
    headStyles: { fillColor: [239, 68, 68], textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
    bodyStyles: { fontSize: 7, textColor: DARK },
    alternateRowStyles: { fillColor: [255, 245, 245] },
    tableLineColor: [200, 220, 230], tableLineWidth: 0.3,
  })

  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) { doc.setPage(i); addFooter(doc, i, total) }
  return doc
}

// ──── HERITAGE INSPECTION REPORT ──────────────────────────────────────
export function generateHeritageReport(
  assessments: Record<string, unknown>[],
  sites: Record<string, unknown>[],
  maintenance: Record<string, unknown>[],
  range: DateRange
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  addHeader(doc, 'Heritage Condition Inspection Report', range)

  const critical = sites.filter(s => s.current_condition === 1).length
  const poor     = sites.filter(s => s.current_condition === 2).length
  const fair     = sites.filter(s => s.current_condition === 3).length
  const good     = sites.filter(s => typeof s.current_condition === 'number' && (s.current_condition as number) >= 4).length
  const openMaint= maintenance.filter(m => m.status === 'open').length
  const critMaint= maintenance.filter(m => m.priority === 'critical').length

  const yAfterStats = addSummaryTable(doc, 58, [
    ['Total Heritage Sites (active)',     sites.length],
    ['Sites — Condition Critical (1/5)',  critical],
    ['Sites — Condition Poor (2/5)',      poor],
    ['Sites — Condition Fair (3/5)',      fair],
    ['Sites — Good / Excellent (4-5/5)', good],
    ['Total Assessments in Period',       assessments.length],
    ['Open Maintenance Items',            openMaint],
    ['Critical Priority Maintenance',     critMaint],
  ])

  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK)
  doc.text('Site Condition Summary', 14, yAfterStats + 10)

  const COND_LABEL: Record<number, string> = { 1:'Critical', 2:'Poor', 3:'Fair', 4:'Good', 5:'Excellent' }
  autoTable(doc, {
    startY: yAfterStats + 14,
    head: [['Site Code', 'Site Name', 'Type', 'Condition', 'Last Assessed']],
    body: sites.map(s => [
      String(s.site_code ?? '—'),
      String(s.name ?? '—'),
      String(s.site_type ?? '—').replace(/_/g,' '),
      `${s.current_condition ?? '?'}/5 — ${COND_LABEL[s.current_condition as number] ?? 'Unknown'}`,
      s.last_assessed_at ? new Date(s.last_assessed_at as string).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : 'Not assessed',
    ]),
    margin: { left: 14, right: 14 },
    headStyles: { fillColor: [245, 158, 11], textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: DARK },
    alternateRowStyles: { fillColor: [255, 253, 235] },
    tableLineColor: [200, 220, 230], tableLineWidth: 0.3,
  })

  const y2 = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK)
  doc.text('Assessment Records in Period', 14, y2)

  autoTable(doc, {
    startY: y2 + 4,
    head: [['Date', 'Site', 'Assessor', 'Overall Condition', 'Key Issues']],
    body: assessments.map(a => {
      const hs = a.heritage_sites as Record<string,string> | null
      const issues = Array.isArray(a.element_issues) ? (a.element_issues as string[]).slice(0,2).join('; ') : '—'
      return [
        new Date(a.assessed_at as string).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }),
        hs?.name ?? '—',
        String(a.assessor_name ?? '—'),
        `${a.overall_condition}/5 — ${COND_LABEL[a.overall_condition as number] ?? ''}`,
        issues.slice(0, 60) + (issues.length > 60 ? '...' : ''),
      ]
    }),
    margin: { left: 14, right: 14 },
    headStyles: { fillColor: BRAND_COLOR, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
    bodyStyles: { fontSize: 7, textColor: DARK },
    alternateRowStyles: { fillColor: LIGHT },
    tableLineColor: [200, 220, 230], tableLineWidth: 0.3,
  })

  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) { doc.setPage(i); addFooter(doc, i, total) }
  return doc
}

// ──── WATER QUALITY REPORT ──────────────────────────────────────────────────
export function generateWaterQualityReport(readings: Record<string, unknown>[], range: DateRange): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  addHeader(doc, 'Water Quality Compliance Report', range)

  const passing = readings.filter(r => r.compliance_status === 'pass').length
  const warning = readings.filter(r => r.compliance_status === 'warning').length
  const failing = readings.filter(r => r.compliance_status === 'fail').length
  const noData  = readings.filter(r => !r.compliance_status).length

  const avgPh   = readings.filter(r => typeof r.ph === 'number').length > 0
    ? (readings.reduce((a, r) => a + (typeof r.ph === 'number' ? r.ph : 0), 0) / readings.filter(r => typeof r.ph === 'number').length).toFixed(2)
    : 'N/A'
  const avgDo   = readings.filter(r => typeof r.do_mgl === 'number').length > 0
    ? (readings.reduce((a, r) => a + (typeof r.do_mgl === 'number' ? r.do_mgl : 0), 0) / readings.filter(r => typeof r.do_mgl === 'number').length).toFixed(2)
    : 'N/A'
  const avgTemp = readings.filter(r => typeof r.temperature_c === 'number').length > 0
    ? (readings.reduce((a, r) => a + (typeof r.temperature_c === 'number' ? r.temperature_c : 0), 0) / readings.filter(r => typeof r.temperature_c === 'number').length).toFixed(1)
    : 'N/A'
  const compliance = readings.length > 0 ? `${((passing / readings.length) * 100).toFixed(1)}%` : 'N/A'

  const yAfterStats = addSummaryTable(doc, 58, [
    ['Total Readings in Period',        readings.length],
    ['Compliant Readings (Pass)',        passing],
    ['Warning-Level Readings',          warning],
    ['Exceedance Readings (Fail)',       failing],
    ['Readings Without Status',         noData],
    ['Overall Compliance Rate',         compliance],
    ['Average pH (acceptable: 7.8–8.4)', avgPh],
    ['Average DO (acceptable: ≥5 mg/L)', `${avgDo} mg/L`],
    ['Average Temperature',             `${avgTemp}°C`],
  ])

  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK)
  doc.text('Readings Detail', 14, yAfterStats + 10)

  const STATUS_COLOR: Record<string, [number,number,number]> = {
    pass: [22, 163, 74], warning: [245, 158, 11], fail: [239, 68, 68]
  }

  autoTable(doc, {
    startY: yAfterStats + 14,
    head: [['Date', 'Station', 'pH', 'DO (mg/L)', 'Temp (°C)', 'Salinity (ppt)', 'Compliance', 'Bottle ID']],
    body: readings.map(r => {
      const ms = r.monitoring_stations as Record<string,string> | null
      return [
        new Date(r.sampled_at as string).toLocaleDateString('en-GB', { day:'numeric', month:'short' }),
        ms?.station_code ?? '—',
        typeof r.ph === 'number' ? (r.ph as number).toFixed(2) : '—',
        typeof r.do_mgl === 'number' ? (r.do_mgl as number).toFixed(1) : '—',
        typeof r.temperature_c === 'number' ? `${(r.temperature_c as number).toFixed(1)}°C` : '—',
        typeof r.salinity_ppt === 'number' ? (r.salinity_ppt as number).toFixed(1) : '—',
        String(r.compliance_status ?? 'N/A').toUpperCase(),
        String(r.sample_bottle_id ?? '—'),
      ]
    }),
    margin: { left: 14, right: 14 },
    headStyles: { fillColor: [8, 145, 178], textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
    bodyStyles: { fontSize: 7, textColor: DARK },
    alternateRowStyles: { fillColor: [240, 249, 255] },
    tableLineColor: [200, 220, 230], tableLineWidth: 0.3,
    didParseCell: (data) => {
      if (data.column.index === 6 && data.row.raw) {
        const status = String((data.row.raw as string[])[6] ?? '').toLowerCase()
        if (STATUS_COLOR[status]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(data.cell.styles as any).textColor = STATUS_COLOR[status]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(data.cell.styles as any).fontStyle = 'bold'
        }
      }
    },
  })

  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) { doc.setPage(i); addFooter(doc, i, total) }
  return doc
}



