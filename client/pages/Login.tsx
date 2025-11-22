import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Auth is disabled; visiting /login immediately redirects to home
export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  return null;
}
