function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizedRows(data = {}) {
  if (Array.isArray(data.rows)) return data.rows;
  const labels = data.labels || [];
  const datasets = data.datasets || [];

  if (!datasets.length) {
    return labels.map((label, index) => ({ label, value: data.values?.[index] ?? null }));
  }

  return labels.map((label, index) => {
    const row = { label };
    datasets.forEach((dataset) => {
      row[dataset.name || dataset.label || 'value'] = dataset.values?.[index] ?? dataset.data?.[index] ?? null;
    });
    return row;
  });
}

export async function exportCsv(data, filename) {
  const { csvFormat } = await import('d3-dsv');
  const rows = normalizedRows(data);
  const csv = rows.length ? csvFormat(rows) : '';
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
}

export function exportRawData(data, filename) {
  downloadBlob(
    new Blob([JSON.stringify(data || {}, null, 2)], { type: 'application/json;charset=utf-8' }),
    filename
  );
}

export function exportChartImage(chart, filename, type = 'png') {
  if (!chart?.getDataURL) return;
  const dataUrl = chart.getDataURL({ type, pixelRatio: 2, backgroundColor: '#070b17' });
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export function exportPdf(container, filename) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=800');
  if (!printWindow) return;
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${filename}</title>
        <style>
          body { margin: 0; background: #070b17; color: #e5e7eb; font-family: Inter, system-ui, sans-serif; }
          .sheet { padding: 24px; }
          canvas, svg { max-width: 100%; }
        </style>
      </head>
      <body><div class="sheet">${container?.outerHTML || ''}</div></body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}
