import { ReactNode } from 'react';

// Auth is disabled: this wrapper simply renders its children
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
