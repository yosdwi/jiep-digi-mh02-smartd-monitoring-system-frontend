export default function KpiRow() {
  return (
    <>
    <section className="metrics">
      <div className="card metric">
        <div id="kUnits" className="k">
          Total Unit
        </div>
        <div id="mUnits" className="v">
          —
        </div>
      </div>
      <div className="card metric">
        <div id="kRitase" className="k">
          Total Ritase
        </div>
        <div id="mRitase" className="v">
          —
        </div>
      </div>
      <div className="card metric">
        <div id="kCycle" className="k">
          Avg Cycle Time
        </div>
        <div id="mCycle" className="v">
          —
        </div>
      </div>
      <div className="card metric">
        <div id="kLoaded" className="k">
          Avg Jarak Muatan
        </div>
        <div id="mLoaded" className="v">
          —
        </div>
      </div>
      <div className="card metric">
        <div id="kEmpty" className="k">
          Avg Jarak Kosongan
        </div>
        <div id="mEmpty" className="v">
          —
        </div>
      </div>
      <div className="card metric">
        <div id="kSpeed" className="k">
          Avg Actual Speed
        </div>
        <div id="mSpeed" className="v">
          —
        </div>
      </div>
    </section>
    </>
  );
}
