import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Welcome from "./pages/Welcome";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Courses from "./pages/Courses";
import CoursePlayer from "./pages/CoursePlayer";
import Admin from "./pages/Admin";
import Events from "./pages/Events";
import Replays from "./pages/Replays";
import Resources from "./pages/Resources";
import CommunityPage from "./pages/Community";
import Messages from "./pages/Messages";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

/**
 * The academy has no landing page of its own. Marketing lives on
 * professionalservicesleadership.com, so the root goes straight to sign-in.
 */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          {/* Public by necessity: this is where an account is created, so it
              cannot sit behind a session that does not exist yet. The
              registration is still checked server side against the CRM, so
              reaching this page grants nothing. */}
          <Route path="/welcome" element={<Welcome />} />
          {/* Also public: somebody who has forgotten their password cannot be
              asked to sign in before they can set a new one. */}
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses"
            element={
              <ProtectedRoute>
                <Courses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses/:slug"
            element={
              <ProtectedRoute>
                <CoursePlayer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events"
            element={
              <ProtectedRoute>
                <Events />
              </ProtectedRoute>
            }
          />
          <Route
            path="/replays"
            element={
              <ProtectedRoute>
                <Replays />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resources"
            element={
              <ProtectedRoute>
                <Resources />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community"
            element={
              <ProtectedRoute>
                <CommunityPage />
              </ProtectedRoute>
            }
          />
          {/* The directory moved inside Community. Old links still work. */}
          <Route
            path="/members"
            element={<Navigate to="/community?space=directory" replace />}
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <Messages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
