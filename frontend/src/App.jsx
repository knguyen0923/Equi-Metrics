import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SimulationSetup from "./pages/SimulationSetup";
import About from "./pages/About";
import History from "./pages/History";
import Login from "./pages/Login";
import "./index.css";

function App() {
  return (
    // Router manages the URL state across the app
    <Router>
      <Routes>
        {/* Each Route renders the component when the path matches the URL */}
        <Route path="/" element={<SimulationSetup />} />
        <Route path="/about" element={<About />} />
        <Route path="/history" element={<History />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;