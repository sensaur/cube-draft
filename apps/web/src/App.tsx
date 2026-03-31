import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

function HomePage() {
  return (
    <div className="container py-5">
      <h1 className="mb-3">Cube Draft Frontend Starter</h1>
      <p className="text-muted">React + React Router + Bootstrap + Zustand</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}