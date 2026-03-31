import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { Layout } from "./components/Layout";
import { DomainPicker } from "./pages/DomainPicker";
import { DomainOverview } from "./pages/DomainOverview";
import { PageDetail } from "./pages/PageDetail";
import { Privacy } from "./pages/Privacy";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DomainPicker />} />
          <Route path=":domain" element={<DomainOverview />} />
          <Route path=":domain/page" element={<PageDetail />} />
          <Route path="privacy" element={<Privacy />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
