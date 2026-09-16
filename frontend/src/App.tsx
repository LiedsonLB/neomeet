import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { VoiceCallProvider } from './context/VoiceCallContext';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import Dashboard from './pages/Dashboard';
import Salas from './pages/Salas';
import SalaRoom from './pages/SalaRoom';
import Comunidades from './pages/Comunidades';
import ComunidadeRoom from './pages/ComunidadeRoom';
import Perfil from './pages/Perfil';
import RedefinirSenha from './pages/RedefinirSenha';
import EsqueciSenha from './pages/EsqueciSenha';
import ConfirmarEmail from './pages/ConfirmarEmail';
import FloatingVoiceWidget from './components/FloatingVoiceWidget';
import PresenceHeartbeat from './components/PresenceHeartbeat';
import Landing from './pages/Landing';

// Componente que redireciona usuarios logados para o dashboard
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  if (session) return <Navigate to="/painel" replace />;

  return <>{children}</>;
}

// Componente que protege rotas que exigem autenticacao
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Landing publica - visivel para logados e nao logados */}
      <Route path="/" element={<Landing />} />

      {/* Rotas publicas - apenas para nao logados */}
      <Route path="/login" element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      } />
      <Route path="/cadastro" element={
        <PublicRoute>
          <Cadastro />
        </PublicRoute>
      } />
      <Route path="/esqueci-senha" element={
        <PublicRoute>
          <EsqueciSenha />
        </PublicRoute>
      } />
      <Route path="/redefinir-senha" element={
        <PublicRoute>
          <RedefinirSenha />
        </PublicRoute>
      } />
      {/* Confirmação de e-mail: acessível mesmo sem sessão ativa (link do e-mail) */}
      <Route path="/confirmar-email" element={<ConfirmarEmail />} />

      {/* Rotas protegidas - apenas para logados */}
      <Route path="/painel" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/salas" element={<ProtectedRoute><Salas /></ProtectedRoute>} />
      <Route path="/salas/:id" element={<ProtectedRoute><SalaRoom /></ProtectedRoute>} />
      <Route path="/comunidades" element={<ProtectedRoute><Comunidades /></ProtectedRoute>} />
      <Route path="/comunidades/:id" element={<ProtectedRoute><ComunidadeRoom /></ProtectedRoute>} />
      <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <VoiceCallProvider>
        <PresenceHeartbeat />
        <AppRoutes />
        <FloatingVoiceWidget />
      </VoiceCallProvider>
    </AuthProvider>
  );
}
