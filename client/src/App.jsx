import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingView } from './pages/LandingView';
import { DashboardView } from './pages/DashboardView';
import { ChatView } from './pages/ChatView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingView />} />
        <Route path="/dashboard" element={<DashboardView />} />
        <Route path="/chat/:repoId" element={<ChatView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
