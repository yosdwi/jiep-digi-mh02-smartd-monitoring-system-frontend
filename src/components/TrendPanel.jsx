export default function TrendPanel() {
  return (
    <>
    <section className="card trend-card">
      <div className="head">
        <div className="title">
          Trend Performa
        </div>
      </div>
      <div className="trend-body">
        <div className="trend-toolbar">
          <button className="metric-toggle active" type="button" data-trend="ritase">
            Ritase
          </button>
          <button className="metric-toggle active" type="button" data-trend="cycle">
            Avg Cycle Time
          </button>
          <button className="metric-toggle" type="button" data-trend="loadedDistance">
            Jarak Muatan
          </button>
          <button className="metric-toggle" type="button" data-trend="emptyDistance">
            Jarak Kosongan
          </button>
          <button className="metric-toggle" type="button" data-trend="speed">
            Actual Avg Speed
          </button>
          <button className="metric-toggle" type="button" data-trend="stop">
            Stop Muatan
          </button>
        </div>
        <div id="trendContent" className="trend-wrap">
          <div className="trend-readout">
            <strong id="trendValue">
              —
            </strong>
            <span id="trendTime">
              —
            </span>
          </div>
          <div id="trendLegend" className="trend-legend"></div>
          <svg id="trendSvg" className="trend-svg" viewBox="0 0 1200 220" preserveAspectRatio="none" role="img" aria-label="Trend performa per jam"></svg>
          <div id="trendTooltip" className="trend-tooltip hidden"></div>
          <div className="trend-brush-note">
            <span id="trendWindowLabel">
              Seluruh rentang
            </span>
          </div>
        </div>
        <div id="trendEmpty" className="trend-empty hidden">
          Tidak ada data trend pada rentang ini.
        </div>
      </div>
    </section>
    </>
  );
}
