import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  // Évite d'empiler plusieurs messages "session expirée" si plusieurs requêtes
  // partent en même temps et échouent toutes en 401.
  const sessionExpiredRef = useRef(false);

  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const logout = useCallback(() => {
    sessionExpiredRef.current = false;
    clearSession();
  }, [clearSession]);

  /**
   * Session invalidée côté serveur (jeton expiré, secret changé, compte supprimé).
   * On déconnecte et on le dit, au lieu de laisser l'utilisateur devant une
   * interface qui répond "Erreur" à chaque action sans jamais expliquer pourquoi.
   */
  const handleUnauthorized = useCallback(() => {
    if (sessionExpiredRef.current) return;
    sessionExpiredRef.current = true;
    clearSession();
    toast.error('Session expirée, merci de vous reconnecter');
  }, [clearSession]);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const response = await axios.get(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          setUser(response.data);
          setToken(storedToken);
        } catch (error) {
          // Jeton périmé ou invalide au démarrage : on repart déconnecté,
          // sans message puisque l'utilisateur n'a encore rien tenté.
          console.debug('Jeton stocké invalide:', error.response?.status);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // Intercepteur global : toute réponse 401 met fin à la session.
  // La page de login est exclue, sinon un mot de passe erroné afficherait
  // "session expirée" au lieu de "identifiants incorrects".
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const url = error.config?.url || '';
        const isLoginAttempt = url.includes('/api/auth/login');
        if (error.response?.status === 401 && !isLoginAttempt) {
          handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [handleUnauthorized]);

  const login = useCallback(async (email, password) => {
    const response = await axios.post(`${API_URL}/api/auth/login`, { email, password });
    const { access_token, user: userData } = response.data;
    sessionExpiredRef.current = false;
    localStorage.setItem('token', access_token);
    setToken(access_token);
    setUser(userData);
    return userData;
  }, []);

  // getAuthHeaders est mémoïsé : sans ça, son identité changeait à chaque rendu
  // et les useEffect qui en dépendent se relançaient en boucle.
  const getAuthHeaders = useCallback(() => ({
    Authorization: `Bearer ${token}`
  }), [token]);

  const value = useMemo(() => ({
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    logout,
    handleUnauthorized,
    getAuthHeaders
  }), [user, token, loading, login, logout, handleUnauthorized, getAuthHeaders]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
