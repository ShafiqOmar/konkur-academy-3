import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import CourseDetail from './pages/CourseDetail';
import VideoPlayer from './pages/VideoPlayer';
import TestPage from './pages/TestPage';
import Dashboard from './pages/Dashboard';
import AdminPanel from './pages/AdminPanel';
import AdminStats from './pages/AdminStats';
import TeacherPanel from './pages/TeacherPanel';
import Leaderboard from './pages/Leaderboard';
import LiveClass from './pages/LiveClass';
import ForumList from './pages/ForumList';
import ForumThread from './pages/ForumThread';
import PaymentStatus from './pages/PaymentStatus';
import { useAuth } from './context/AuthContext';

function Protected({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="text-center py-20 text-ink/50">در حال بارگذاری...</div>;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <div className="min-h-screen bg-paper bg-blueprint-grid bg-grid">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route
            path="/courses/:id/live"
            element={
              <Protected>
                <LiveClass />
              </Protected>
            }
          />
          <Route
            path="/courses/:id/forum"
            element={
              <Protected>
                <ForumList />
              </Protected>
            }
          />
          <Route
            path="/forum/thread/:id"
            element={
              <Protected>
                <ForumThread />
              </Protected>
            }
          />
          <Route
            path="/videos/:id"
            element={
              <Protected>
                <VideoPlayer />
              </Protected>
            }
          />
          <Route
            path="/tests/:id"
            element={
              <Protected>
                <TestPage />
              </Protected>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <Protected>
                <Leaderboard />
              </Protected>
            }
          />
          <Route
            path="/dashboard"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/teacher"
            element={
              <Protected>
                <TeacherPanel />
              </Protected>
            }
          />
          <Route
            path="/admin"
            element={
              <Protected>
                <AdminPanel />
              </Protected>
            }
          />
          <Route
            path="/payment-status/:paymentId"
            element={
              <Protected>
                <PaymentStatus />
              </Protected>
            }
          />
          <Route
            path="/admin/stats"
            element={
              <Protected>
                <AdminStats />
              </Protected>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
