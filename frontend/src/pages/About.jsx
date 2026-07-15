import Navbar from "../components/Navbar"; // Adjust import path if needed

export default function About() {
  return (
    <>
      <Navbar />
      <main className="page">
        <section className="setup-card" style={{ maxWidth: '800px', margin: '0 auto', marginTop: '40px' }}>
          <div className="section-heading">
            <p className="eyebrow">The Journey</p>
            <h2>About Equi-Metrics</h2>
          </div>
          
          <div style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
            <p>
              Equi-Metrics started as a capstone machine learning project aimed at predicting horse race 
              outcomes. By aggregating global racing data via the Racing API, we engineered custom features 
              including <strong>Elo ratings</strong> and complex <strong>pedigree statistics</strong> (tracking Sire, Damsire, and maternal lines).
            </p>
            <br />
            <p>
              Our prediction engine was built by evaluating several rigorous models:
            </p>
            <ul>
              <li>Decision Trees & Random Forests (as baselines)</li>
              <li>LightGBM & CatBoost Rankers</li>
              <li><strong>XGBoost Ranker</strong> (Achieved top overall balance with ~65% Top-1 Accuracy)</li>
              <li><strong>Tuned Neural Networks</strong></li>
            </ul>
            <br />
            <p>
              Today, Equi-Metrics serves as a robust platform allowing users to simulate race conditions, 
              apply these advanced models, and view the predicted finishing orders of the world's top thoroughbreds.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}