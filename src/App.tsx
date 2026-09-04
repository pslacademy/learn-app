import { BrowserRouter, Routes, Route } from "react-router-dom";
import Placeholder from "./pages/Placeholder";
import NotFound from "./pages/NotFound";

/**
 * Phase 1 skeleton. Two routes only, so a deep link can be tested against
 * the vercel.json rewrite: /anything must render, not 404 at the edge.
 */
const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Placeholder />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
