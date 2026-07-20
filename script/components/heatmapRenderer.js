class HeatmapRenderer {
  static monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  static getMonthUnits(selectedYear = 'all') {
    const monthUnits = [];

    if (selectedYear === 'all') {
      const now = new Date();
      const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      for (let i = 11; i >= 0; i -= 1) {
        const d = new Date(base);
        d.setUTCMonth(base.getUTCMonth() - i);
        monthUnits.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
      }
      return monthUnits;
    }

    const year = Number(selectedYear);
    if (!Number.isFinite(year)) {
      return this.getMonthUnits('all');
    }

    for (let month = 0; month < 12; month += 1) {
      monthUnits.push({ year, month });
    }

    return monthUnits;
  }

  static visibleDateKeys(selectedYear = 'all') {
    const keys = [];

    this.getMonthUnits(selectedYear).forEach(({ year, month }) => {
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      for (let day = 1; day <= daysInMonth; day += 1) {
        keys.push(new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10));
      }
    });

    return keys;
  }

  static renderMonthlyGrid({
    container,
    selectedYear = 'all',
    dataByDate = {},
    getColor,
    getTitle
  }) {
    if (!container) return;

    container.innerHTML = '';
    const visibleKeys = new Set(this.visibleDateKeys(selectedYear));
    const visibleValues = Object.entries(dataByDate || {})
      .filter(([key]) => visibleKeys.has(key))
      .map(([, value]) => value);
    const context = { visibleValues, selectedYear };

    this.getMonthUnits(selectedYear).forEach(({ year, month }) => {
      const start = new Date(Date.UTC(year, month, 1));
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const mondayFirstOffset = (start.getUTCDay() + 6) % 7;
      const columns = 6;
      const totalCells = columns * 7;

      const monthCard = document.createElement('div');
      monthCard.className = 'heat-month-unit';

      const title = document.createElement('div');
      title.className = 'heat-month-title';
      title.textContent = this.monthNames[month];
      monthCard.appendChild(title);

      const monthGrid = document.createElement('div');
      monthGrid.className = 'heat-month-grid';
      monthGrid.style.gridTemplateColumns = `repeat(${columns}, var(--heat-size))`;
      monthGrid.style.gridAutoRows = 'var(--heat-size)';

      for (let idx = 0; idx < totalCells; idx += 1) {
        const dayOfMonth = idx - mondayFirstOffset + 1;
        const cell = document.createElement('div');
        cell.className = 'heat';

        if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
          cell.classList.add('heat-empty');
          cell.title = '';
          monthGrid.appendChild(cell);
          continue;
        }

        const key = new Date(Date.UTC(year, month, dayOfMonth)).toISOString().slice(0, 10);
        const value = dataByDate?.[key];
        cell.style.background = getColor(value, { ...context, key });
        cell.title = getTitle ? getTitle(value, { ...context, key }) : key;
        monthGrid.appendChild(cell);
      }

      monthCard.appendChild(monthGrid);
      container.appendChild(monthCard);
    });
  }
}

window.HeatmapRenderer = HeatmapRenderer;
